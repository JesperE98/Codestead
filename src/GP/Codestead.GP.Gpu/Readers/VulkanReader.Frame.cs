using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// One frame: the clear value of the render pass, the graphics pipeline and the draw command recorded in
// recordCommandBuffer, with its vertex/index buffers and push constants.
public sealed partial class VulkanReader
{
    private void Frame(bool dynamicRendering)
    {
        // The clear colour: VkClearValue clearColor = {{{0.2f, 0.3f, 0.3f, 1.0f}}}; and loadOp CLEAR.
        var begin = src.Calls(dynamicRendering ? "vkCmdBeginRendering" : "vkCmdBeginRenderPass").FirstOrDefault();
        var end = src.Calls(dynamicRendering ? "vkCmdEndRendering" : "vkCmdEndRenderPass").FirstOrDefault();
        if (begin is null || end is null)
        {
            scene.Notes.Add(SimNote.Info("vkNoRenderPassBegin"));
            return;
        }
        var loadOp = src.LastFieldValue("loadOp");
        var clearVar = Regex.Match(src.Code, @"\bVkClearValue\s+(\w+)");
        // std::array<VkClearValue, 2> clearValues{}; clearValues[0].color = {{0.2f, 0.3f, 0.3f, 1.0f}};
        var colorField = Regex.Match(src.Code, @"(\w+)\s*\[\s*0\s*\]\s*\.\s*color\s*=\s*(\{[^;]*\})\s*;");
        var clearNumbers = colorField.Success ? src.Numbers(colorField.Groups[2].Value) : clearVar.Success ? src.Numbers(clearVar.Groups[1].Value) : null;
        if (loadOp is not null && loadOp.Contains("CLEAR", StringComparison.Ordinal) && clearNumbers is { Count: >= 4 } c)
            scene.ClearColor = [c[0], c[1], c[2], c[3]];
        else if (loadOp is not null && !loadOp.Contains("CLEAR", StringComparison.Ordinal))
            scene.Notes.Add(SimNote.Warning("vkLoadOpNotClear", ("value", loadOp)));
        Draw(begin.Offset, end.Offset);
    }

