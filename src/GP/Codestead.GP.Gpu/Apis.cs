namespace Codestead.GP.Gpu;

/// <summary>The graphics APIs the course teaches. The id is the variant id the learner chooses.</summary>
public static class Apis
{
    public const string OpenGL = "opengl";
    public const string Vulkan = "vulkan";
    public const string D3D12 = "d3d12";

    public static IReadOnlyList<ApiInfo> All { get; } = new List<ApiInfo>
    {
        new(OpenGL, "OpenGL", "OpenGL 3.3", "GLSL"),
        new(Vulkan, "Vulkan", "Vulkan 1.3", "GLSL"),
        new(D3D12, "DirectX 12", "Direct3D 12", "HLSL"),
    };

    /// <summary>The API the course starts with.</summary>
    public const string Default = OpenGL;

    public static ApiInfo Get(string? id) => All.FirstOrDefault(a => a.Id == id) ?? All[0];

    public static bool IsKnown(string? id) => All.Any(a => a.Id == id);
}
