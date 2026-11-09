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
        if (loadOp is not null && loadOp.Contains("CLEAR", StringComparison.Ordinal) && clearVar.Success
            && src.Numbers(clearVar.Groups[1].Value) is { Count: >= 4 } c)
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
            var data = src.Numbers("indices");
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

        // Run the frame: the uniform buffer update and the recorded commands (each draw with its push constants).
        var blocks = vs.Globals.Concat(fs.Globals).Where(g => g.Block is not null).ToList();
        var recorder = new FrameRecorder(src, time, scene, blocks, transposeMatrices: false);
        foreach (var fn in UpdateFunctions(blocks)) recorder.Run(fn);
        if (src.FunctionAt(call.Offset) is { } recordFn) recorder.Run(recordFn);
        var buffer = recorder.BufferContents();
        var indexData = drawIndexed is not null ? src.Numbers("indices") : null;
        if (recorder.Draws.Count > 0)
        {
            foreach (var d in recorder.Draws)
            {
                var values = new Dictionary<string, ShaderValue>(buffer, StringComparer.Ordinal);
                foreach (var (k, v) in d.Constants) values[k] = v;
                scene.Draws.Add(new DrawCall
                {
                    VertexShader = vs,
                    FragmentShader = fs,
                    MatchByLocation = true,
                    Vertices = vertices,
                    Indices = d.Indexed ? indexData?.Skip(d.First).Take(d.Count).Select(x => (int)x).ToArray() : null,
                    First = d.Indexed ? 0 : d.First,
                    Count = d.Count,
                    Instances = Math.Max(1, d.Instances),
                    Topology = topology,
                    Uniforms = _ => values,
                    Cull = cullMode,
                    FrontCcw = frontCcw,
                    Wireframe = wireframe,
                    DepthTest = depthTest,
                    Textures = textures,
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
        var images = StbImage.All(src, project, scene);
        if (images.Count < names.Count) scene.Notes.Add(SimNote.Warning("tooFewTextures", ("count", names.Count.ToString()), ("loaded", images.Count.ToString())));
        var sampler = new Codestead.GP.Gpu.Textures.SamplerState(
            StbImage.WrapOf(src.LastFieldValue("addressModeU")), StbImage.WrapOf(src.LastFieldValue("addressModeV")),
            !(src.LastFieldValue("magFilter") ?? "LINEAR").Contains("NEAREST", StringComparison.Ordinal),
            (src.LastFieldValue("borderColor") ?? "").Contains("WHITE", StringComparison.Ordinal) ? [1, 1, 1, 1] : (src.LastFieldValue("borderColor") ?? "").Contains("OPAQUE_BLACK", StringComparison.Ordinal) ? [0, 0, 0, 1] : null);
        return TextureBinding.Bind(names, images, sampler);
    }

    /// <summary>The functions that fill a uniform buffer struct (updateUniformBuffer): they declare a variable of a block's type.</summary>
    private IEnumerable<string> UpdateFunctions(List<ShaderAst.Global> blocks) =>
        blocks.Where(b => !b.PushConstant).SelectMany(b => src.Functions.Keys.Where(f => src.FunctionBody(f) is { } body && Regex.IsMatch(body, @"\b" + Regex.Escape(b.Type) + @"\s+\w+\s*[{=;]"))).Distinct();

    /// <summary>The shader loaded from "shaders/vert.spv" is the one built from the project's .vert file.</summary>
    private ShaderProgram? Shader(string extension, string spvHint)
    {
        bool loaded = src.Calls("readFile").Any(c => (CppSource.StringArg(c.Arg(0)) ?? "").Contains(spvHint, StringComparison.Ordinal));
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
        var init = src.Initializer("vertices");
        if (fields is null || init is null)
        {
            scene.Notes.Add(SimNote.Error("vkNoVertexInput", ("name", inputs[0].Id), ("location", (inputs[0].Location ?? 0).ToString())));
            return false;
        }
        // location → field, from attributeDescriptions[i].location = L; attributeDescriptions[i].offset = offsetof(Vertex, field);
        var locationOf = new Dictionary<string, int>();
        var locs = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location\s*=\s*(\d+)").ToDictionary(m => m.Groups[1].Value, m => int.Parse(m.Groups[2].Value));
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
