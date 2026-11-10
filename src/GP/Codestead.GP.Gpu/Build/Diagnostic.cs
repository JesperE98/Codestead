namespace Codestead.GP.Gpu.Build;

/// <summary>A compiler message: file, line (1-based), error or warning, and the text (in English, like a real compiler).</summary>
public sealed record Diagnostic(string File, int Line, bool IsError, string Message)
{
    public override string ToString() => $"{File}:{Line}: {(IsError ? "error" : "warning")}: {Message}";
}
