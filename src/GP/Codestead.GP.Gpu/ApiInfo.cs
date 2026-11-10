namespace Codestead.GP.Gpu;

/// <summary>A graphics API: its id, its short name ("DirectX 12"), its full name ("Direct3D 12") and its shading language.</summary>
public sealed record ApiInfo(string Id, string Name, string FullName, string ShadingLanguage);
