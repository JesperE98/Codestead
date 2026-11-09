using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// The draw call: shaders compiled with D3DCompileFromFile, the input layout, the vertex and index data copied into
// upload buffers, the rasterizer state of the pipeline state object, root constants and the Draw*Instanced call.
public sealed partial class D3D12Reader
{
    private void Draw()
    {
        var draw = src.Calls(".DrawInstanced").FirstOrDefault();
        var drawIndexed = src.Calls(".DrawIndexedInstanced").FirstOrDefault();
        var call = drawIndexed ?? draw;
        if (call is null) return;
        if (!Has("CreateGraphicsPipelineState"))
        {
            scene.Notes.Add(SimNote.Error("dxNoPso", ("call", call.Name)));
            return;
        }
        if (!Has("SetGraphicsRootSignature"))
        {
            scene.Notes.Add(SimNote.Error("dxNoRootSignature", ("call", call.Name)));
            return;
        }
        if (!Has("RSSetViewports") || !Has("RSSetScissorRects"))
        {
            scene.Notes.Add(SimNote.Warning("dxNoViewport"));
            return;
        }
        var vsInfo = Compile("vs_");
        var psInfo = Compile("ps_");
        if (vsInfo is null || psInfo is null) return;
        var (vs, vsEntry) = vsInfo.Value;
        var (ps, psEntry) = psInfo.Value;

        var vertices = new List<Dictionary<string, ShaderValue>>();
        var entry = vs.FindFunction(vsEntry);
        bool needsInput = entry is not null && entry.Params.Any(p => p.Semantic is not null && !p.Semantic.StartsWith("SV_", StringComparison.OrdinalIgnoreCase)
            || vs.FindStruct(p.Type) is not null);
        if (needsInput && !VertexData(vertices)) return;

        int[]? indices = null;
        int first = 0, count, instances;
        if (call == drawIndexed)
        {
            if (!Has("IASetIndexBuffer") || IndexData() is not { } data)
            {
                scene.Notes.Add(SimNote.Error("dxNoIndexBuffer"));
                return;
            }
            count = src.Int(call.Arg(0)) ?? 0;
            instances = src.Int(call.Arg(1)) ?? 1;
            int start = src.Int(call.Arg(2)) ?? 0;
            indices = data.Skip(start).Take(count).Select(d => (int)d).ToArray();
        }
        else
        {
            count = src.Int(call.Arg(0)) ?? 0;
            instances = src.Int(call.Arg(1)) ?? 1;
            first = src.Int(call.Arg(2)) ?? 0;
        }

        var topology = src.Calls(".IASetPrimitiveTopology").FirstOrDefault()?.Arg(0);
        if (topology is null)
        {
            scene.Notes.Add(SimNote.Warning("dxNoTopology"));
            return;
        }
        // The rasterizer state: CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT) culls back faces, front = clockwise.
        var cull = src.LastFieldValue("CullMode") ?? "D3D12_CULL_MODE_BACK";
        var fill = src.LastFieldValue("FillMode") ?? "D3D12_FILL_MODE_SOLID";
        var frontCcw = src.LastFieldValue("FrontCounterClockwise") is { } f && (src.Int(f) ?? 0) != 0;
        bool depth = DepthEnabled(int.MaxValue);

        var textures = Textures(vs, ps);
        var cullMode = cull.Contains("NONE", StringComparison.Ordinal) ? CullMode.None : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.Back;
        var topo = GlReader.TopologyOf(topology);

        // Run the frame: OnUpdate and the recorded command list (each draw with the root constants set before it).
        var blocks = vs.Globals.Concat(ps.Globals).Where(g => g.Block is not null).ToList();
        var recorder = new FrameRecorder(src, time, scene, blocks, transposeMatrices: true);
        foreach (var fn in new[] { "OnUpdate" }.Where(src.Functions.ContainsKey)) recorder.Run(fn);
        if (src.FunctionAt(call.Offset) is { } recordFn) recorder.Run(recordFn);
        var buffer = recorder.BufferContents();
        var indexData = drawIndexed is not null ? IndexData() : null;
        var pipelines = recorder.Draws.Any(d => d.Pipeline is not null) ? Pipelines() : new();
        if (recorder.Draws.Count > 0)
        {
            var fallback = Constants(vs, ps);
            foreach (var d in recorder.Draws)
            {
                // With several pipeline state objects, the draw uses the one set before it.
                var pl = d.Pipeline is not null && pipelines.Count > 1 && pipelines.TryGetValue(d.Pipeline, out var p) ? p : null;
                if (d.Model)
                {
                    var mValues = new Dictionary<string, ShaderValue>(fallback(time), StringComparer.Ordinal);
                    foreach (var (k, v) in buffer) mValues[k] = v;
                    foreach (var (k, v) in d.Constants) mValues[k] = v;
                    ModelDraws(pl?.Vs ?? vs, pl?.Fs ?? ps, pl?.VsEntry ?? vsEntry, pl?.FsEntry ?? psEntry, mValues, pl?.Cull ?? cullMode, pl?.FrontCcw ?? frontCcw, pl?.DepthTest ?? depth);
                    continue;
                }
                var values = new Dictionary<string, ShaderValue>(fallback(time), StringComparer.Ordinal);
                foreach (var (k, v) in buffer) values[k] = v;
                foreach (var (k, v) in d.Constants) values[k] = v;
                scene.Draws.Add(new DrawCall
                {
                    VertexShader = pl?.Vs ?? vs,
                    FragmentShader = pl?.Fs ?? ps,
                    VertexEntry = pl?.VsEntry ?? vsEntry,
                    FragmentEntry = pl?.FsEntry ?? psEntry,
                    Hlsl = true,
                    Vertices = vertices,
                    Indices = d.Indexed ? indexData?.Skip(d.First).Take(d.Count).Select(x => (int)x).ToArray() : null,
                    First = d.Indexed ? 0 : d.First,
                    Count = d.Count,
                    Instances = Math.Max(1, d.Instances),
                    Topology = topo,
                    Uniforms = _ => values,
                    Cull = pl?.Cull ?? cullMode,
                    FrontCcw = pl?.FrontCcw ?? frontCcw,
                    Wireframe = pl?.Wireframe ?? fill.Contains("WIREFRAME", StringComparison.Ordinal),
                    DepthTest = pl?.DepthTest ?? depth,
                    Textures = pl is null ? textures : Textures(pl.Vs, pl.Fs) ?? textures,
                });
            }
            if (recorder.Runner.UsedTime || src.UsedTime) scene.Animated = true;
            return;
        }
        scene.Draws.Add(new DrawCall
        {
            VertexShader = vs,
            FragmentShader = ps,
            VertexEntry = vsEntry,
            FragmentEntry = psEntry,
            Hlsl = true,
            Vertices = vertices,
            Indices = indices,
            First = first,
            Count = indices?.Length ?? count,
            Instances = Math.Max(1, instances),
            Topology = topo,
            Uniforms = Constants(vs, ps),
            Cull = cullMode,
            FrontCcw = frontCcw,
            Wireframe = fill.Contains("WIREFRAME", StringComparison.Ordinal),
            DepthTest = depth,
            Textures = textures,
        });
        foreach (var d in scene.Draws) d.Uniforms(1.0);
        if (src.UsedTime) scene.Animated = true;
    }

