namespace Codestead.GP.Gpu.Shading;

/// <summary>A token of a shader (or of a C++ expression): its kind, its text and the line it is on (1-based).</summary>
public readonly record struct ShaderToken(ShaderTokenKind Kind, string Text, int Line)
{
    public bool Is(string text) => Text == text && Kind != ShaderTokenKind.End;

    public override string ToString() => Text;
}
