using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// Several graphics pipelines (the lighting chapters draw the lit object and the lamp with different shaders): each
// vkCreateGraphicsPipelines(…, &name) with the shaders read before it – also through a helper function called with
// the file names, e.g. createPipeline("shaders/lighting.vert.spv", "shaders/lighting.frag.spv", lightingPipeline).
public sealed partial class VulkanReader
{
    private Dictionary<string, PipelineInfo> Pipelines()
    {
        var result = new Dictionary<string, PipelineInfo>(StringComparer.Ordinal);
        foreach (var create in src.Calls("vkCreateGraphicsPipelines"))
        {
            var fn = src.FunctionAt(create.Offset);
            if (fn is null || !src.Functions.TryGetValue(fn, out var range)) continue;
            var outVar = create.Arg(5).Trim().TrimStart('&').Trim();
            var reads = src.Calls("readFile", range.Start, create.Offset).Select(c => c.Arg(0).Trim()).ToList();
            var parameters = Parameters(fn);
            // A helper: one pipeline per call of it, with the call's arguments for the parameters.
            var sites = parameters.Count > 0 && (parameters.Contains(outVar) || reads.Any(parameters.Contains))
                ? src.Calls(fn).Select(c => parameters.Select((p, i) => (p, c.Arg(i))).ToDictionary(x => x.p, x => x.Item2)).ToList()
                : [new Dictionary<string, string>()];
            foreach (var args in sites)
            {
                string Sub(string x) => args.TryGetValue(x, out var v) ? v.Trim() : x;
                var name = Sub(outVar).TrimStart('&').Trim();
                var files = reads.Select(r => CppSource.StringArg(Sub(r))).Where(f => f is not null).Select(f => f!).ToList();
                var vs = ShaderFor(files.FirstOrDefault(f => f.Contains("vert", StringComparison.Ordinal)), ".vert");
                var fs = ShaderFor(files.FirstOrDefault(f => f.Contains("frag", StringComparison.Ordinal)), ".frag");
                if (vs is null || fs is null) continue;
                // A geometry stage: a .geom file named for this pipeline (createPipeline(…, "shaders/x.geom.spv", …)).
                var gsFile = files.FirstOrDefault(f => f.Contains(".geom", StringComparison.Ordinal));
                var gs = gsFile is null ? null : ShaderFor(gsFile, ".geom", exact: true);
                string Field(string f, string fallback) =>
                    src.FieldAssignments(f).Where(a => a.Offset >= range.Start && a.Offset < create.Offset).Select(a => Sub(a.Value)).LastOrDefault() ?? fallback;
                var cull = Field("cullMode", "VK_CULL_MODE_NONE");
                var front = Field("frontFace", "VK_FRONT_FACE_COUNTER_CLOCKWISE");
                // An array of blend attachment states (std::array<VkPipelineColorBlendAttachmentState, 2>, set element by
                // element): each attachment's own fields, attachmentCount of them.
                List<Func<string, string?>>? attachments = null;
                if (src.FieldAssignments("blendEnable").Any(a => a.Offset >= range.Start && a.Offset < create.Offset && Regex.IsMatch(a.Target, @"\[\s*\d+\s*\]$")))
                {
                    int count = Math.Clamp(src.Int(Field("attachmentCount", "1")) ?? 1, 1, 8);
                    attachments = Enumerable.Range(0, count).Select(i => (Func<string, string?>)(f => src.FieldAssignments(f)
                        .Where(a => a.Offset >= range.Start && a.Offset < create.Offset && (Regex.Match(a.Target, @"\[\s*(\d+)\s*\]$") is { Success: true } m ? int.Parse(m.Groups[1].Value) == i : true))
                        .Select(a => Sub(a.Value)).LastOrDefault())).ToList();
                }
                result[name] = new PipelineInfo(name, vs, fs, "main", "main",
                    cull.Contains("FRONT_AND_BACK", StringComparison.Ordinal) ? CullMode.FrontAndBack : cull.Contains("BACK", StringComparison.Ordinal) ? CullMode.Back : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.None,
                    !front.Contains("_CLOCKWISE", StringComparison.Ordinal) || front.Contains("COUNTER_CLOCKWISE", StringComparison.Ordinal),
                    Field("polygonMode", "FILL").Contains("LINE", StringComparison.Ordinal),
                    Regex.IsMatch(Field("depthTestEnable", "VK_FALSE"), "TRUE"),
                    GlReader.TopologyOf(Field("topology", "TRIANGLE_LIST")),
                    PipelineState.Vulkan(f => Field(f, null!), f => src.Int(Field(f, "")) is int v ? v : null, attachments), gs)
                {
                    // Tessellation: .tesc / .tese files for this pipeline, patchControlPoints of its tessellation state.
                    Tcs = files.FirstOrDefault(f => f.Contains(".tesc", StringComparison.Ordinal)) is { } tesc ? ShaderFor(tesc, ".tesc", exact: true) : null,
                    Tes = files.FirstOrDefault(f => f.Contains(".tese", StringComparison.Ordinal)) is { } tese ? ShaderFor(tese, ".tese", exact: true) : null,
                    PatchPoints = src.Int(Field("patchControlPoints", "3")) ?? 3,
                };
            }
        }
        return result;
    }

    private readonly Dictionary<string, PipelineInfo?> runtimePipelines = new(StringComparer.Ordinal);

