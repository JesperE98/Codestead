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
        // The draws the command list records (PopulateCommandList) come first: a Mesh::Draw elsewhere is called from there.
        // Recorded: in PopulateCommandList or a helper it calls (learnopengl's renderScene as RenderScene()).
        var recording = new HashSet<string>(StringComparer.Ordinal) { "PopulateCommandList" };
        for (var queue = new Queue<string>(recording); queue.Count > 0;)
        {
            var fn = queue.Dequeue();
            foreach (var other in src.Functions.Keys)
                if (!recording.Contains(other) && src.Calls(fn, other) && recording.Add(other)) queue.Enqueue(other);
        }
        bool Recorded(CppCall c) => src.FunctionAt(c.Offset) is { } at && recording.Contains(at);
        var draws = src.Calls(".DrawInstanced").ToList();
        var indexedDraws = src.Calls(".DrawIndexedInstanced").ToList();
        // A Model (learnopengl's Model class ported): m_model.Draw(m_commandList.Get()) draws its meshes.
        // (Through a member or a pointer too: entity.pModel->Draw(commandList) – the member's declared type.)
        var modelDraw = src.Calls(".Draw").FirstOrDefault(c => Recorded(c) && c.Target is { } t
            && (src.DeclaredType(Regex.Match(t, @"(\w+)\s*(?:\[[^\]]*\])?\s*$").Groups[1].Value) ?? "").Contains("Model", StringComparison.Ordinal));
        // With a PopulateCommandList, only what it records is drawn (a Mesh::Draw nobody calls yet draws nothing).
        bool recordsHere = src.Functions.ContainsKey("PopulateCommandList");
        var draw = draws.FirstOrDefault(Recorded) ?? (modelDraw is null && !recordsHere ? draws.FirstOrDefault() : null);
        var drawIndexed = indexedDraws.FirstOrDefault(Recorded) ?? (modelDraw is null && !recordsHere ? indexedDraws.FirstOrDefault() : null);
        var call = drawIndexed ?? draw ?? modelDraw;
        if (call is null) return;
        bool modelOnly = call == modelDraw;
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
        var gsInfo = UsesGeometry(int.MaxValue) ? Compile("gs_") : null;
        // Tessellation: a hull and a domain shader in the description (psoDesc.HS / DS set to bytecode).
        var hsInfo = UsesStage("HS", int.MaxValue) ? Compile("hs_") : null;
        var dsInfo = hsInfo is not null && UsesStage("DS", int.MaxValue) ? Compile("ds_") : null;

        var vertices = new List<Dictionary<string, ShaderValue>>();
        var entry = vs.FindFunction(vsEntry);
        bool needsInput = entry is not null && entry.Params.Any(p => p.Semantic is not null && !p.Semantic.StartsWith("SV_", StringComparison.OrdinalIgnoreCase)
            || vs.FindStruct(p.Type) is not null);
        // The vertex data: from the vertex buffer views the command list sets (the device model), else from the array
        // copied into the vertex buffer (the earlier chapters' single buffer).
        int notesBefore = scene.Notes.Count;
        bool staticVertices = !needsInput || modelOnly || VertexData(vertices);

        int[]? indices = null;
        int first = 0, count, instances;
        bool missingIndices = false;
        if (modelOnly)
        {
            count = 0;
            instances = 1;
        }
        else if (call == drawIndexed)
        {
            // Without an index array copied into a buffer here, the device model may still find the indices (a
            // mesh's index buffer view): only an error if it does not.
            missingIndices = !Has("IASetIndexBuffer") || IndexData() is null;
            count = src.Int(call.Arg(0)) ?? 0;
            instances = src.Int(call.Arg(1)) ?? 1;
            int start = src.Int(call.Arg(2)) ?? 0;
            indices = (IndexData() ?? []).Skip(start).Take(count).Select(d => (int)d).ToArray();
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
        var state = PipelineState.D3D12(f => StateField(f, int.MaxValue), f => StateField(f, int.MaxValue) is { } v ? src.Int(v) : null);

        var textures = modelOnly ? null : Textures(vs, ps);
        var cullMode = cull.Contains("NONE", StringComparison.Ordinal) ? CullMode.None : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.Back;
        var topo = TopologyOf(topology);

        // Run the frame: OnUpdate and the recorded command list (each draw with the root constants set before it).
        var blocks = VulkanReader.AllShaderBlocks(project, [".hlsl"], vs, ps);
        var device = new D3D12Device(src, project);
        var recorder = new FrameRecorder(src, time, scene, blocks, transposeMatrices: true, device) { Project = project };
        recorder.Setup();
        if (device.WindowSrgb) scene.WindowSrgb = true;
        // A game: the frames before the shown one (OnUpdate with the frame's input, without drawing).
        GameFrames.RunWin32(src, recorder, time);
        foreach (var fn in new[] { "OnUpdate" }.Where(src.Functions.ContainsKey)) recorder.Run(fn);
        // The command list is recorded in PopulateCommandList (draws may sit in a helper it calls).
        // A program that reads the debug layer's info queue after ExecuteCommandLists (learnopengl's "Debugging"): the
        // whole OnRender, so the check after the frame's commands runs too.
        bool wholeRender = src.Uses("GetNumStoredMessages") && src.FunctionBody("OnRender") is { } onRender && onRender.Contains("PopulateCommandList", StringComparison.Ordinal);
        if ((wholeRender ? "OnRender" : src.Functions.ContainsKey("PopulateCommandList") ? "PopulateCommandList" : src.FunctionAt(call.Offset)) is { } recordFn) recorder.Run(recordFn);
        var buffer = recorder.BufferContents();
        bool deviceVertices = needsInput && !modelOnly && recorder.Draws.Any(d => d.State is D3D12Device.DrawState { VertexBuffers.Count: > 0 } st && device.Read(st.VertexBuffers.Values.First().Address, 0, 1) is not null);
        if (missingIndices && !(deviceVertices && recorder.Draws.Any(d => d.Indexed && d.State is D3D12Device.DrawState { IndexBuffer: not null })))
        {
            scene.Notes.Add(SimNote.Error("dxNoIndexBuffer"));
            return;
        }
        if (!staticVertices && !deviceVertices) return;
        if (deviceVertices) scene.Notes.RemoveRange(notesBefore, scene.Notes.Count - notesBefore);
        var indexData = drawIndexed is not null && !deviceVertices ? IndexData() : null;
        var layouts = deviceVertices ? InputLayouts() : [];
        // Render targets the frame draws into, clears and resolves (the device model's ops, by recorded draw).
        // The ops recorded during the setup (the first SetupOps) belong to the setup draws; the others to the frame.
        var opsByDraw = device.Ops.Skip(recorder.SetupOps).GroupBy(o => o.BeforeDraw).ToDictionary(g => g.Key, g => g.ToList());
        var setupOpsByDraw = device.Ops.Take(recorder.SetupOps).GroupBy(o => o.BeforeDraw).ToDictionary(g => g.Key, g => g.ToList());
        var pipelines = recorder.Draws.Any(d => d.Pipeline is not null) ? Pipelines() : new();
        if (recorder.Draws.Count > 0)
        {
            var fallback = Constants(vs, ps);
            for (int di = 0; di < recorder.Draws.Count; di++)
            {
                var d = recorder.Draws[di];
                if (setupOpsByDraw.TryGetValue(di, out var setupOps)) AddOps(setupOps, device);
                if (di == recorder.SetupDraws && di > 0)
                {
                    // The setup's draws and ops end here (the ops after its last draw came just above).
                    foreach (var (_, late) in setupOpsByDraw.Where(o => o.Key > di).OrderBy(o => o.Key)) AddOps(late, device);
                    (scene.SetupDraws, scene.SetupOps) = (scene.Draws.Count, scene.Ops.Count);
                }
                if (opsByDraw.TryGetValue(di, out var ops)) AddOps(ops, device);
                // Descriptor tables set while the command list had no descriptor heap: the draw sees no constants and
                // no textures – nothing of it shows (the debug layer's message #708).
                if (d.State is D3D12Device.DrawState { NoHeap: true }) continue;
                // With several pipeline state objects, the draw uses the one set before it.
                var pl = d.Pipeline is not null && pipelines.Count > 1 && pipelines.TryGetValue(d.Pipeline, out var p) ? p : null;
                // PSOs the reading of the code cannot follow (a map of shaders, a Compile helper): the one the device saw set.
                if (pl is null && device.CreatedPsos.Count > Math.Max(1, pipelines.Count) && d.State is D3D12Device.DrawState { Pso: { } bound })
                    pl = RuntimePso(device, bound);
                if (d.Model)
                {
                    var mValues = new Dictionary<string, ShaderValue>(fallback(time), StringComparer.Ordinal);
                    foreach (var (k, v) in buffer) mValues[k] = v;
                    foreach (var (k, v) in d.Constants) mValues[k] = v;
                    RootCbvValues(device, d, blocks, mValues);
                    // The model's meshes go where the command list draws now (an off-screen G-buffer too).
                    var modelTarget = (d.State as D3D12Device.DrawState)?.Target;
                    if (modelTarget is not null) RegisterTarget(device, modelTarget);
                    ModelDraws(pl?.Vs ?? vs, pl?.Fs ?? ps, pl?.VsEntry ?? vsEntry, pl?.FsEntry ?? psEntry, mValues, pl?.Cull ?? cullMode, pl?.FrontCcw ?? frontCcw, pl?.DepthTest ?? depth,
                        pl is not null ? pl.Gs : gsInfo?.Program, pl is not null ? pl.GsEntry : gsInfo?.Entry ?? "main", d, modelTarget);
                    continue;
                }
                var values = new Dictionary<string, ShaderValue>(fallback(time), StringComparer.Ordinal);
                foreach (var (k, v) in buffer) values[k] = v;
                foreach (var (k, v) in d.Constants) values[k] = v;
                RootCbvValues(device, d, blocks, values);
                var dvs = pl?.Vs ?? vs;
                var dps = pl?.Fs ?? ps;
                var dVertices = vertices;
                int[]? dIndices = d.Indexed ? indexData?.Skip(d.First).Take(d.Count).Select(x => (int)x).ToArray() : null;
                List<Dictionary<string, ShaderValue>>? perInstance = null;
                int stepRate = 1;
                if (deviceVertices && d.State is D3D12Device.DrawState ds)
                {
                    if (d.Indexed && ds.IndexBuffer is { } ib)
                        dIndices = Enumerable.Range(0, d.Count).Select(k => (int)(device.ReadIndex(ib.Address, (long)(d.First + k) * ib.Bytes, ib.Bytes) ?? 0)).ToArray();
                    // Only the vertices the indices reach (a strip of a large grid), the indices counted from the lowest.
                    int baseVertex = d.Indexed && dIndices is { Length: > 0 } && !dvs.Names.Contains("SV_VertexID") ? dIndices.Min() : 0;
                    if (baseVertex > 0) for (int k = 0; k < dIndices!.Length; k++) dIndices[k] -= baseVertex;
                    int vertexCount = d.Indexed ? (dIndices is { Length: > 0 } ? dIndices.Max() + 1 : 0) : d.First + d.Count;
                    (dVertices, perInstance, stepRate) = DeviceVertices(device, ds, ChooseLayout(layouts, dvs, pl?.VsEntry ?? vsEntry), vertexCount, Math.Max(1, d.Instances), baseVertex);
                }
                deviceTextureSizes = null;
                var dhs = pl is not null ? pl.Tcs : hsInfo?.Program;
                var dds = pl is not null ? pl.Tes : dsInfo?.Program;
                var (deviceTextures, deviceCubes) = d.State is D3D12Device.DrawState { Tables.Count: > 0 } ts ? DeviceTextures(device, ts, PipelineInfo.Merged(dvs, dhs, dds, pl is not null ? pl.Gs : gsInfo?.Program), dps) : (null, null);
                var textureSizes = deviceTextures is null ? null : deviceTextureSizes;
                var target = (d.State as D3D12Device.DrawState)?.Target;
                if (target is not null) RegisterTarget(device, target);
                scene.Draws.Add(new DrawCall
                {
                    Target = target,
                    GeometryShader = pl is not null ? pl.Gs : gsInfo?.Program,
                    GeometryEntry = pl is not null ? pl.GsEntry : gsInfo?.Entry ?? "main",
                    TessControlShader = dds is not null ? dhs : null,
                    TessControlEntry = pl is not null ? pl.TcsEntry : hsInfo?.Entry ?? "main",
                    TessEvalShader = dhs is not null ? dds : null,
                    TessEvalEntry = pl is not null ? pl.TesEntry : dsInfo?.Entry ?? "main",
                    PatchVertices = PatchPoints((d.State as D3D12Device.DrawState)?.Topology ?? topology),
                    InstanceVertices = perInstance,
                    InstanceDivisor = stepRate,
                    CubeTextures = deviceCubes,
                    CubeTexturesLod = deviceCubes is null ? null : deviceCubeLod,
                    TextureSizes = textureSizes,
                    VertexShader = dvs,
                    FragmentShader = dps,
                    VertexEntry = pl?.VsEntry ?? vsEntry,
                    FragmentEntry = pl?.FsEntry ?? psEntry,
                    Hlsl = true,
                    Vertices = dVertices,
                    Indices = dIndices,
                    First = d.Indexed ? 0 : d.First,
                    Count = d.Count,
                    Instances = Math.Max(1, d.Instances),
                    Topology = (d.State as D3D12Device.DrawState)?.Topology is { } drawTopology ? TopologyOf(drawTopology) : topo,
                    Uniforms = _ => values,
                    Cull = pl?.Cull ?? cullMode,
                    FrontCcw = pl?.FrontCcw ?? frontCcw,
                    Wireframe = pl?.Wireframe ?? fill.Contains("WIREFRAME", StringComparison.Ordinal),
                    DepthTest = pl?.DepthTest ?? depth,
                    DepthFunc = (pl?.State ?? state).DepthFunc,
                    DepthWrite = (pl?.State ?? state).DepthWrite,
                    Stencil = (pl?.State ?? state).Stencil is { } st ? st with { Ref = d.StencilRef ?? st.Ref } : null,
                    Blend = (pl?.State ?? state).Blend,
                    AttachmentBlends = (pl?.State ?? state).Attachments,
                    Textures = deviceTextures ?? PerDrawTextures(pl?.Vs ?? vs, pl?.Fs ?? ps, d.Bound) ?? (pl is null ? textures : Textures(pl.Vs, pl.Fs) ?? textures),
                });
            }
            if (recorder.SetupDraws > 0 && recorder.SetupDraws >= recorder.Draws.Count)
            {
                // Nothing but the setup was drawn: its last ops, and the frame's ops after them.
                if (setupOpsByDraw.TryGetValue(recorder.Draws.Count, out var tail)) AddOps(tail, device);
                (scene.SetupDraws, scene.SetupOps) = (scene.Draws.Count, scene.Ops.Count);
            }
            if (opsByDraw.TryGetValue(recorder.Draws.Count, out var lastOps)) AddOps(lastOps, device);
            // Textures found through the device model's descriptors: the load-order count does not apply.
            if (recorder.Draws.Any(d => d.State is D3D12Device.DrawState { Tables.Count: > 0 } ts && device.Srvs.Keys.Any(k => ts.Tables.Values.Contains(k))))
                scene.Notes.RemoveAll(n => n.Key == "tooFewTextures");
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
        // A Model's textures come from its .mtl file, not from stbi_load calls with a file name.
        if (images.Count < names.Count && !src.Code.Contains("aiProcess_", StringComparison.Ordinal)) scene.Notes.Add(SimNote.Warning("tooFewTextures", ("count", names.Count.ToString()), ("loaded", images.Count.ToString())));
        var sampler = SamplersByRegister(vs, ps);
        return TextureBinding.Bind(names, images, (_, name) => sampler(name));
    }

    /// <summary>
    /// The textures of one draw when the descriptor table bound before it starts at a heap slot whose texture a
    /// loading helper put there (LoadTexture("metal.png", …, 2)): register tk reads slot N + k. Null otherwise.
    /// </summary>
    private Func<string, double, double, double[]>? PerDrawTextures(ShaderProgram vs, ShaderProgram ps, IReadOnlyDictionary<int, string>? bound)
    {
        if (bound is null || bound.Count == 0) return null;
        drawTextures ??= new DrawTextures(src, project);
        if (!drawTextures.HasSlots) return null;
        var names = TextureBinding.ShaderTextures(vs, ps);
        if (names.Count == 0) return null;
        var registers = vs.Globals.Concat(ps.Globals).Where(g => names.Contains(g.Id)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        foreach (var (_, text) in bound.OrderByDescending(b => b.Key))
        {
            if (drawTextures.D3D12Slot(text) is not int slot || drawTextures.SlotImage(slot + registers.Values.DefaultIfEmpty(0).Min()) is null) continue;
            var samplers = SamplersByRegister(vs, ps);
            var cache = new Dictionary<string, Codestead.GP.Gpu.Textures.Texture?>(StringComparer.Ordinal);
            return (id, u, v) =>
            {
                if (!cache.TryGetValue(id, out var t))
                {
                    var parts = id.Split('|');
                    var image = registers.TryGetValue(parts[0], out var reg) ? drawTextures.SlotImage(slot + reg) : null;
                    cache[id] = t = image is null ? null : new Codestead.GP.Gpu.Textures.Texture(image, samplers(parts.Length > 1 ? parts[1] : null)) { Components = image.Channels == 4 ? 4 : 3 };
                }
                return t is not null ? t.Sample(u, v) : [0, 0, 0, 1];
            };
        }
        return null;
    }

    /// <summary>D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP, …_LINESTRIP, …_TRIANGLELIST, …_POINTLIST (no underscore before STRIP).</summary>
    /// <summary>D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST → 4.</summary>
    private static int PatchPoints(string? name) =>
        name is not null && Regex.Match(name, @"(\d+)_CONTROL_POINT") is { Success: true } m ? int.Parse(m.Groups[1].Value) : 3;

    private static Topology TopologyOf(string name) => name switch
    {
        _ when name.Contains("CONTROL_POINT_PATCHLIST", StringComparison.Ordinal) => Topology.Patches,
        _ when name.Contains("TRIANGLESTRIP", StringComparison.Ordinal) => Topology.TriangleStrip,
        _ when name.Contains("LINESTRIP", StringComparison.Ordinal) => Topology.LineStrip,
        _ => GlReader.TopologyOf(name),
    };

    private DrawTextures? drawTextures;

    /// <summary>Clears and resolves of the device model, in the scene's draw numbering (a Model draw adds several draws).</summary>
    private void AddOps(List<FrameOp> ops, D3D12Device device)
    {
        foreach (var op in ops)
        {
            var at = scene.Draws.Count;
            switch (op)
            {
                case ClearOp c:
                    if (c.Target is not null) RegisterTarget(device, c.Target);
                    scene.Ops.Add(c with { BeforeDraw = at });
                    // The first clear of the window is the frame's clear colour.
                    if (c.Target is null && c.Color is not null && scene.Draws.Count == 0 && !scene.Ops.Any(o => o is ClearOp { Target: null } other && other != scene.Ops[^1])) scene.ClearColor ??= c.Color;
                    break;
                case CopyOp cp:
                    if (cp.From is not null) RegisterTarget(device, cp.From);
                    if (cp.To is not null) RegisterTarget(device, cp.To);
                    scene.Ops.Add(cp with { BeforeDraw = at });
                    break;
            }
        }
    }

    /// <summary>An off-screen render target of the device model ("res:N") in the scene, with its size and format.</summary>
    private void RegisterTarget(D3D12Device device, string id)
    {
        // "res:N~2@3": mip level 2 of resource N (half the size per level), array slice / cube face 3. The target is
        // registered per level; its slices are found through it.
        var levelId = id.Contains('@') ? id[..id.IndexOf('@')] : id;
        if (scene.Targets.ContainsKey(levelId) || device.TargetResource(id) is not var (r, level)) return;
        // A texture array drawn into slice by slice in one pass (a point shadow's cube map: SV_RenderTargetArrayIndex)
        // has layers; drawn into through a view per slice (a cube map's faces one by one), each slice is its own target.
        var shape = device.ShapeOf(id) ?? device.ShapeOf(levelId);
        scene.Targets[levelId] = new RenderTarget(levelId, Math.Max(1, r.Width >> level), Math.Max(1, r.Height >> level), shape?.Colors ?? 1, shape?.Depth ?? true, shape?.Depth ?? true,
            Math.Max(1, r.Samples), r.Float, r.PerSlice ? 1 : Math.Max(1, r.ArraySize), device.DepthOf(levelId), device.ChannelsOf(levelId, shape?.Colors ?? 1));
        if (device.DepthOf(levelId) is { } owner) RegisterTarget(device, owner);
    }

    /// <summary>Every input layout of the program: (semantic, input slot, byte offset, floats, per instance, step rate).</summary>
    private List<List<(string Semantic, int Slot, int Offset, int Comps, bool Instance, int Step)>> InputLayouts()
    {
        var result = new List<List<(string, int, int, int, bool, int)>>();
        foreach (Match m in Regex.Matches(src.Code, @"D3D12_INPUT_ELEMENT_DESC\s+(\w+)\s*\["))
        {
            if (src.Initializer(m.Groups[1].Value) is not { } layout) continue;
            var elements = new List<(string, int, int, int, bool, int)>();
            var nextOffset = new Dictionary<int, int>();
            foreach (var item in CppSource.SplitArgs(layout.Trim()[1..^1]))
            {
                var parts = CppSource.SplitArgs(item.Trim().TrimStart('{').TrimEnd('}'));
                if (parts.Count < 5) continue;
                var semantic = (CppSource.StringArg(parts[0]) ?? "").ToUpperInvariant() + (src.Int(parts[1]) ?? 0);
                int comps = Components(parts[2]);
                int slot = src.Int(parts[3]) ?? 0;
                int offset = parts[4].Contains("APPEND_ALIGNED", StringComparison.Ordinal) ? nextOffset.GetValueOrDefault(slot) : src.Int(parts[4]) ?? 0;
                nextOffset[slot] = offset + comps * 4;
                bool instance = parts.Count > 5 && parts[5].Contains("INSTANCE", StringComparison.Ordinal);
                int step = parts.Count > 6 ? Math.Max(1, src.Int(parts[6]) ?? 1) : 1;
                elements.Add((semantic, slot, offset, comps, instance, step));
            }
            result.Add(elements);
        }
        return result;
    }

    /// <summary>The input layout that feeds a vertex shader best: the one with the most of its input semantics.</summary>
    private static List<(string Semantic, int Slot, int Offset, int Comps, bool Instance, int Step)> ChooseLayout(
        List<List<(string Semantic, int Slot, int Offset, int Comps, bool Instance, int Step)>> layouts, ShaderProgram vs, string entry)
    {
        var f = vs.FindFunction(entry);
        var wanted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (f is not null)
            foreach (var p in f.Params)
            {
                if (p.Semantic is not null) wanted.Add(Rasterizer_Semantic(p.Semantic));
                if (vs.FindStruct(p.Type) is { } st)
                    foreach (var field in st.Fields.Where(x => x.Semantic is not null)) wanted.Add(Rasterizer_Semantic(field.Semantic!));
            }
        return layouts.OrderByDescending(l => l.Count(e => wanted.Contains(e.Semantic))).ThenBy(l => Math.Abs(l.Count - wanted.Count)).FirstOrDefault() ?? [];
    }

    private static string Rasterizer_Semantic(string s) => char.IsDigit(s[^1]) ? s.ToUpperInvariant() : s.ToUpperInvariant() + "0";

    /// <summary>Vertices (and per-instance values) read from the vertex buffers bound at the draw, through the layout.</summary>
    private static (List<Dictionary<string, ShaderValue>>, List<Dictionary<string, ShaderValue>>?, int) DeviceVertices(D3D12Device device, D3D12Device.DrawState state,
        List<(string Semantic, int Slot, int Offset, int Comps, bool Instance, int Step)> layout, int count, int instances, int baseVertex = 0)
    {
        var vertices = new List<Dictionary<string, ShaderValue>>();
        var perVertex = layout.Where(e => !e.Instance).ToList();
        for (int i = 0; i < count; i++)
        {
            var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var e in perVertex)
                if (state.VertexBuffers.TryGetValue(e.Slot, out var vb) && device.Read(vb.Address, (long)(i + baseVertex) * vb.Stride + e.Offset, e.Comps) is { } v)
                    dict[e.Semantic] = ShaderValue.Vec(v);
            vertices.Add(dict);
        }
        var perInstance = layout.Where(e => e.Instance).ToList();
        if (perInstance.Count == 0) return (vertices, null, 1);
        int step = perInstance[0].Step;
        var instanceData = new List<Dictionary<string, ShaderValue>>();
        for (int i = 0; i < (instances + step - 1) / step; i++)
        {
            var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var e in perInstance)
                if (state.VertexBuffers.TryGetValue(e.Slot, out var vb) && device.Read(vb.Address, (long)i * vb.Stride + e.Offset, e.Comps) is { } v)
                    dict[e.Semantic] = ShaderValue.Vec(v);
            instanceData.Add(dict);
        }
        return (vertices, instanceData, step);
    }

    /// <summary>
    /// The textures of a draw through its descriptor tables: register tk of a table starting at handle h reads the
    /// SRV at h + k – a loaded image, a cube map (TextureCube) or a render target drawn earlier in the frame.
    /// </summary>
    private (Func<string, double, double, double[]>?, Func<string, double, double, double, double[]?>?) DeviceTextures(
        D3D12Device device, D3D12Device.DrawState state, ShaderProgram vs, ShaderProgram ps)
    {
        var names = TextureBinding.ShaderTextures(vs, ps);
        if (names.Count == 0) return (null, null);
        var registers = vs.Globals.Concat(ps.Globals).Where(g => names.Contains(g.Id)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        int lowest = registers.Values.DefaultIfEmpty(0).Min();
        var table = state.Tables.OrderByDescending(t => t.Key).Select(t => (long?)t.Value).FirstOrDefault(h => device.Srvs.ContainsKey(h!.Value + lowest));
        if (table is not long start) return (null, null);
        var sampler = SamplersByRegister(vs, ps);
        var flat = new Dictionary<string, Codestead.GP.Gpu.Textures.Texture?>(StringComparer.Ordinal);
        var cubes = new Dictionary<string, Codestead.GP.Gpu.Textures.CubeTexture?>(StringComparer.Ordinal);
        (Codestead.GP.Gpu.Textures.Texture?, Codestead.GP.Gpu.Textures.CubeTexture?) Lookup(string id)
        {
            var parts = id.Split('|');
            if (!flat.ContainsKey(id))
            {
                // "name@k": slice k of a Texture2DArray.
                int at = parts[0].IndexOf('@');
                var name = at < 0 ? parts[0] : parts[0][..at];
                int layer = at < 0 ? 0 : int.Parse(parts[0][(at + 1)..], System.Globalization.CultureInfo.InvariantCulture);
                var (t, c) = registers.TryGetValue(name, out var reg) ? device.TextureAt(TableHandle(state, reg) ?? start + reg, sampler(parts.Length > 1 ? parts[1] : null), layer) : (null, null);
                flat[id] = t;
                cubes[id] = c;
            }
            return (flat[id], cubes[id]);
        }
        deviceTextureSizes = id => Lookup(id).Item1 is { } t ? (t.Image.Width, t.Image.Height) : null;
        deviceCubeLod = (id, x, y, z, lod) => Lookup(id).Item2 is { } c ? c.Sample(x, y, z, lod) : null;
        return ((id, u, v) => Lookup(id).Item1 is { } t ? t.Sample(u, v) : [0, 0, 0, 1],
            (id, x, y, z) => Lookup(id).Item2 is { } c ? c.Sample(x, y, z) : null);
    }

    /// <summary>
    /// The descriptor of an SRV register through the root signature: the root parameter whose table's SRV range covers the
    /// register (ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1); rootParameters[3].InitAsDescriptorTable(1, &amp;ranges[2])),
    /// at the handle bound to it – several tables per draw (bloom's scene and bloomBlur). Null when the code does not say.
    /// </summary>
    private long? TableHandle(D3D12Device.DrawState state, int register)
    {
        srvTables ??= SrvTables();
        foreach (var (param, baseRegister, count) in srvTables)
            if (register >= baseRegister && register < baseRegister + count && state.Tables.TryGetValue(param, out var handle))
                return handle + (register - baseRegister);
        return null;
    }

    private List<(int Param, int Base, int Count)>? srvTables;

    private List<(int Param, int Base, int Count)> SrvTables()
    {
        var ranges = new Dictionary<string, (int Base, int Count)>(StringComparer.Ordinal);
        foreach (Match m in Regex.Matches(src.Code, @"(\w+(?:\[\d+\])?)\s*\.\s*Init\s*\(\s*D3D12_DESCRIPTOR_RANGE_TYPE_SRV\s*,\s*([^,]+),\s*([^,)]+)"))
            if (src.Int(m.Groups[2].Value) is int count && src.Int(m.Groups[3].Value) is int baseRegister)
                ranges[Regex.Replace(m.Groups[1].Value, @"\s+", "")] = (baseRegister, count);
        var list = new List<(int, int, int)>();
        foreach (Match m in Regex.Matches(src.Code, @"rootParameters\s*\[\s*(\d+)\s*\]\s*\.\s*InitAsDescriptorTable\s*\(\s*\d+\s*,\s*&\s*(\w+(?:\s*\[\s*\d+\s*\])?)"))
            if (ranges.TryGetValue(Regex.Replace(m.Groups[2].Value, @"\s+", ""), out var r)) list.Add((int.Parse(m.Groups[1].Value), r.Base, r.Count));
        return list;
    }

    /// <summary>The texture sizes of the last DeviceTextures call (GetDimensions, textureSize).</summary>
    private Func<string, (int Width, int Height)?>? deviceTextureSizes;
    /// <summary>The cube maps of the last DeviceTextures call read at a mip level (SampleLevel).</summary>
    private Func<string, double, double, double, double, double[]?>? deviceCubeLod;

    /// <summary>
    /// Static samplers: each description (sampler, samplers[0], samplers[1] …) by its ShaderRegister – a description
    /// copied from another (samplers[1] = samplers[0];) keeps the other's fields it does not set itself. The HLSL
    /// Sample(…) call names the sampler, whose register picks the description.
    /// </summary>
    private Func<string?, Codestead.GP.Gpu.Textures.SamplerState> SamplersByRegister(ShaderProgram vs, ShaderProgram ps)
    {
        var byRegister = new Dictionary<int, Codestead.GP.Gpu.Textures.SamplerState>();
        var targets = src.FieldAssignments("Filter").Select(a => a.Target).Concat(src.FieldAssignments("AddressU").Select(a => a.Target)).Distinct().ToList();
        string? Copied(string t) =>
            Regex.Match(src.Code, @"(?<![\w.])" + Regex.Escape(t) + @"\s*=\s*([A-Za-z_]\w*(?:\[\d+\])?)\s*;") is { Success: true } m ? m.Groups[1].Value : null;
        string? FieldOf(string t, string f, int depth = 0) =>
            src.FieldAssignments(f).Where(a => a.Target == t).Select(a => a.Value).LastOrDefault()
            ?? (depth < 3 && Copied(t) is { } from ? FieldOf(from, f, depth + 1) : null);
        for (int i = 0; i < targets.Count; i++)
        {
            var t = targets[i];
            var reg = src.FieldAssignments("ShaderRegister").Where(a => a.Target == t).Select(a => src.Int(a.Value)).LastOrDefault() ?? (Regex.Match(t, @"\[(\d+)\]") is { Success: true } m ? int.Parse(m.Groups[1].Value) : i);
            byRegister[reg] = TextureBinding.FromFields(f => FieldOf(t, f), d3d: true);
        }
        var samplerRegister = vs.Globals.Concat(ps.Globals).Where(g => g.Type.StartsWith("SamplerState", StringComparison.Ordinal)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        var fallback = byRegister.GetValueOrDefault(0) ?? byRegister.Values.FirstOrDefault() ?? Codestead.GP.Gpu.Textures.SamplerState.Default;
        return name => name is not null && samplerRegister.TryGetValue(name, out var r) && byRegister.TryGetValue(r, out var state) ? state : fallback;
    }

    /// <summary>
    /// A Model::Draw (the course's port of learnopengl's Model class): one draw per mesh, vertices by the input layout's
    /// semantics (POSITION, NORMAL, TEXCOORD – v flipped with aiProcess_FlipUVs), and the mesh's diffuse / specular maps
    /// as the shader's first and second Texture2D.
    /// </summary>
    private void ModelDraws(ShaderProgram vs, ShaderProgram ps, string vsEntry, string psEntry, Dictionary<string, ShaderValue> values, CullMode cull, bool frontCcw, bool depth,
        ShaderProgram? gs = null, string gsEntry = "main", FrameRecorder.RecordedDraw? recorded = null, string? target = null)
    {
        // The model of the draw: the .obj its Load call names (m_rock.Load("models/rock.obj", …)), else the first one.
        var path = recorded?.ModelName is { } modelName && Regex.Match(src.Code, Regex.Escape(modelName) + @"\s*(?:\.|->)\s*Load\s*\(\s*""([^""]+\.obj)""") is { Success: true } lm
            ? lm.Groups[1].Value : Models.ModelFiles.Path(src);
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
                Target = target,
                VertexShader = vs,
                FragmentShader = ps,
                VertexEntry = vsEntry,
                FragmentEntry = psEntry,
                GeometryShader = gs,
                GeometryEntry = gsEntry,
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
            var file = src.StringValue(c.Arg(0), c.Offset) ?? "";
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

    /// <summary>
    /// The cbuffers bound as root constant buffer views (SetGraphicsRootConstantBufferView(i, address)): root parameter i
    /// is rootParameters[i].InitAsConstantBufferView(register), its values read from the buffer's memory.
    /// </summary>
    private void RootCbvValues(D3D12Device device, FrameRecorder.RecordedDraw d, List<ShaderAst.Global> blocks, Dictionary<string, ShaderValue> values)
    {
        if (d.State is not D3D12Device.DrawState { RootCbvs: { Count: > 0 } cbvs }) return;
        foreach (var (param, address) in cbvs)
        {
            var m = Regex.Matches(src.Code, @"(\w+)\s*\[\s*" + param + @"\s*\]\s*\.\s*InitAsConstantBufferView\s*\(\s*(\d+)").LastOrDefault();
            int register = m is null ? param : int.Parse(m.Groups[2].Value);
            if (blocks.FirstOrDefault(b => b.Binding == register && b.Block is not null) is not { } block) continue;
            if (device.CbufferAt(address, block.Block!, StructLayout.FloatsOf) is { } read)
                foreach (var (k, v) in read) values[k] = v;
        }
    }
}
