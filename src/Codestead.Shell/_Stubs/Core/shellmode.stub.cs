// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public static partial class ShellmodeLib
{
    public const string ZshVersion = "5.9";
    public static string FishVersion(Shell sh) => "3.7.0";
    public static (ShellMode Mode, string Interpreter)? Shebang(string content) => null;
    public static Proc ShellProc(int pid, int ppid, string user, ShellMode mode) => new() { Pid = pid, Ppid = ppid, User = user, Cmd = mode };
    public static string ShellPrompt(Shell sh, ShellMode mode) => "$ ";
    public static void ShellStartup(Shell sh, ShellMode mode, Sink io) { }
}
