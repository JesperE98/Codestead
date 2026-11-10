namespace Codestead.GP.Gpu.Build;

/// <summary>
/// What "Build &amp; run" gave: the commands it showed, the compiler messages, and – when it compiled – what the
/// program does when it runs (<see cref="Scene"/>).
/// </summary>
public sealed record BuildResult(string Api, IReadOnlyList<string> Commands, IReadOnlyList<Diagnostic> Diagnostics, Scene.Scene? Scene)
{
    public bool Succeeded => Diagnostics.All(d => !d.IsError);
}
