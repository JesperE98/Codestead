using Avalonia.Controls;

namespace Codestead.UI.Controls;

/// <summary>An interactive terminal of an <see cref="ISandbox"/>.</summary>
public interface ISandboxTerminal
{
    /// <summary>The control to show.</summary>
    Control View { get; }

    /// <summary>Fired after each command line that was run.</summary>
    event Action<SandboxRun>? Ran;

    void Focus();
}
