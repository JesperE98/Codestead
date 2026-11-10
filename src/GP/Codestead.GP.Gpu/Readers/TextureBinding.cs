using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Textures for the explicit APIs: the shaders' textures (GLSL sampler2D, HLSL Texture2D), in binding / register order,
/// read the images the program loads with stb_image, in the order it loads them – the course's Vulkan and DirectX 12
/// projects create their textures in that order.
/// </summary>
internal static class TextureBinding
{
    public static List<string> ShaderTextures(params ShaderProgram[] shaders) =>
        shaders.SelectMany(s => s.Globals)
            .Where(g => g.Type.StartsWith("sampler", StringComparison.Ordinal) && !g.Type.StartsWith("SamplerState", StringComparison.Ordinal) || g.Type.StartsWith("Texture", StringComparison.Ordinal))
            .OrderBy(g => g.Binding ?? 0)
            .Select(g => g.Id)
            .Distinct()
            .ToList();

    /// <summary>
    /// The texture lookup: shader texture i reads image i, with the sampler state <paramref name="samplerFor"/> gives for
    /// (texture name, sampler name or null).
    /// </summary>
    public static Func<string, double, double, double[]> Bind(List<string> names, List<StbImage> images, Func<string, string?, SamplerState> samplerFor)
    {
        var images2 = new Dictionary<string, Image?>(StringComparer.Ordinal);
        for (int i = 0; i < names.Count; i++) images2[names[i]] = i < images.Count ? images[i].Image : null;
        var cache = new Dictionary<string, Texture?>(StringComparer.Ordinal);
        return (id, u, v) =>
        {
            if (!cache.TryGetValue(id, out var t))
            {
                var bar = id.IndexOf('|');
                var name = bar < 0 ? id : id[..bar];
                var sampler = bar < 0 ? null : id[(bar + 1)..];
                cache[id] = t = images2.TryGetValue(name, out var img) && img is not null ? new Texture(img, samplerFor(name, sampler)) { Components = img.Channels == 4 ? 4 : 3 } : null;
            }
            return t is not null ? t.Sample(u, v) : [0, 0, 0, 1];
        };
    }

    /// <summary>A sampler state from the fields of a sampler description (Vulkan VkSamplerCreateInfo or D3D12 sampler desc).</summary>
    public static SamplerState FromFields(Func<string, string?> field, bool d3d)
    {
        string? wrapU = field(d3d ? "AddressU" : "addressModeU"), wrapV = field(d3d ? "AddressV" : "addressModeV");
        string filter = field(d3d ? "Filter" : "magFilter") ?? "LINEAR";
        bool linear = d3d ? !System.Text.RegularExpressions.Regex.IsMatch(filter, @"MAG_POINT|MIN_MAG_MIP_POINT|MIN_MAG_POINT") : !filter.Contains("NEAREST", StringComparison.Ordinal);
        var border = field(d3d ? "BorderColor" : "borderColor") ?? "";
        double[]? b = border.Contains("WHITE", StringComparison.Ordinal) ? [1, 1, 1, 1] : border.Contains("OPAQUE_BLACK", StringComparison.Ordinal) ? [0, 0, 0, 1] : null;
        return new SamplerState(StbImage.WrapOf(wrapU), StbImage.WrapOf(wrapV), linear, b);
    }
}
