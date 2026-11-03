namespace Codestead.Shell.Commands;

// The sudo command: runs a command as root (administrator).

public static partial class SystemCmd
{
    /// <summary>str.replace('a', 'b') in JavaScript: only the first occurrence.</summary>
    private static string ReplaceFirst(string s, string find, string replacement)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + replacement + s[(i + find.Length)..];
    }

    private static void SudoNotice(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var name = sh.CurrentUser().Name;
        var flag = name == sh.World.User ? "sudoNoticeShown" : $"sudoNoticeShown:{name}";
        if (sh.Flags.TryGetValue(flag, out var shown) && shown) return;
        sh.Flags[flag] = true;
        ctx.Err($"[sudo] password for {name}: {UtilCmd.Color.Dim}{sh.Msg("common.skipsPassword")}{UtilCmd.Color.Reset}\n");
    }

    private const string SudoUsage = "usage: sudo -h | -K | -k | -V\nusage: sudo [-AbEHknPS] [-u user] [-i | -s] [command [arg ...]]\n";

    private static int RunSudo(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var args = ctx.Args.ToList();
        string? Shift()
        {
            if (args.Count == 0) return null;
            var first = args[0];
            args.RemoveAt(0);
            return first;
        }
        if (args.Count == 0 || args[0] == "-h")
        {
            ctx.Err(SudoUsage);
            return 1;
        }
        if (args[0] == "-V" || args[0] == "--version")
        {
            ctx.Out("Sudo version 1.9.17p2\n");
            return 0;
        }
        var target = "root";
        bool login = false;
        bool shell = false;
        while (args.Count > 0 && args[0].StartsWith('-'))
        {
            var a = Shift()!;
            if (a == "--") break;
            if (a == "--user" || a.StartsWith("--user=", StringComparison.Ordinal))
            {
                target = a.Contains('=') ? a[7..] : (Shift() ?? "");
                continue;
            }
            if (a == "--login") login = true;
            else if (a == "--shell") shell = true;
            else if (a.StartsWith("--", StringComparison.Ordinal))
            {
                ctx.Err($"sudo: unrecognized option '{a}'\n{SudoUsage}");
                return 1;
            }
            else
            {
                for (int i = 1; i < a.Length; i++)
                {
                    char c = a[i];
                    if (c == 'i') login = true;
                    else if (c == 's') shell = true;
                    else if (c == 'u')
                    {
                        var rest = a[(i + 1)..];
                        target = rest != "" ? rest : (Shift() ?? "");
                        break;
                    }
                    else
                    {
                        ctx.Err($"sudo: invalid option -- '{c}'\n{SudoUsage}");
                        return 1;
                    }
                }
            }
        }
        if (user.Uid != 0 && !user.Groups.Contains(sh.Distro.AdminGroup))
        {
            ctx.Err($"{user.Name} is not in the sudoers file.\n");
            if (ctx.IsTTY)
            {
                ctx.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.sudoAdminGroup", ("group", sh.Distro.AdminGroup))}{UtilCmd.Color.Reset}\n");
            }
            return 1;
        }
        if (target != "root" && !UsersLib.UserExists(sh, target))
        {
            ctx.Err($"sudo: unknown user {target}\n");
            return 1;
        }
        if (user.Uid != 0) SudoNotice(ctx);
        if ((login || shell) && args.Count == 0)
        {
            UsersLib.SwitchUser(sh, target, login, m => ctx.Err($"sudo: {ReplaceFirst(m, "cannot change", "unable to change")}\n"));
            return 0;
        }
        if (args.Count == 0)
        {
            ctx.Err(SudoUsage);
            return 1;
        }
        return sh.RunAs(target, () => sh.Invoke(args, ctx, viaSudo: true));
    }

    private static readonly CommandDef Sudo = Simple("sudo", "Kör ett kommando som root (administratör)", RunSudo, """
NAMN
       sudo - kör ett kommando som en annan användare (oftast root)

SYNOPSIS
       sudo KOMMANDO [ARGUMENT]...
       sudo -i

BESKRIVNING
       root är systemets administratör och får göra allt. Vanliga användare
       som tillhör gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       kan köra enstaka kommandon som root genom att sätta sudo framför.
       Du får då ange ditt eget lösenord.

       sudo -i         starta ett root-skal (avsluta med exit)
       sudo -u ANV     kör kommandot som en annan användare än root
       sudo -iu ANV    starta ett inloggningsskal som ANV

EXEMPEL
       sudo apt update
       sudo cat /etc/shadow
       sudo -u kim whoami

VARNING
       Med sudo finns inga skyddsnät. Kör bara kommandon du förstår.
""");
}