    /// <summary>
    /// A pipeline as the device saw it made (its stages' files, its create-info): for programs that keep pipelines where
    /// the reader cannot follow them by name (std::map&lt;std::string, VkPipeline&gt; Shaders).
    /// </summary>
    private PipelineInfo? RuntimePipeline(VulkanDevice device, string handle)
    {
        if (runtimePipelines.TryGetValue(handle, out var known)) return known;
        PipelineInfo? result = null;
        if (device.CreatedPipelines.TryGetValue(handle, out var made))
        {
            var vs = ShaderFor(made.Files.FirstOrDefault(f => f.Contains(".vert", StringComparison.Ordinal)), ".vert", exact: true);
            var fs = ShaderFor(made.Files.FirstOrDefault(f => f.Contains(".frag", StringComparison.Ordinal)), ".frag", exact: true);
            var gsFile = made.Files.FirstOrDefault(f => f.Contains(".geom", StringComparison.Ordinal));
            var gs = gsFile is null ? null : ShaderFor(gsFile, ".geom", exact: true);
            string? Field(string name) => Find(made.Info, name, 0) is { } v ? v.Text ?? (v.V is { Length: > 0 } n ? n[0].ToString(System.Globalization.CultureInfo.InvariantCulture) : null) : null;
            if (vs is not null && fs is not null)
            {
                var cull = Field("cullMode") ?? "VK_CULL_MODE_NONE";
                var front = Field("frontFace") ?? "VK_FRONT_FACE_COUNTER_CLOCKWISE";
                result = new PipelineInfo(handle, vs, fs, "main", "main",
                    cull.Contains("FRONT_AND_BACK", StringComparison.Ordinal) ? CullMode.FrontAndBack : cull.Contains("BACK", StringComparison.Ordinal) ? CullMode.Back : cull.Contains("FRONT", StringComparison.Ordinal) ? CullMode.Front : CullMode.None,
                    !front.Contains("_CLOCKWISE", StringComparison.Ordinal) || front.Contains("COUNTER_CLOCKWISE", StringComparison.Ordinal),
                    (Field("polygonMode") ?? "FILL").Contains("LINE", StringComparison.Ordinal),
                    Field("depthTestEnable") is { } depth && (depth.Contains("TRUE", StringComparison.Ordinal) || depth == "1"),
                    GlReader.TopologyOf(Field("topology") ?? "TRIANGLE_LIST"),
                    PipelineState.Vulkan(f => Field(f)!, f => Field(f) is { } v ? src.Int(v) : null, RuntimeAttachments(made.Info)), gs)
                {
                    Tcs = made.Files.FirstOrDefault(f => f.Contains(".tesc", StringComparison.Ordinal)) is { } tesc ? ShaderFor(tesc, ".tesc", exact: true) : null,
                    Tes = made.Files.FirstOrDefault(f => f.Contains(".tese", StringComparison.Ordinal)) is { } tese ? ShaderFor(tese, ".tese", exact: true) : null,
                    PatchPoints = Field("patchControlPoints") is { } points && src.Int(points) is int n ? n : 3,
                };
            }
        }
        return runtimePipelines[handle] = result;
    }

    /// <summary>The fields of each blend attachment state the create-info's pColorBlendState lists (attachmentCount of them).</summary>
    private static List<Func<string, string?>>? RuntimeAttachments(ShaderValue? info)
    {
        var blend = Find(info, "pColorBlendState", 0) ?? info;
        if (Find(blend, "pAttachments", 0)?.Items is not { Length: > 0 } items) return null;
        int count = Math.Clamp((int)(Find(blend, "attachmentCount", 0)?.X ?? 1), 1, items.Length);
        return items.Take(count).Select(item => (Func<string, string?>)(name =>
            item.Fields?.GetValueOrDefault(name) is { } v ? v.Text ?? (v.V is { Length: > 0 } n ? n[0].ToString(System.Globalization.CultureInfo.InvariantCulture) : null) : null)).ToList();
    }

    /// <summary>A field of a create-info by its name, anywhere in it (pColorBlendState → pAttachments → dstColorBlendFactor).</summary>
    private static ShaderValue? Find(ShaderValue? v, string name, int depth)
    {
        if (v is null || depth > 6) return null;
        if (v.Fields is { } f)
        {
            if (f.TryGetValue(name, out var direct)) return direct;
            foreach (var child in f.Values)
                if (Find(child, name, depth + 1) is { } found) return found;
        }
        if (v.Items is { Length: > 0 } items) return Find(items[0], name, depth + 1);
        return null;
    }

    /// <summary>The parameter names of a function definition.</summary>
    private List<string> Parameters(string fn)
    {
        var m = Regex.Match(src.Code, @"(?<![\w.>])" + Regex.Escape(fn) + @"\s*\(([^()]*)\)\s*(?:const\s*)?\{");
        if (!m.Success) return [];
        return CppSource.SplitArgs(m.Groups[1].Value).Select(p => Regex.Match(p, @"(\w+)\s*(?:=[^,]*)?$").Groups[1].Value).Where(p => p != "").ToList();
    }

    /// <summary>The project's shader behind a SPIR-V path: "shaders/lighting.vert.spv" → shaders/lighting.vert; "shaders/vert.spv" → the .vert file.</summary>
    private ShaderProgram? ShaderFor(string? spv, string extension, bool exact = false)
    {
        if (spv is null) return null;
        var source = spv.EndsWith(".spv", StringComparison.Ordinal) ? spv[..^4] : spv;
        var text = source.EndsWith(extension, StringComparison.Ordinal) ? project.Find(source) : null;
        if (!exact) text ??= project.Files.FirstOrDefault(kv => kv.Key.EndsWith(extension, StringComparison.Ordinal)).Value;
        if (text is null) return null;
        try
        {
            return ShaderParser.ParseProgram(text);
        }
        catch (ShaderSyntaxException)
        {
            return null;
        }
    }
}
