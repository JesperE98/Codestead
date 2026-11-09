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

    public static Func<string, double, double, double[]> Bind(List<string> names, List<StbImage> images, SamplerState sampler)
    {
        var map = new Dictionary<string, Texture?>(StringComparer.Ordinal);
        for (int i = 0; i < names.Count; i++)
            map[names[i]] = i < images.Count && images[i].Image is { } img ? new Texture(img, sampler) { Components = img.Channels == 4 ? 4 : 3 } : null;
        return (name, u, v) => map.TryGetValue(name, out var t) && t is not null ? t.Sample(u, v) : [0, 0, 0, 1];
    }
}
