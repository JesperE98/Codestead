using Codestead.Shell.Commands;
using Codestead.UI.Controls;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Terminal;

/// <summary>
/// The sandbox of the lessons' "try it" questions: a fresh simulated computer of a distribution, in the learner's
/// language – separate from the learner's own terminal. It tells what a command prints there.
/// </summary>
public sealed class ShellSandbox(string distroId, string lang) : ISandbox
{
    private ShellType Fresh()
    {
        var sh = ShellType.Create(distroId, lang);
        sh.Lang = lang;
        return sh;
    }

    public string OutputOf(string command) => UtilCmd.StripAnsi(Fresh().Execute(command).Output);
}
