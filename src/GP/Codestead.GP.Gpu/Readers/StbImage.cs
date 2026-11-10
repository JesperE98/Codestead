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
        if (bytes is null || Decode(bytes) is not { } image) return null;
        if (wanted > 0) image = image with { Channels = wanted };
        return flip ? image.FlippedVertically() : image;
    }

    /// <summary>A PNG, or a Radiance .hdr (its floats kept: radiance above 1.0).</summary>
    public static Image? Decode(byte[] bytes) => RadianceHdr.IsHdr(bytes) ? RadianceHdr.Decode(bytes) : Png.Decode(bytes);

    private static readonly Regex Assign = new(@"(?<var>[A-Za-z_]\w*)\s*=\s*(?:\([^()]*\)\s*)?$", RegexOptions.CultureInvariant);

    /// <summary>Every stbi_load call in source order, with the image (null when the file is not in the project).</summary>
    public static List<StbImage> All(CppSource src, GpuProject project, Scene.Scene scene)
    {
        var flips = src.Calls("stbi_set_flip_vertically_on_load").Select(c => (c.Offset, On: Regex.IsMatch(c.Arg(0), @"^\s*(?:true|1|TRUE)\s*$"), Fn: src.FunctionAt(c.Offset))).ToList();
        var list = new List<StbImage>();
        // stbi_load (8-bit images) and stbi_loadf (floats: a Radiance .hdr environment map), in source order.
        foreach (var call in src.Calls("stbi_load").Concat(src.Calls("stbi_loadf")).OrderBy(c => c.Offset))
        {
            // The flip in effect: a call earlier in the same function (learnopengl's loadCubemap turns it off), else
            // the program's setting (stbi_set_flip_vertically_on_load(true) in main).
            var fnHere = src.FunctionAt(call.Offset);
            var local = flips.LastOrDefault(f => f.Fn == fnHere && f.Offset < call.Offset);
            bool flip = local.Fn is not null ? local.On : flips.Any(f => f.On);
            // A path indexed by a variable (faces[i] in learnopengl's loadCubemap) is only known while the loop runs.
            bool indexed = Regex.IsMatch(call.Arg(0), @"\[\s*[A-Za-z_]");
            var literal = CppSource.StringArg(call.Arg(0))
                ?? (indexed ? null : src.Evaluate(System.Text.RegularExpressions.Regex.Replace(call.Arg(0).Trim(), @"\.c_str\(\)$", ""))?.Text);
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
            else if ((image = Decode(bytes)) is null) scene.Notes.Add(SimNote.Error("textureNotPng", ("file", file)));
            if (image is not null)
            {
                if (wanted > 0) image = image with { Channels = wanted };
                if (flip) image = image.FlippedVertically();
            }
            list.Add(new StbImage(file, image, call.Offset, variable, call.Arg(0), flip, wanted));
        }
        return list;
    }

    /// <summary>
    /// The images in the order the program loads them, for the explicit APIs: a stbi_load inside a helper whose path is a
    /// parameter (LoadTexture("container2.png", …)) counts once per call of the helper, with that call's file name.
    /// </summary>
    public static List<StbImage> InLoadOrder(CppSource src, GpuProject project, Scene.Scene scene)
    {
        var list = new List<(int Order, StbImage Image)>();
        foreach (var img in All(src, project, scene))
        {
            if (img.File != "" || img.Arg.Trim() == "")
            {
                list.Add((img.Offset, img));
                continue;
            }
            var fn = src.FunctionAt(img.Offset);
            var header = fn is null ? null : System.Text.RegularExpressions.Regex.Match(src.Code, @"(?<![\w.>])" + System.Text.RegularExpressions.Regex.Escape(fn) + @"\s*\(([^()]*)\)\s*(?:const\s*)?\{");
            if (header is not { Success: true }) continue;
            var parameters = CppSource.SplitArgs(header.Groups[1].Value).Select(p => System.Text.RegularExpressions.Regex.Match(p, @"(\w+)\s*$").Groups[1].Value).ToList();
            int index = parameters.IndexOf(System.Text.RegularExpressions.Regex.Replace(img.Arg.Trim(), @"\.c_str\(\)$", ""));
            if (index < 0) continue;
            foreach (var call in src.Calls(fn).Concat(src.Calls("." + fn)).OrderBy(c => c.Offset))
            {
                var file = CppSource.StringArg(call.Arg(index));
                if (file is null) continue;
                var image = Load(project, file, img.Flip, img.Wanted);
                if (image is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", file)));
                list.Add((call.Offset, img with { File = file, Image = image }));
            }
        }
        return list.OrderBy(x => x.Order).Select(x => x.Image).ToList();
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
