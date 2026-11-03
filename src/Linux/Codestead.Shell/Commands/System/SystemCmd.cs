namespace Codestead.Shell.Commands;

// Port of src/shell/commands/system.ts – shell and system commands: sudo, su, man, help, which, type, export,
// alias, history, uname and more.

public static partial class SystemCmd
{
    private static CommandDef Simple(string name, string summary, Func<CmdCtx, int> run, string? man = null, bool builtin = false) => new()
    {
        Name = name,
        Summary = summary,
        Run = run,
        Man = man,
        Builtin = builtin,
    };

    /// <summary>Object.entries(obj).sort() in JavaScript: the pairs sorted as the strings "key,value".</summary>
    internal static List<KeyValuePair<string, string>> SortedEntries(OrderedDictionary<string, string> obj) =>
        obj.OrderBy(kv => $"{kv.Key},{kv.Value}", StringComparer.Ordinal).ToList();

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        Whoami, Id, Groups, Hostname, Uname, Date, EnvCmd("env"), EnvCmd("printenv"), Export, Unset, Alias, Unalias,
        History, TypeCmd, Which, Man, Help, Clear, ExitCmd, Logout, Sudo, Su, Bash, Bash.With(name: "sh"), Source, Dot,
        TrueCmd, FalseCmd, Sleep, Seq, BasenameCmd, DirnameCmd,
    };
}
