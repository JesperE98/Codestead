using Avalonia.Controls;
using Codestead.UI.Controls;

namespace Codestead.GP;

/// <summary>
/// Codestead GP's lessons only have quiz questions, which need no sandbox. This one answers the rare "try it"
/// block with an empty output and a terminal that says so.
/// </summary>
internal sealed class NoSandbox : ISandbox
{
    public ISandboxTerminal NewTerminal() => new NoSandboxTerminal();

    public string OutputOf(string command) => "";
}
