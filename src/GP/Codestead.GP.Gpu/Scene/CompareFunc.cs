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