    /// <summary>
    /// Textures: each Texture2D (by register t0, t1 …) reads the next image loaded with stbi_load. It needs the chain of
    /// D3D12HelloTexture: a texture resource filled from an upload buffer, a shader resource view in a shader-visible
    /// heap, SetDescriptorHeaps and a descriptor table – and a sampler (static samplers in the root signature).
    /// </summary>
    private Func<string, double, double, double[]>? Textures(ShaderProgram vs, ShaderProgram ps)
    {
        var names = TextureBinding.ShaderTextures(vs, ps);
        if (names.Count == 0) return null;
        var missing = new (string Call, string Key)[]
        {
            ("CreateShaderResourceView", "dxNoSrv"),
            ("SetDescriptorHeaps", "dxNoDescriptorHeaps"),
            ("SetGraphicsRootDescriptorTable", "dxNoDescriptorTable"),
        }.FirstOrDefault(m => !Has(m.Call));
        if (missing.Call is not null)
        {
            scene.Notes.Add(SimNote.Error(missing.Key, ("name", names[0])));
            return (_, _, _) => [0, 0, 0, 1];
        }
        if (!Has("UpdateSubresources") && !Has("CopyTextureRegion")) scene.Notes.Add(SimNote.Error("dxNoTextureUpload"));
        var images = StbImage.InLoadOrder(src, project, scene);
        if (images.Count < names.Count) scene.Notes.Add(SimNote.Warning("tooFewTextures", ("count", names.Count.ToString()), ("loaded", images.Count.ToString())));
        // Static samplers: each description (sampler, samplers[0], samplers[1] …) by its ShaderRegister; the HLSL
        // Sample(…) call names the sampler, whose register picks the description.
        var byRegister = new Dictionary<int, Codestead.GP.Gpu.Textures.SamplerState>();
        var targets = src.FieldAssignments("Filter").Select(a => a.Target).Concat(src.FieldAssignments("AddressU").Select(a => a.Target)).Distinct().ToList();
        for (int i = 0; i < targets.Count; i++)
        {
            var t = targets[i];
            var reg = src.FieldAssignments("ShaderRegister").Where(a => a.Target == t).Select(a => src.Int(a.Value)).LastOrDefault() ?? (Regex.Match(t, @"\[(\d+)\]") is { Success: true } m ? int.Parse(m.Groups[1].Value) : i);
            byRegister[reg] = TextureBinding.FromFields(f => src.FieldAssignments(f).Where(a => a.Target == t).Select(a => a.Value).LastOrDefault(), d3d: true);
        }
        var samplerRegister = vs.Globals.Concat(ps.Globals).Where(g => g.Type.StartsWith("SamplerState", StringComparison.Ordinal)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        var fallback = byRegister.GetValueOrDefault(0) ?? byRegister.Values.FirstOrDefault() ?? Codestead.GP.Gpu.Textures.SamplerState.Default;
        return TextureBinding.Bind(names, images, (_, sampler) =>
            sampler is not null && samplerRegister.TryGetValue(sampler, out var r) && byRegister.TryGetValue(r, out var state) ? state : fallback);
    }

    /// <summary>
    /// A Model::Draw (the course's port of learnopengl's Model class): one draw per mesh, vertices by the input layout's
    /// semantics (POSITION, NORMAL, TEXCOORD – v flipped with aiProcess_FlipUVs), and the mesh's diffuse / specular maps
    /// as the shader's first and second Texture2D.
    /// </summary>
    private void ModelDraws(ShaderProgram vs, ShaderProgram ps, string vsEntry, string psEntry, Dictionary<string, ShaderValue> values, CullMode cull, bool frontCcw, bool depth)
    {
        var path = Models.ModelFiles.Path(src);
        var model = path is null ? null : Models.ObjModel.Load(project, path);
        if (model is null)
        {
            scene.Notes.Add(SimNote.Error("modelFileMissing", ("file", path ?? "?")));
            return;
        }
        bool flipUv = Models.ModelFiles.FlipUVs(src, project);
        var textureNames = TextureBinding.ShaderTextures(vs, ps);
        foreach (var mesh in model.Meshes)
        {
            var vertices = mesh.Positions.Select((pos, i) => new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["POSITION0"] = ShaderValue.Vec(pos),
                ["NORMAL0"] = ShaderValue.Vec(mesh.Normals[i]),
                ["TEXCOORD0"] = ShaderValue.Vec(mesh.TexCoords[i][0], flipUv ? 1 - mesh.TexCoords[i][1] : mesh.TexCoords[i][1]),
            }).ToList();
            var maps = new[] { mesh.Material?.DiffuseMap, mesh.Material?.SpecularMap, mesh.Material?.NormalMap }
                .Select(f => Models.ModelFiles.Texture(project, path!, f, false)).ToList();
            scene.Draws.Add(new DrawCall
            {
                VertexShader = vs,
                FragmentShader = ps,
                VertexEntry = vsEntry,
                FragmentEntry = psEntry,
                Hlsl = true,
                Vertices = vertices,
                Indices = mesh.Indices.ToArray(),
                Count = mesh.Indices.Count,
                Uniforms = _ => values,
                Cull = cull,
                FrontCcw = frontCcw,
                DepthTest = depth,
                Textures = (id, u, v) =>
                {
                    var name = id.Split('|')[0];
                    int i = textureNames.IndexOf(name);
                    return i >= 0 && i < maps.Count && maps[i] is { } t ? t.Sample(u, v) : [0, 0, 0, 1];
                },
            });
        }
    }

