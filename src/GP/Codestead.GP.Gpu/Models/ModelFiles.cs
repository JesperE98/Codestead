using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Readers;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Models;

/// <summary>Finding and loading the course's model in a program, and its textures.</summary>
internal static class ModelFiles
{
    /// <summary>The first .obj file the code names ("planet.obj", MODEL_PATH = "models/planet.obj").</summary>
    public static string? Path(CppSource src) =>
        Regex.Match(src.Code, "\"([^\"\\n]+\\.obj)\"") is { Success: true } m ? m.Groups[1].Value : null;

    /// <summary>Assimp's aiProcess_FlipUVs (in main.cpp or a header such as learnopengl's model.h): v becomes 1 - v.</summary>
    public static bool FlipUVs(CppSource src, GpuProject project) =>
        src.Uses("aiProcess_FlipUVs") || project.Files.Any(f => (f.Key.EndsWith(".h", StringComparison.Ordinal) || f.Key.EndsWith(".hpp", StringComparison.Ordinal) || f.Key.EndsWith(".cpp", StringComparison.Ordinal))
            && Regex.IsMatch(CppSource.BlankComments(f.Value), @"\baiProcess_FlipUVs\b"));

    /// <summary>A texture of a material, next to the model, loaded like the program's stb_image calls.</summary>
    public static Texture? Texture(GpuProject project, string modelPath, string? file, bool flip)
    {
        if (file is null) return null;
        var dir = System.IO.Path.GetDirectoryName(modelPath.Replace('\\', '/'))?.Replace('\\', '/') ?? "";
        var image = StbImage.Load(project, dir.Length > 0 ? dir + "/" + file : file, flip, 0);
        return image is null ? null : new Texture(image, SamplerState.Default) { Components = image.Channels == 4 ? 4 : 3 };
    }
}
