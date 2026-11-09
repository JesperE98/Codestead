namespace Codestead.GP.Gpu.Textures;

/// <summary>What happens to texture coordinates outside 0–1.</summary>
public enum Wrap
{
    Repeat,
    MirroredRepeat,
    ClampToEdge,
    ClampToBorder,
}