    /// <summary>
    /// Is the depth test on in the PSO description set before an offset? CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT) turns it
    /// on; a later DepthEnable = FALSE / TRUE decides.
    /// </summary>
    private bool DepthEnabled(int before)
    {
        var field = src.FieldAssignments("DepthEnable").Where(a => a.Offset < before).LastOrDefault();
        var desc = src.FieldAssignments("DepthStencilState").Where(a => a.Offset < before && a.Value.Contains("D3D12_DEFAULT", StringComparison.Ordinal)).LastOrDefault();
        if (desc.Value is not null && (field.Value is null || desc.Offset > field.Offset)) return true;
        return field.Value is not null && (src.Int(field.Value) ?? 0) != 0;
    }

    /// <summary>The shader compiled for a target ("vs_5_0", "ps_5_0"): D3DCompileFromFile(L"shaders.hlsl", …, "VSMain", "vs_5_0", …).</summary>
    private (ShaderProgram Program, string Entry)? Compile(string targetPrefix)
    {
        foreach (var c in src.Calls("D3DCompileFromFile"))
        {
            var target = CppSource.StringArg(c.Arg(4)) ?? "";
            if (!target.StartsWith(targetPrefix, StringComparison.Ordinal)) continue;
            var file = CppSource.StringArg(c.Arg(0)) ?? (src.Evaluate(c.Arg(0))?.Text ?? "");
            var entry = CppSource.StringArg(c.Arg(3)) ?? "main";
            var text = project.Find(file);
            if (text is null)
            {
                scene.Notes.Add(SimNote.Error("shaderFileMissing", ("file", file)));
                return null;
            }
            try
            {
                var program = ShaderParser.ParseProgram(text);
                if (program.FindFunction(entry) is null)
                {
                    scene.Notes.Add(SimNote.Error("dxNoEntryPoint", ("entry", entry), ("file", file)));
                    return null;
                }
                return (program, entry);
            }
            catch (ShaderSyntaxException)
            {
                return null; // The build reported it.
            }
        }
        scene.Notes.Add(SimNote.Error("dxShaderNotCompiled", ("target", targetPrefix + "5_0")));
        return null;
    }