    private void Draw(int beginOffset, int endOffset)
    {
        var draw = src.Calls("vkCmdDraw").FirstOrDefault();
        var drawIndexed = src.Calls("vkCmdDrawIndexed").FirstOrDefault();
        var call = drawIndexed ?? draw;
        if (call is null) return;
        if (call.Offset < beginOffset || call.Offset > endOffset)
        {
            scene.Notes.Add(SimNote.Error("vkDrawOutsideRenderPass", ("call", call.Name)));
            return;
        }
        if (!Reached("vkCreateGraphicsPipelines") || !src.HasCall("vkCmdBindPipeline"))
        {
            scene.Notes.Add(SimNote.Error("vkNoPipelineBound", ("call", call.Name)));
            return;
        }
        // Dynamic viewport and scissor must be set before drawing.
        foreach (var (state, setter) in new[] { ("VK_DYNAMIC_STATE_VIEWPORT", "vkCmdSetViewport"), ("VK_DYNAMIC_STATE_SCISSOR", "vkCmdSetScissor") })
            if (src.Uses(state) && !src.HasCall(setter))
            {
                scene.Notes.Add(SimNote.Error("vkDynamicStateNotSet", ("state", state), ("call", setter)));
                return;
            }

        var vs = Shader(".vert", "vert");
        var fs = Shader(".frag", "frag");
        // One pipeline: its own shaders (by the file names it was created with), not just the first in the project.
        var created = Pipelines();
        if (created.Count == 1)
        {
            vs = created.Values.First().Vs;
            fs = created.Values.First().Fs;
        }
        if (vs is null || fs is null) return;

        var inputs = vs.Globals.Where(g => g.Storage == "in").ToList();
        var vertices = new List<Dictionary<string, ShaderValue>>();
        if (inputs.Count > 0 && !VertexData(inputs, vertices)) return;

        int[]? indices = null;
        int first = 0, count;
        int instances;
        if (call == drawIndexed)
        {
            if (!src.HasCall("vkCmdBindIndexBuffer"))
            {
                scene.Notes.Add(SimNote.Error("vkNoIndexBuffer"));
                return;
            }
            var data = modelIndices ?? src.Numbers("indices");
            if (data is null)
            {
                scene.Notes.Add(SimNote.Error("vkNoIndexBuffer"));
                return;
            }
            count = src.Int(call.Arg(1)) ?? 0;
            instances = src.Int(call.Arg(2)) ?? 1;
            int firstIndex = src.Int(call.Arg(3)) ?? 0;
            indices = data.Skip(firstIndex).Take(count).Select(d => (int)d).ToArray();
        }
        else
        {
            count = src.Int(call.Arg(1)) ?? 0;
            instances = src.Int(call.Arg(2)) ?? 1;
            first = src.Int(call.Arg(3)) ?? 0;
        }
        if (inputs.Count > 0 && vertices.Count < (indices is null ? first + count : (indices.Length == 0 ? 0 : indices.Max() + 1)))
            scene.Notes.Add(SimNote.Warning("readsPastEnd", ("call", call.Name), ("line", call.Line.ToString())));

        var cull = src.LastFieldValue("cullMode") ?? "VK_CULL_MODE_NONE";
        var front = src.LastFieldValue("frontFace") ?? "VK_FRONT_FACE_COUNTER_CLOCKWISE";
        var polygon = src.LastFieldValue("polygonMode") ?? "VK_POLYGON_MODE_FILL";
        bool wireframe = polygon.Contains("LINE", StringComparison.Ordinal);
        if (wireframe && !Regex.IsMatch(src.Code, @"fillModeNonSolid\s*=\s*VK_TRUE"))
            scene.Notes.Add(SimNote.Error("vkFillModeNonSolid"));

        var uniforms = PushConstants(vs, fs);
        var textures = Textures(vs, fs);
        var cullMode = cull.Contains("FRONT_AND_BACK", StringComparison.Ordinal) ? CullMode.FrontAndBack : cull.Contains("BACK", StringComparison.Ordinal) ? CullMode.Back : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.None;
        bool frontCcw = !front.Contains("_CLOCKWISE", StringComparison.Ordinal) || front.Contains("COUNTER_CLOCKWISE", StringComparison.Ordinal);
        var topology = GlReader.TopologyOf(src.LastFieldValue("topology") ?? "TRIANGLE_LIST");
        bool depthTest = Regex.IsMatch(src.Code, @"depthTestEnable\s*=\s*VK_TRUE");
        var pipeState = PipelineState.Vulkan(src.LastFieldValue, f => src.LastFieldValue(f) is { } v ? src.Int(v) : null);

        // Run the frame: the uniform buffer update and the recorded commands (each draw with its push constants).
        var blocks = vs.Globals.Concat(fs.Globals).Where(g => g.Block is not null).ToList();
        var recorder = new FrameRecorder(src, time, scene, blocks, transposeMatrices: false);
        foreach (var fn in UpdateFunctions(blocks)) recorder.Run(fn);
        if (src.FunctionAt(call.Offset) is { } recordFn) recorder.Run(recordFn);
        var buffer = recorder.BufferContents();
        var indexData = drawIndexed is not null ? modelIndices ?? src.Numbers("indices") : null;
        var pipelines = recorder.Draws.Any(d => d.Pipeline is not null) ? Pipelines() : new();
        if (recorder.Draws.Count > 0)
        {
            foreach (var d in recorder.Draws)
            {
                // With several pipelines, the draw uses the one bound before it.
                var pl = d.Pipeline is not null && pipelines.Count > 1 && pipelines.TryGetValue(d.Pipeline, out var p) ? p : null;
                var dvs = pl?.Vs ?? vs;
                var dfs = pl?.Fs ?? fs;
                var dVertices = vertices;
                if (pl is not null)
                {
                    var dInputs = dvs.Globals.Where(g => g.Storage == "in").ToList();
                    dVertices = new List<Dictionary<string, ShaderValue>>();
                    if (dInputs.Count > 0 && !VertexData(dInputs, dVertices)) continue;
                }
                var values = new Dictionary<string, ShaderValue>(buffer, StringComparer.Ordinal);
                foreach (var (k, v) in d.Constants) values[k] = v;
                scene.Draws.Add(new DrawCall
                {
                    VertexShader = dvs,
                    FragmentShader = dfs,
                    MatchByLocation = true,
                    Vertices = dVertices,
                    Indices = d.Indexed ? indexData?.Skip(d.First).Take(d.Count).Select(x => (int)x).ToArray() : null,
                    First = d.Indexed ? 0 : d.First,
                    Count = d.Count,
                    Instances = Math.Max(1, d.Instances),
                    Topology = pl?.Topology ?? topology,
                    Uniforms = _ => values,
                    Cull = pl?.Cull ?? cullMode,
                    FrontCcw = pl?.FrontCcw ?? frontCcw,
                    Wireframe = pl?.Wireframe ?? wireframe,
                    DepthTest = pl?.DepthTest ?? depthTest,
                    DepthFunc = (pl?.State ?? pipeState).DepthFunc,
                    DepthWrite = (pl?.State ?? pipeState).DepthWrite,
                    Stencil = (pl?.State ?? pipeState).Stencil is { } st ? st with { Ref = d.StencilRef ?? st.Ref } : null,
                    Blend = (pl?.State ?? pipeState).Blend,
                    Textures = PerDrawTextures(dvs, dfs, d.Bound) ?? (pl is null ? textures : Textures(dvs, dfs) ?? textures),
                });
            }
            if (recorder.Runner.UsedTime) scene.Animated = true;
            return;
        }
        scene.Draws.Add(new DrawCall
        {
            VertexShader = vs,
            FragmentShader = fs,
            MatchByLocation = true,
            Vertices = vertices,
            Indices = indices,
            First = first,
            Count = indices?.Length ?? count,
            Instances = Math.Max(1, instances),
            Topology = topology,
            Uniforms = uniforms,
            Cull = cullMode,
            FrontCcw = frontCcw,
            Wireframe = wireframe,
            DepthTest = depthTest,
            DepthFunc = pipeState.DepthFunc,
            DepthWrite = pipeState.DepthWrite,
            Stencil = pipeState.Stencil,
            Blend = pipeState.Blend,
            Textures = textures,
        });
        foreach (var d in scene.Draws) d.Uniforms(1.0);
        if (src.UsedTime) scene.Animated = true;
    }

