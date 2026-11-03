namespace Codestead.Shell.Commands;

// The chsh command: change login shell.

public static partial class ShellsCmd
{
    private static readonly Regex BinPrefixRe = new(@"^/bin/", RegexOptions.CultureInvariant);
    private static readonly Regex SbinPrefixRe = new(@"^/sbin/", RegexOptions.CultureInvariant);
    private static readonly Regex CommentLineRe = new(@"^#[^\n\r  ]*\n", RegexOptions.CultureInvariant | RegexOptions.Multiline);
    private static readonly Regex LeadingDashesRe = new(@"^-+", RegexOptions.CultureInvariant);

    /// <summary>/bin/zsh and /usr/bin/zsh are the same file (/bin points to /usr/bin in modern distributions).</summary>
    private static string RealPath(string p) => SbinPrefixRe.Replace(BinPrefixRe.Replace(p, "/usr/bin/", 1), "/usr/sbin/", 1);

    private static int ChangeShell(CmdCtx ctx, string user, string shell, Sink @out)
    {
        var sh = ctx.Sh;
        var root = sh.RootUser();
        bool utilLinux = sh.Distro.Family != "debian";
        var shells = (sh.Vfs.TryLookup("/etc/shells", root)?.Content ?? "").Split('\n').Select(l => l.Trim()).ToList();
        bool isRoot = sh.CurrentUser().Uid == 0;
        if (!shell.StartsWith('/'))
        {
            @out.Err(utilLinux ? "chsh: shell must be a full path name\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        var node = sh.Vfs.TryLookup(RealPath(shell), root);
        if (node is null || node.Type != "file" || (node.Mode & Js.Oct(111)) == 0)
        {
            @out.Err(utilLinux ? $"chsh: \"{shell}\" does not exist\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        if (!shells.Contains(shell) && !isRoot)
        {
            @out.Err(utilLinux ? $"chsh: {shell} is not listed in /etc/shells.\nchsh: Use chsh -l to see list.\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        var passwd = sh.Vfs.ReadFile("/etc/passwd", root);
        var lines = passwd.Split('\n').Select(line =>
        {
            var f = line.Split(':');
            if (f[0] != user || f.Length < 7) return line;
            f[6] = shell;
            return string.Join(":", f);
        });
        sh.Vfs.WriteFile("/etc/passwd", string.Join("\n", lines), root);
        if (utilLinux) @out.Out("Shell changed.\n");
        @out.Out(
            $"{UtilCmd.Color.Dim}{sh.Msg("shells.loginShellChanged", ("user", user), ("shell", shell))}{UtilCmd.Color.Reset}\n");
        return 0;
    }

    private static readonly CommandDef Chsh = new()
    {
        Name = "chsh",
        Summary = "Byter inloggningsskal (change shell)",
        SummaryEn = "Change login shell",
        Man = """
            NAMN
                   chsh - byt inloggningsskal

            SYNOPSIS
                   chsh [-s SKAL] [ANVÄNDARE]
                   chsh -l

            BESKRIVNING
                   Ändrar vilket skal som startas när du loggar in. Skalet står i
                   sista fältet på din rad i /etc/passwd. Bara skal som finns med i
                   /etc/shells godtas (de läggs dit när skalet installeras). Ändringen
                   gäller från nästa inloggning.

                   Utan -s frågar chsh efter det nya skalet.

            FLAGGOR
                   -s SKAL    det nya skalet, med hela sökvägen (t.ex. /usr/bin/zsh)
                   -l         lista skalen i /etc/shells (Arch och Fedora)

            EXEMPEL
                   cat /etc/shells
                   chsh -s /usr/bin/zsh
                   grep $USER /etc/passwd
                   chsh -s /bin/bash
            """,
        ManEn = """
            NAME
                   chsh - change login shell

            SYNOPSIS
                   chsh [-s SHELL] [USER]
                   chsh -l

            DESCRIPTION
                   Changes which shell is started when you log in. The shell is the
                   last field of your line in /etc/passwd. Only shells listed in
                   /etc/shells are accepted (they are added there when the shell is
                   installed). The change takes effect at the next login.

                   Without -s, chsh asks for the new shell.

            OPTIONS
                   -s SHELL   the new shell, with its full path (e.g. /usr/bin/zsh)
                   -l         list the shells in /etc/shells (Arch and Fedora)

            EXAMPLES
                   cat /etc/shells
                   chsh -s /usr/bin/zsh
                   grep $USER /etc/passwd
                   chsh -s /bin/bash
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            bool utilLinux = sh.Distro.Family != "debian";
            string? shell = null;
            var operands = new List<string>();
            for (int i = 0; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "-s" || a == "--shell")
                {
                    shell = ++i < ctx.Args.Count ? ctx.Args[i] : null;
                    if (shell is null)
                    {
                        ctx.Err("chsh: option requires an argument -- 's'\n");
                        return 1;
                    }
                }
                else if (a.StartsWith("--shell=", StringComparison.Ordinal)) shell = a.Slice(8);
                else if ((a == "-l" || a == "--list-shells") && utilLinux)
                {
                    ctx.Out(CommentLineRe.Replace(sh.Vfs.ReadFile("/etc/shells", sh.RootUser()), ""));
                    return 0;
                }
                else if (a.StartsWith('-'))
                {
                    ctx.Err($"chsh: invalid option -- '{LeadingDashesRe.Replace(a, "", 1)}'\n");
                    return 1;
                }
                else operands.Add(a);
            }
            var me = sh.CurrentUser();
            var user = operands.Count > 0 ? operands[0] : me.Name;
            var line = sh.Vfs
                .ReadFile("/etc/passwd", sh.RootUser())
                .Split('\n')
                .FirstOrDefault(l => l.Split(':')[0] == user);
            if (line is null)
            {
                ctx.Err(utilLinux ? $"chsh: user \"{user}\" does not exist.\n" : $"chsh: user '{user}' does not exist\n");
                return 1;
            }
            if (user != me.Name && me.Uid != 0)
            {
                ctx.Err(utilLinux ? "chsh: running UID doesn't match UID of user we're altering, shell change denied\n" : $"chsh: You may not change the shell for '{user}'.\n");
                return 1;
            }
            if (utilLinux) ctx.Out($"Changing shell for {user}.\n");
            if (me.Uid != 0) ctx.Err($"Password: {UtilCmd.Color.Dim}{sh.Msg("common.skipsPassword")}{UtilCmd.Color.Reset}\n");
            if (shell is not null) return ChangeShell(ctx, user, shell, ctx);
            var fields = line.Split(':');
            var current = fields.Length > 6 ? fields[6] : "/bin/bash";
            if (!utilLinux) ctx.Out($"Changing the login shell for {user}\nEnter the new value, or press ENTER for the default\n");
            sh.AskText(utilLinux ? $"New shell [{current}]: " : $"\tLogin Shell [{current}]: ", (text, io) =>
            {
                var value = text.Trim();
                if (value == "" || value == current)
                {
                    if (utilLinux) io.Out("Shell not changed.\n");
                    return 0;
                }
                return ChangeShell(ctx, user, value, io);
            });
            return 0;
        },
    };
}
