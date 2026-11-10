namespace Codestead.GP.Gpu.Textures;

/// <summary>How a texture is read: wrapping per axis, linear or nearest filtering, and the border colour.</summary>
public sealed record SamplerState(Wrap WrapS, Wrap WrapT, bool Linear, double[]? Border = null)
{
    public static SamplerState Default { get; } = new(Wrap.Repeat, Wrap.Repeat, true);
}