    /// <summary>
    /// Textures: each sampler2D (by binding) reads the next image loaded with stbi_load. It takes the whole chain of the
    /// tutorial: a texture image filled from a staging buffer, an image view, a sampler and a descriptor set bound when
    /// drawing; without one of them the shader reads nothing (black) and the validation layer complains.
    /// </summary>
    private Func<string, double, double, double[]>? Textures(ShaderProgram vs, ShaderProgram fs)
    {
        var names = TextureBinding.ShaderTextures(vs, fs);
        if (names.Count == 0) return null;
        var missing = new (string Call, string Key)[]
        {
            ("vkCreateDescriptorSetLayout", "vkNoDescriptorSetLayout"),
            ("vkUpdateDescriptorSets", "vkNoDescriptorWrite"),
            ("vkCmdBindDescriptorSets", "vkNoDescriptorBind"),
            ("vkCreateSampler", "vkNoSampler"),
            ("vkCmdCopyBufferToImage", "vkNoImageCopy"),
        }.FirstOrDefault(m => !src.HasCall(m.Call));
        if (missing.Call is not null)
        {
            scene.Notes.Add(SimNote.Error(missing.Key, ("name", names[0])));
            return (_, _, _) => [0, 0, 0, 1];
        }
        if (!src.HasCall("vkCmdPipelineBarrier")) scene.Notes.Add(SimNote.Error("vkNoLayoutTransition"));
        var images = StbImage.InLoadOrder(src, project, scene);
        if (images.Count < names.Count) scene.Notes.Add(SimNote.Warning("tooFewTextures", ("count", names.Count.ToString()), ("loaded", images.Count.ToString())));
        // Each vkCreateSampler(…, &name) takes the sampler fields set before it; each binding gets the sampler of the
        // image info its descriptor write points to (info.sampler = name; descriptorWrites[i].pImageInfo = &info).
        var samplers = Samplers();
        var infoSampler = Regex.Matches(src.Code, @"(\w+)\s*\.\s*sampler\s*=\s*(\w+)").GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => g.Last().Groups[2].Value);
        var writeInfo = Regex.Matches(src.Code, @"descriptorWrites\s*\[\s*(\d+)\s*\]\s*\.\s*pImageInfo\s*=\s*&\s*(\w+)").GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => g.Last().Groups[2].Value);
        var writeBinding = Regex.Matches(src.Code, @"descriptorWrites\s*\[\s*(\d+)\s*\]\s*\.\s*dstBinding\s*=\s*(\d+)").GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => int.Parse(g.Last().Groups[2].Value));
        var bindingOf = vs.Globals.Concat(fs.Globals).Where(g => names.Contains(g.Id)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        var fallback = samplers.Values.FirstOrDefault() ?? Codestead.GP.Gpu.Textures.SamplerState.Default;
        return TextureBinding.Bind(names, images, (texture, _) =>
        {
            var write = writeBinding.FirstOrDefault(w => w.Value == bindingOf.GetValueOrDefault(texture)).Key;
            if (write is not null && writeInfo.TryGetValue(write, out var info) && infoSampler.TryGetValue(info, out var samplerName) && samplers.TryGetValue(samplerName, out var state))
                return state;
            return fallback;
        });
    }

    /// <summary>
    /// Each vkCreateSampler(…, &amp;name) with the sampler fields set before it – also in a helper called once per sampler,
    /// createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, transparentSampler), with the call's arguments.
    /// </summary>
    private Dictionary<string, Codestead.GP.Gpu.Textures.SamplerState> Samplers()
    {
        var samplers = new Dictionary<string, Codestead.GP.Gpu.Textures.SamplerState>(StringComparer.Ordinal);
        foreach (var create in src.Calls("vkCreateSampler"))
        {
            var name = create.Arg(3).Trim().TrimStart('&').Trim();
            var fn = src.FunctionAt(create.Offset);
            var parameters = fn is null ? [] : Parameters(fn);
            if (fn is not null && parameters.Contains(name))
            {
                var (start, _) = src.Functions[fn];
                foreach (var call in src.Calls(fn))
                {
                    string Sub(string x) => parameters.IndexOf(x.Trim()) is int i and >= 0 ? call.Arg(i).Trim() : x;
                    var callName = Sub(name).TrimStart('&').Trim();
                    samplers[callName] = TextureBinding.FromFields(f => src.FieldAssignments(f).Where(a => a.Offset >= start && a.Offset < create.Offset).Select(a => Sub(a.Value)).LastOrDefault(), d3d: false);
                }
                continue;
            }
            samplers[name] = TextureBinding.FromFields(f => src.FieldValueBefore(f, create.Offset), d3d: false);
        }
        return samplers;
    }

    /// <summary>
    /// The textures of one draw when its descriptor set (bound with vkCmdBindDescriptorSets) was written by a helper
    /// with a view made by a texture-loading helper (see <see cref="DrawTextures"/>); null otherwise.
    /// </summary>
    private Func<string, double, double, double[]>? PerDrawTextures(ShaderProgram vs, ShaderProgram fs, IReadOnlyDictionary<int, string>? bound)
    {
        if (bound is null || !bound.TryGetValue(0, out var setText)) return null;
        drawTextures ??= new DrawTextures(src, project);
        if (!drawTextures.Any) return null;
        var samplers = Samplers();
        var set = drawTextures.VulkanSet(setText, n => samplers.GetValueOrDefault(n));
        if (set is null) return null;
        var bindingOf = vs.Globals.Concat(fs.Globals).Where(g => g.Type.StartsWith("sampler", StringComparison.Ordinal)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        var textures = new Dictionary<string, Codestead.GP.Gpu.Textures.Texture>(StringComparer.Ordinal);
        foreach (var (name, binding) in bindingOf)
            if (set.TryGetValue(binding, out var t)) textures[name] = new Codestead.GP.Gpu.Textures.Texture(t.Image, t.Sampler) { Components = t.Image.Channels == 4 ? 4 : 3 };
        return (id, u, v) => textures.TryGetValue(id.Split('|')[0], out var tex) ? tex.Sample(u, v) : [0, 0, 0, 1];
    }

    private DrawTextures? drawTextures;

    /// <summary>The functions that fill a uniform buffer struct (updateUniformBuffer): they declare a variable of a block's type.</summary>
    private IEnumerable<string> UpdateFunctions(List<ShaderAst.Global> blocks) =>
        blocks.Where(b => !b.PushConstant).SelectMany(b => src.Functions.Keys.Where(f => src.FunctionBody(f) is { } body && Regex.IsMatch(body, @"\b" + Regex.Escape(b.Type) + @"\s+\w+\s*[{=;]"))).Distinct();

    /// <summary>The shader loaded from "shaders/vert.spv" is the one built from the project's .vert file.</summary>
    private ShaderProgram? Shader(string extension, string spvHint)
    {
        // readFile("shaders/vert.spv"), or a helper called with the file names: createPipeline("shaders/lighting.vert.spv", …).
        bool loaded = src.HasCall("readFile") && Regex.IsMatch(src.Code, "\"[^\"\\n]*" + Regex.Escape(spvHint) + "[^\"\\n]*\\.spv\"");
        var file = project.Files.Keys.FirstOrDefault(k => k.EndsWith(extension, StringComparison.Ordinal));
        if (!loaded || file is null)
        {
            scene.Notes.Add(SimNote.Error("vkShaderNotLoaded", ("file", $"shaders/{spvHint}.spv")));
            return null;
        }
        try
        {
            return ShaderParser.ParseProgram(project.Files[file]);
        }
        catch (ShaderSyntaxException)
        {
            return null; // The build already reported it.
        }
    }

    /// <summary>The vertices: std::vector&lt;Vertex&gt; vertices = { … } mapped to locations by getAttributeDescriptions.</summary>
    private bool VertexData(List<ShaderAst.Global> inputs, List<Dictionary<string, ShaderValue>> into)
    {
        if (!src.HasCall("vkCmdBindVertexBuffers") || !Regex.IsMatch(src.Code, @"vertexBindingDescriptionCount\s*=\s*[^0\s;]"))
        {
            scene.Notes.Add(SimNote.Error("vkNoVertexInput", ("name", inputs[0].Id), ("location", (inputs[0].Location ?? 0).ToString())));
            return false;
        }
        var type = src.DeclaredType("vertices") ?? "";
        var structName = Regex.Match(type, @"<\s*(\w+)\s*>").Groups[1].Value;
        var fields = structName == "" ? null : StructLayout.Fields(src, structName);
        if (fields is not null && src.HasCall("LoadObj"))
        {
            if (!ModelVertices(fields, into)) return false;
            // indices.size() and vertices.size() are the loaded model's.
            int vertexCount = into.Count;
            src.Extra = name => name switch
            {
                "indices" => ShaderValue.Array(modelIndices!.Select(ShaderValue.Scalar).ToArray()),
                "vertices" => ShaderValue.Array(Enumerable.Range(0, vertexCount).Select(_ => ShaderValue.Scalar(0)).ToArray()),
                _ => null,
            };
            return true;
        }
        var init = src.Initializer("vertices");
        if (fields is null || init is null)
        {
            scene.Notes.Add(SimNote.Error("vkNoVertexInput", ("name", inputs[0].Id), ("location", (inputs[0].Location ?? 0).ToString())));
            return false;
        }
        // location → field, from attributeDescriptions[i].location = L; attributeDescriptions[i].offset = offsetof(Vertex, field);
        var locationOf = new Dictionary<string, int>();
        var locs = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location\s*=\s*(\d+)").GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => int.Parse(g.Last().Groups[2].Value));
        foreach (Match m in Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*offset\s*=\s*offsetof\s*\(\s*\w+\s*,\s*(\w+)\s*\)"))
            if (locs.TryGetValue(m.Groups[1].Value, out var loc)) locationOf[m.Groups[2].Value] = loc;
        var arraySize = Regex.Match(src.Code, @"std::array\s*<\s*VkVertexInputAttributeDescription\s*,\s*(\d+)\s*>");
        int described = arraySize.Success ? int.Parse(arraySize.Groups[1].Value) : locs.Count;
        foreach (var input in inputs)
        {
            int loc = input.Location ?? 0;
            bool provided = locs.Count > 0 ? locationOf.ContainsValue(loc) && loc < Math.Max(described, 1) : loc < fields.Count;
            if (!provided) scene.Notes.Add(SimNote.Error("vkAttributeMissing", ("name", input.Id), ("location", loc.ToString())));
        }
        var value = src.Evaluate(init);
        if (value?.Items is null && value?.V is null) return false;
        var items = value.Items ?? [value];
        foreach (var item in items)
        {
            var nums = new List<double>();
            Flatten(item, nums);
            var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            int at = 0;
            for (int f = 0; f < fields.Count; f++)
            {
                var (_, name, floats) = fields[f];
                var comps = nums.Skip(at).Take(floats).ToArray();
                at += floats;
                int loc = locationOf.TryGetValue(name, out var l) ? l : f;
                if (locs.Count == 0 || locationOf.ContainsKey(name)) dict[loc.ToString()] = ShaderValue.Vec(comps);
            }
            into.Add(dict);
        }
        return true;
    }

    /// <summary>The indices of a model loaded with tinyobjloader (null when the program has none).</summary>
    private List<double>? modelIndices;

    /// <summary>
    /// vulkan-tutorial's loadModel: tinyobj::LoadObj fills vertices and indices – positions, texCoord with v flipped
    /// (1 - v), colour white, a normal when the Vertex struct has one, and a material index (shapes' material_ids) in a
    /// field named like materialIndex / texIndex – for every mesh of the file.
    /// </summary>
    private bool ModelVertices(List<(string Type, string Name, int Floats)> fields, List<Dictionary<string, ShaderValue>> into)
    {
        var path = Models.ModelFiles.Path(src);
        var model = path is null ? null : Models.ObjModel.Load(project, path);
        if (model is null)
        {
            scene.Notes.Add(SimNote.Error("modelFileMissing", ("file", path ?? "?")));
            return false;
        }
        var locs = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location\s*=\s*(\d+)").GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => int.Parse(g.Last().Groups[2].Value));
        var locationOf = new Dictionary<string, int>();
        foreach (Match m in Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*offset\s*=\s*offsetof\s*\(\s*\w+\s*,\s*(\w+)\s*\)"))
            if (locs.TryGetValue(m.Groups[1].Value, out var loc)) locationOf[m.Groups[2].Value] = loc;
        modelIndices = new List<double>();
        foreach (var mesh in model.Meshes)
        {
            int baseVertex = into.Count;
            for (int i = 0; i < mesh.Positions.Count; i++)
            {
                var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                for (int f = 0; f < fields.Count; f++)
                {
                    var name = fields[f].Name;
                    var value = name.Contains("material", StringComparison.OrdinalIgnoreCase) || name.Contains("index", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Scalar(mesh.Material?.Index ?? -1)
                        : name.Contains("pos", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Positions[i])
                        : name.Contains("tex", StringComparison.OrdinalIgnoreCase) || name.Contains("uv", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.TexCoords[i][0], 1 - mesh.TexCoords[i][1])
                        : name.Contains("normal", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Normals[i])
                        : ShaderValue.Vec(1, 1, 1);
                    dict[(locationOf.TryGetValue(name, out var l) ? l : f).ToString()] = value;
                }
                into.Add(dict);
            }
            modelIndices.AddRange(mesh.Indices.Select(x => (double)(x + baseVertex)));
        }
        return true;
    }

    private static void Flatten(ShaderValue v, List<double> into)
    {
        if (v.V is not null) into.AddRange(v.V);
        else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into);
    }

    /// <summary>
    /// Push constants: the shader's layout(push_constant) block type matches a C++ struct of the same name; the
    /// fields assigned to a variable of that type (pc.color = glm::vec4(…)) are the values, at any time.
    /// </summary>
    private Func<double, Dictionary<string, ShaderValue>> PushConstants(ShaderProgram vs, ShaderProgram fs)
    {
        var block = vs.Globals.Concat(fs.Globals).FirstOrDefault(g => g.PushConstant && g.Block is not null);
        if (block is null) return _ => new();
        if (!src.HasCall("vkCmdPushConstants"))
        {
            scene.Notes.Add(SimNote.Warning("vkPushConstantsNotPushed", ("type", block.Type)));
            return _ => new();
        }
        if (!Regex.IsMatch(src.Code, @"pushConstantRangeCount\s*=\s*[1-9]"))
            scene.Notes.Add(SimNote.Error("vkNoPushConstantRange"));
        var variables = Regex.Matches(src.Code, @"\b" + Regex.Escape(block.Type) + @"\s+(\w+)\s*(?:\{[^;]*\}|=[^;]*)?\s*;").Select(m => m.Groups[1].Value).ToHashSet();
        var assignments = new List<(string Field, string Expr)>();
        foreach (var field in block.Block!)
            foreach (var a in src.FieldAssignments(field.Id))
                if (variables.Contains(a.Target)) assignments.Add((field.Id, a.Value));
        return t =>
        {
            var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var (field, expr) in assignments)
                if (src.Evaluate(expr, t) is { } v) d[field] = v;
            return d;
        };
    }
}
