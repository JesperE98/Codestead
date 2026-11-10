namespace Codestead.GP.Gpu.Scene;

/// <summary>Blending of the fragment's colour (source) with the colour in the framebuffer (destination).</summary>
public sealed record BlendState(
    BlendFactor SrcColor = BlendFactor.One,
    BlendFactor DstColor = BlendFactor.Zero,
    BlendFactor SrcAlpha = BlendFactor.One,
    BlendFactor DstAlpha = BlendFactor.Zero,
    BlendOp ColorOp = BlendOp.Add,
    BlendOp AlphaOp = BlendOp.Add,
    double[]? Constant = null);
