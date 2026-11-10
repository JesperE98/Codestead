namespace Codestead.GP.Gpu.Scene;

/// <summary>The stencil test: (Ref &amp; ReadMask) Func (stored &amp; ReadMask), and what happens to the stored value.</summary>
public sealed record StencilState(
    CompareFunc Func = CompareFunc.Always,
    int Ref = 0,
    int ReadMask = 0xFF,
    int WriteMask = 0xFF,
    StencilOp StencilFail = StencilOp.Keep,
    StencilOp DepthFail = StencilOp.Keep,
    StencilOp Pass = StencilOp.Keep);
