namespace Codestead.GP.Gpu.Scene;

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