    private static int Components(string format)
    {
        var m = Regex.Match(format, @"DXGI_FORMAT_((?:[RGBA]\d+)+)_");
        return m.Success ? Regex.Matches(m.Groups[1].Value, @"[RGBA]\d+").Count : 4;
    }

    /// <summary>The vertex array copied into the vertex buffer, laid out by the input layout (semantic → floats at a byte offset).</summary>
    private bool VertexData(List<Dictionary<string, ShaderValue>> into)
    {
        var layoutName = Regex.Match(src.Code, @"D3D12_INPUT_ELEMENT_DESC\s+(\w+)\s*\[");
        var layout = layoutName.Success ? src.Initializer(layoutName.Groups[1].Value) : null;
        if (layout is null || !Has("IASetVertexBuffers"))
        {
            scene.Notes.Add(SimNote.Error("dxNoInputLayout"));
            return false;
        }
        var elements = new List<(string Semantic, int Offset, int Comps)>();
        int nextOffset = 0;
        foreach (var item in CppSource.SplitArgs(layout.Trim()[1..^1]))
        {
            var parts = CppSource.SplitArgs(item.Trim().TrimStart('{').TrimEnd('}'));
            if (parts.Count < 5) continue;
            var semantic = (CppSource.StringArg(parts[0]) ?? "").ToUpperInvariant() + (src.Int(parts[1]) ?? 0);
            int comps = Components(parts[2]);
            int offset = parts[4].Contains("APPEND_ALIGNED", StringComparison.Ordinal) ? nextOffset : src.Int(parts[4]) ?? 0;
            nextOffset = offset + comps * 4;
            elements.Add((semantic, offset, comps));
        }
        var source = VertexArrayName();
        if (source is null || src.Initializer(source) is not { } init || src.Evaluate(init) is not { } value)
        {
            scene.Notes.Add(SimNote.Error("dxNoVertexData"));
            return false;
        }
        foreach (var item in value.Items ?? [value])
        {
            var nums = new List<double>();
            Flatten(item, nums);
            var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var (semantic, offset, comps) in elements)
                dict[semantic] = ShaderValue.Vec(nums.Skip(offset / 4).Take(comps).ToArray());
            into.Add(dict);
        }
        return true;
    }

    private static void Flatten(ShaderValue v, List<double> into)
    {
        if (v.V is not null) into.AddRange(v.V);
        else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into);
    }

    private static bool IsIndexType(string? type) => type is not null && Regex.IsMatch(type, @"^(?:UINT16|uint16_t|UINT|uint32_t|DWORD|WORD|unsigned(?:int|short)?|std::(?:vector|array)<(?:UINT16|uint16_t|UINT|uint32_t|DWORD|WORD)[^>]*>)$");

    /// <summary>The arrays copied with memcpy into the mapped buffers: the vertex array is the one that is not of an index type.</summary>
    private string? VertexArrayName() =>
        src.Calls("memcpy").Select(c => Regex.Replace(c.Arg(1).Trim().TrimStart('&'), @"\.data\(\)$|\[0\]$", ""))
            .FirstOrDefault(n => Regex.IsMatch(n, @"^\w+$") && !IsIndexType(src.DeclaredType(n)) && src.Initializer(n) is { } i && i.TrimStart().StartsWith('{'));

    private List<double>? IndexData()
    {
        var name = src.Calls("memcpy").Select(c => Regex.Replace(c.Arg(1).Trim().TrimStart('&'), @"\.data\(\)$|\[0\]$", ""))
            .FirstOrDefault(n => Regex.IsMatch(n, @"^\w+$") && IsIndexType(src.DeclaredType(n)));
        return name is null ? null : src.Numbers(name);
    }

    /// <summary>
    /// Constants: an HLSL cbuffer whose name matches a C++ struct; the fields assigned to a variable of that type
    /// (constants.color = XMFLOAT4(…)) are its values. They must reach the GPU (root constants or a constant buffer).
    /// </summary>
    private Func<double, Dictionary<string, ShaderValue>> Constants(ShaderProgram vs, ShaderProgram ps)
    {
        var blocks = vs.Globals.Concat(ps.Globals).Where(g => g.Block is not null).ToList();
        if (blocks.Count == 0) return _ => new();
        var assignments = new List<(string Field, string Expr)>();
        foreach (var block in blocks)
        {
            var variables = Regex.Matches(src.Code, @"\b" + Regex.Escape(block.Type) + @"\s+(\w+)\s*(?:\{[^;]*\}|=[^;]*)?\s*;").Select(m => m.Groups[1].Value).ToHashSet();
            if (variables.Count == 0) continue;
            if (!Has("SetGraphicsRoot32BitConstants") && !Has("SetGraphicsRootConstantBufferView") && !Has("SetGraphicsRootDescriptorTable"))
                scene.Notes.Add(SimNote.Warning("dxConstantsNotSet", ("type", block.Type)));
            foreach (var field in block.Block!)
                foreach (var a in src.FieldAssignments(field.Id))
                    if (variables.Contains(a.Target)) assignments.Add((field.Id, a.Value));
        }
        return t =>
        {
            var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var (field, expr) in assignments)
                if (src.Evaluate(expr, t) is { } v) d[field] = v;
            return d;
        };
    }
}
