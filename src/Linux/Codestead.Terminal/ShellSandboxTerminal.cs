using Avalonia.Controls;
using Codestead.Shell.Commands;
using Codestead.UI.Controls;

namespace Codestead.Terminal;

/// <summary>A <see cref="TerminalView"/> as the terminal of a <see cref="ShellSandbox"/>.</summary>
public sealed class ShellSandboxTerminal : ISandboxTerminal
{
    private readonly TerminalView terminal;

    public ShellSandboxTerminal(TerminalView terminal)
    {
        this.terminal = terminal;
        terminal.CommandExecuted += r => Ran?.Invoke(new SandboxRun(r.Line, UtilCmd.StripAnsi(r.Output), r.ExitCode, !r.Pending && !r.Incomplete));
    }

    public Control View => terminal;

    public event Action<SandboxRun>? Ran;

    public void Focus() => terminal.FocusInput();
}
