using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// The images a program loads with stb_image (learnopengl.com and vulkan-tutorial.com use it; so do the course's
/// DirectX 12 projects): <c>stbi_load("container.png", &amp;width, &amp;height, &amp;nrChannels, 0)</c>, flipped when the
/// program calls <c>stbi_set_flip_vertically_on_load(true)</c>.
/// </summary>
public sealed record StbImage(string File, Image? Image, int Offset, string? Variable, string Arg = "", bool Flip = false, int Wanted = 0)
{
    /// <summary>Loads an image file of the project the way stbi_load would (null when missing or not a PNG).</summary>
    public static Image? Load(GpuProject project, string file, bool flip, int wanted)
    {
        var bytes = project.FindAsset(file);
        if (bytes is null || Png.Decode(bytes) is not { } image) return null;
        if (wanted > 0) image = image with { Channels = wanted };
        return flip ? image.FlippedVertically() : image;
    }

    private static readonly Regex Assign = new(@"(?<var>[A-Za-z_]\w*)\s*=\s*(?:\([^()]*\)\s*)?$", RegexOptions.CultureInvariant);

    /// <summary>Every stbi_load call in source order, with the image (null when the file is not in the project).</summary>
    public static List<StbImage> All(CppSource src, GpuProject project, Scene.Scene scene)
    {
        bool flip = Regex.IsMatch(src.Code, @"stbi_set_flip_vertically_on_load\s*\(\s*(?:true|1|TRUE)\s*\)");
        var list = new List<StbImage>();
        foreach (var call in src.Calls("stbi_load"))
        {
            var literal = CppSource.StringArg(call.Arg(0));
            var file = literal ?? "";
            int wanted = src.Int(call.Arg(4).Replace("STBI_rgb_alpha", "4").Replace("STBI_rgb", "3").Replace("STBI_default", "0")) ?? 0;
            if (literal is null)
            {
                // The path is a variable (learnopengl's loadTexture(path)): the reader resolves it when it runs.
                var v0 = Assign.Match(src.Code[(src.Code.LastIndexOfAny([';', '{', '}'], Math.Max(0, call.Offset - 1)) + 1)..call.Offset].TrimEnd());
                list.Add(new StbImage("", null, call.Offset, v0.Success ? v0.Groups["var"].Value : null, call.Arg(0), flip, wanted));
                continue;
            }
            var lineStart = src.Code.LastIndexOfAny([';', '{', '}'], Math.Max(0, call.Offset - 1)) + 1;
            var before = src.Code[lineStart..call.Offset];
            var variable = Assign.Match(before.TrimEnd()) is { Success: true } m ? m.Groups["var"].Value : null;
            var bytes = project.FindAsset(file);
            Image? image = null;
            if (bytes is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", file)));
            else if ((image = Png.Decode(bytes)) is null) scene.Notes.Add(SimNote.Error("textureNotPng", ("file", file)));
            if (image is not null)
            {
                if (wanted > 0) image = image with { Channels = wanted };
                if (flip) image = image.FlippedVertically();
            }
            list.Add(new StbImage(file, image, call.Offset, variable, call.Arg(0), flip, wanted));
        }
        return list;
    }

    /// <summary>The sampler state of a Vulkan VkSamplerCreateInfo or a DirectX 12 sampler description, by its field values.</summary>
    public static Wrap WrapOf(string? value) => value switch
    {
        null => Wrap.Repeat,
        _ when value.Contains("MIRROR", StringComparison.Ordinal) => Wrap.MirroredRepeat,
        _ when value.Contains("BORDER", StringComparison.Ordinal) => Wrap.ClampToBorder,
        _ when value.Contains("CLAMP", StringComparison.Ordinal) => Wrap.ClampToEdge,
        _ => Wrap.Repeat,
    };
}
