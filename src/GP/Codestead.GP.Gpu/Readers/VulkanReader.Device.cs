using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// Draws built from the device model (VulkanDevice): the vertex and index buffers bound at each draw, the descriptor
// set's images (textures, cube maps, render targets drawn earlier in the frame) and the render pass's framebuffer.
public sealed partial class VulkanReader
{
    private List<ShaderAst.Global> AllShaderBlocks(string[] extensions, params ShaderProgram[] known) => AllShaderBlocks(project, extensions, known);

    /// <summary>
    /// The uniform blocks / cbuffers of every shader of the project (with several pipelines, the first shader alone
    /// may have none), each block type once.
    /// </summary>
    internal static List<ShaderAst.Global> AllShaderBlocks(GpuProject project, string[] extensions, params ShaderProgram[] known)
    {
        var programs = new List<ShaderProgram>(known);
        foreach (var (path, text) in project.Files)
        {
            if (!extensions.Any(e => path.EndsWith(e, StringComparison.Ordinal))) continue;
            try
            {
                programs.Add(ShaderParser.ParseProgram(text));
            }
            catch (ShaderSyntaxException)
            {
            }
        }
        return programs.SelectMany(p => p.Globals).Where(g => g.Block is not null).GroupBy(g => g.Type + "|" + g.PushConstant).Select(g => g.First()).ToList();
    }

    /// <summary>A vertex attribute: location, binding, byte offset, floats, per instance.</summary>
    private sealed record VkAttribute(int Location, int Binding, int Offset, int Comps, bool Instance);

