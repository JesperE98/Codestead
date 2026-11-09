using Avalonia.Controls;
using Codestead.UI.Controls;

namespace Codestead.GP;

/// <summary>The terminal of <see cref="NoSandbox"/>: nothing to type into.</summary>
internal sealed class NoSandboxTerminal : ISandboxTerminal
{
    public Control View { get; } = new TextBlock { Text = "—" };

    public event Action<SandboxRun>? Ran
    {
        add { }
        remove { }
    }

    public void Focus()
    {
    }
}
