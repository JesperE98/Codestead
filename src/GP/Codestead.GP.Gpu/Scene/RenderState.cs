namespace Codestead.GP.Gpu.Scene;

/// <summary>A comparison of the depth and stencil tests (GL_LESS, VK_COMPARE_OP_LESS, D3D12_COMPARISON_FUNC_LESS …).</summary>
public enum CompareFunc
{
    Never,
    Less,
    Equal,
    LessEqual,
    Greater,
    NotEqual,
    GreaterEqual,
    Always,
}

/// <summary>What a stencil test does to the stored value (GL_KEEP, GL_REPLACE …).</summary>
public enum StencilOp
{
    Keep,
    Zero,
    Replace,
    Increment,
    IncrementWrap,
    Decrement,
    DecrementWrap,
    Invert,
}

/// <summary>A blend factor (GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA …).</summary>
public enum BlendFactor
{
    Zero,
    One,
    SrcColor,
    OneMinusSrcColor,
    DstColor,
    OneMinusDstColor,
    SrcAlpha,
    OneMinusSrcAlpha,
    DstAlpha,
    OneMinusDstAlpha,
    ConstantColor,
    OneMinusConstantColor,
    ConstantAlpha,
    OneMinusConstantAlpha,
}

/// <summary>How source and destination are combined (GL_FUNC_ADD …).</summary>
public enum BlendOp
{
    Add,
    Subtract,
    ReverseSubtract,
    Min,
    Max,
}

/// <summary>The stencil test: (Ref &amp; ReadMask) Func (stored &amp; ReadMask), and what happens to the stored value.</summary>
public sealed record StencilState(
    CompareFunc Func = CompareFunc.Always,
    int Ref = 0,
    int ReadMask = 0xFF,
    int WriteMask = 0xFF,
    StencilOp StencilFail = StencilOp.Keep,
    StencilOp DepthFail = StencilOp.Keep,
    StencilOp Pass = StencilOp.Keep);

/// <summary>Blending of the fragment's colour (source) with the colour in the framebuffer (destination).</summary>
public sealed record BlendState(
    BlendFactor SrcColor = BlendFactor.One,
    BlendFactor DstColor = BlendFactor.Zero,
    BlendFactor SrcAlpha = BlendFactor.One,
    BlendFactor DstAlpha = BlendFactor.Zero,
    BlendOp ColorOp = BlendOp.Add,
    BlendOp AlphaOp = BlendOp.Add,
    double[]? Constant = null);

/// <summary>
/// An off-screen render target (a framebuffer object, a Vulkan image rendered to, a D3D12 render target texture): its
/// size (0 = the window's), its colour attachments (0 for a depth-only shadow map), whether it has depth and stencil, multisampling, and whether its colour is stored as
/// floating point (GL_RGBA16F …, not clamped to 0–1).
/// </summary>
public sealed record RenderTarget(string Id, int Width = 0, int Height = 0, int ColorAttachments = 1, bool Depth = true, bool Stencil = true, int Samples = 1, bool Float = false);

/// <summary>Something done to the targets between draws, before draw number <see cref="BeforeDraw"/> (or after the last).</summary>
public abstract record FrameOp(int BeforeDraw);

/// <summary>Clearing a target (null = the window): the colour, the depth and/or the stencil value.</summary>
public sealed record ClearOp(int BeforeDraw, string? Target, double[]? Color, double? Depth, int? Stencil) : FrameOp(BeforeDraw);

/// <summary>Copying one target into another (glBlitFramebuffer, resolving a multisampled image); null = the window.</summary>
public sealed record CopyOp(int BeforeDraw, string? From, string? To) : FrameOp(BeforeDraw);
