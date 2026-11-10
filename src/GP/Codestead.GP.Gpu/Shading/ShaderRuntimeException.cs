namespace Codestead.GP.Gpu.Shading;

/// <summary>Something a shader did that the simulator cannot run (an unknown name, a type mismatch …).</summary>
public sealed class ShaderRuntimeException(string message, int line) : Exception(message)
{
    public int Line { get; } = line;
}
