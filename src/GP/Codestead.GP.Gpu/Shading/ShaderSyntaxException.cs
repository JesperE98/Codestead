namespace Codestead.GP.Gpu.Shading;

/// <summary>A shader (or expression) the simulator cannot parse; <see cref="Line"/> is 1-based.</summary>
public sealed class ShaderSyntaxException(string message, int line) : Exception(message)
{
    public int Line { get; } = line;
}