    /// <summary>
    /// The vertex input of the program: attributeDescriptions[i].location / binding / format / offset and the bindings'
    /// strides and input rates (bindingDescription.stride = sizeof(Vertex), bindingDescriptions[1].inputRate = …).
    /// </summary>
    private (List<VkAttribute> Attributes, Dictionary<int, int> Strides) DeviceLayout()
    {
        int Field(string name, string index, int fallback)
        {
            var m = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*" + index + @"\s*\]\s*\.\s*" + name + @"\s*=\s*([^;]+);").LastOrDefault();
            return m is null ? fallback : SizeExpr(m.Groups[1].Value) ?? fallback;
        }
        var attributes = new List<VkAttribute>();
        var indices = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location").Select(m => m.Groups[1].Value).Distinct();
        var bindingRates = new Dictionary<int, bool>();
        var strides = new Dictionary<int, int>();
        foreach (Match b in Regex.Matches(src.Code, @"(bindingDescriptions?)(?:\s*\[\s*(\d+)\s*\])?\s*\.\s*(binding|stride|inputRate)\s*=\s*([^;]+);"))
        {
            int idx = b.Groups[2].Success ? int.Parse(b.Groups[2].Value) : 0;
            switch (b.Groups[3].Value)
            {
                case "stride":
                    strides[idx] = SizeExpr(b.Groups[4].Value) ?? 0;
                    break;
                case "inputRate":
                    bindingRates[idx] = b.Groups[4].Value.Contains("INSTANCE", StringComparison.Ordinal);
                    break;
            }
        }
        foreach (var i in indices)
        {
            var format = Regex.Matches(src.Code, @"attributeDescriptions\s*\[\s*" + i + @"\s*\]\s*\.\s*format\s*=\s*(\w+)").LastOrDefault()?.Groups[1].Value ?? "";
            int comps = Regex.Matches(format, @"[RGBA]\d+").Count;
            int binding = Field("binding", i, 0);
            attributes.Add(new VkAttribute(Field("location", i, int.Parse(i)), binding, Field("offset", i, 0), Math.Max(1, comps), bindingRates.GetValueOrDefault(binding)));
        }
        return (attributes, strides);
    }

    /// <summary>A size or offset: a number, sizeof(Vertex) / sizeof(glm::vec3), offsetof(Vertex, texCoord).</summary>
    private int? SizeExpr(string text)
    {
        text = text.Trim();
        var off = Regex.Match(text, @"^offsetof\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)$");
        if (off.Success && StructLayout.Fields(src, off.Groups[1].Value) is { } fields)
        {
            int at = 0;
            foreach (var f in fields)
            {
                if (f.Name == off.Groups[2].Value) return at * 4;
                at += f.Floats;
            }
            return null;
        }
        var size = Regex.Match(text, @"^sizeof\s*\(\s*([\w:]+)\s*\)$");
        if (size.Success)
        {
            var type = size.Groups[1].Value.Replace("glm::", "");
            if (StructLayout.Fields(src, type) is { } fs) return fs.Sum(f => f.Floats) * 4;
            return StructLayout.FloatsOf(type) * 4;
        }
        return src.Int(Regex.Replace(text, @"static_cast<\w+>\((.*)\)$", "$1"));
    }

    private (List<VkAttribute> Attributes, Dictionary<int, int> Strides)? layout;

    /// <summary>Vertices (and per-instance values) from the buffers bound at a draw, keyed by location.</summary>
    private (List<Dictionary<string, ShaderValue>>, List<Dictionary<string, ShaderValue>>?) DeviceVertices(VulkanDevice device, VulkanDevice.DrawState state, int count, int instances, int baseVertex = 0)
    {
        layout ??= DeviceLayout();
        var (attributes, strides) = layout.Value;
        // The pipeline's own vertex input (what vkCreateGraphicsPipelines was given), when the device model has it.
        if (device.PipelineOf(state.Pipeline) is { Attributes.Count: > 0 } pipe)
        {
            attributes = pipe.Attributes.Select(a => new VkAttribute(a.Location, a.Binding, a.Offset, a.Comps, pipe.Bindings.TryGetValue(a.Binding, out var b) && b.Instance)).ToList();
            strides = pipe.Bindings.ToDictionary(b => b.Key, b => b.Value.Stride);
        }
        List<Dictionary<string, ShaderValue>> Read(IEnumerable<VkAttribute> attrs, int n, int first)
        {
            var list = new List<Dictionary<string, ShaderValue>>();
            var a = attrs.ToList();
            for (int i = 0; i < n; i++)
            {
                var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                foreach (var at in a)
                    if (state.VertexBuffers.TryGetValue(at.Binding, out var vb) && device.Read(vb.Buffer, vb.Offset + (long)(i + first) * strides.GetValueOrDefault(at.Binding) + at.Offset, at.Comps) is { } v)
                        dict[at.Location.ToString()] = ShaderValue.Vec(v);
                list.Add(dict);
            }
            return list;
        }
        var vertices = Read(attributes.Where(a => !a.Instance), count, baseVertex);
        var perInstance = attributes.Where(a => a.Instance).ToList();
        return (vertices, perInstance.Count == 0 ? null : Read(perInstance, instances, 0));
    }

    /// <summary>The textures of a draw: each sampler's binding in the bound descriptor set (set 0).</summary>
    private (Func<string, double, double, double[]>?, Func<string, double, double, double, double[]?>?) DeviceTextures(VulkanDevice device, VulkanDevice.DrawState state, ShaderProgram vs, ShaderProgram fs)
    {
        deviceCubeLod = null;
        if (!state.Sets.TryGetValue(0, out var set) || !device.HasSet(set)) return (null, null);
        var bindings = vs.Globals.Concat(fs.Globals).Where(g => g.Type.StartsWith("sampler", StringComparison.Ordinal)).GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0);
        if (bindings.Count == 0) return (null, null);
        var found = bindings.ToDictionary(b => b.Key, b => device.TextureAt(set, b.Value));
        deviceTextureSizes = id => found.TryGetValue(id.Split('|')[0], out var t) && t?.Texture is { } tex ? (tex.Image.Width, tex.Image.Height) : null;
        if (found.Values.All(v => v is null)) return (null, null);
        // "name@k": layer k of a sampler2DArray, looked up when first read.
        foreach (var array in bindings.Keys.Where(k => vs.Globals.Concat(fs.Globals).Any(g => g.Id == k && g.Type.Contains("Array", StringComparison.Ordinal))).ToList())
            for (int layer = 0; layer < 16; layer++)
                found[array + "@" + layer] = device.TextureAt(set, bindings[array], layer);
        deviceCubeLod = (id, x, y, z, lod) => found.TryGetValue(id.Split('|')[0], out var t) && t?.Cube is { } c ? c.Sample(x, y, z, lod) : null;
        return ((id, u, v) => found.TryGetValue(id.Split('|')[0], out var t) && t?.Texture is { } tex ? tex.Sample(u, v) : [0, 0, 0, 1],
            (id, x, y, z) => found.TryGetValue(id.Split('|')[0], out var t) && t?.Cube is { } c ? c.Sample(x, y, z) : null);
    }

    /// <summary>The texture sizes of the last DeviceTextures call (textureSize, texelFetch).</summary>
    private Func<string, (int Width, int Height)?>? deviceTextureSizes;
    /// <summary>The cube maps of the last DeviceTextures call read at a mip level (textureLod).</summary>
    private Func<string, double, double, double, double, double[]?>? deviceCubeLod;

    /// <summary>The device model's clears in the scene's draw numbering, with their targets registered.</summary>
    private void AddDeviceOps(IEnumerable<FrameOp> ops, VulkanDevice device)
    {
        foreach (var op in ops)
        {
            switch (op)
            {
                case ClearOp c:
                    if (c.Target is not null) RegisterTarget(device, c.Target);
                    scene.Ops.Add(c with { BeforeDraw = scene.Draws.Count });
                    break;
                case CopyOp cp:
                    if (cp.From is not null) RegisterTarget(device, cp.From);
                    if (cp.To is not null) RegisterTarget(device, cp.To);
                    scene.Ops.Add(cp with { BeforeDraw = scene.Draws.Count });
                    break;
            }
        }
    }

    private void RegisterTarget(VulkanDevice device, string id)
    {
        // "img:N~2@3": mip level 2 of image N (half the size per level), cube face / array layer 3. The target is
        // registered per level; its layers are found through it.
        var levelId = id.Contains('@') ? id[..id.IndexOf('@')] : id;
        if (scene.Targets.ContainsKey(levelId) || device.TargetImage(id) is not var (img, level)) return;
        var shape = device.ShapeOf(id) ?? device.ShapeOf(levelId);
        // Drawn into layer by layer through its own framebuffers (a cube map's faces): each layer is a target of its
        // own; a layered framebuffer (gl_Layer) has them all.
        int layers = img.PerLayer ? 1 : Math.Max(1, img.Layers);
        scene.Targets[levelId] = new RenderTarget(levelId, Math.Max(1, img.Width >> level), Math.Max(1, img.Height >> level), shape?.Colors ?? 1, shape?.Depth ?? true, shape?.Depth ?? true,
            Math.Max(1, img.Samples), img.Float, layers, Channels: device.ChannelsOf(levelId, shape?.Colors ?? 1));
    }
}
