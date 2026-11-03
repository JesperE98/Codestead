namespace Codestead.Shell.Commands;

// The delgroup command: remove a group (Debian).

public static partial class UsersCmd
{
    private static string ReplaceFirst(string s, string find, string repl)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    private static readonly CommandDef Delgroup = new()
    {
        Name = "delgroup",
        Summary = "Tar bort en grupp (Debian)",
        SummaryEn = "Remove a group (Debian)",
        Man = """
        NAMN
               delgroup - ta bort en grupp

        SYNOPSIS
               delgroup GRUPP
        """,
        ManEn = """
        NAME
               delgroup - remove a group

        SYNOPSIS
               delgroup GROUP
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may remove a user or group from the system.\n");
                return 1;
            }
            var name = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            if (string.IsNullOrEmpty(name)) return 1;
            if (UsersLib.FindGroup(sh, name) is null)
            {
                ctx.Err($"fatal: The group `{name}' does not exist.\n");
                return 3;
            }
            var code = DelGroup(sh, new Sink(s => ctx.Out(s), s => ctx.Err(ReplaceFirst(s, "groupdel: ", "fatal: "))), "groupdel", name);
            if (code == 0) ctx.Out($"info: Removing group `{name}' ...\n");
            return code;
        },
    };
}
