namespace Codestead.Shell.Commands;

// The su command: switches user.

public static partial class SystemCmd
{
    private static readonly Regex LeadingDashes = new("^-+", RegexOptions.CultureInvariant);

    private static int RunSu(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        bool login = false;
        string? command = null;
        var operands = new List<string>();
        for (int i = 0; i < ctx.Args.Count; i++)
        {
            var a = ctx.Args[i];
            if (a == "-" || a == "-l" || a == "--login") login = true;
            else if (a == "-c" || a == "--command") command = ++i < ctx.Args.Count ? ctx.Args[i] : "";
            else if (a.StartsWith("--command=", StringComparison.Ordinal)) command = a[10..];
            else if (a.StartsWith('-') && a.Length > 1) return UtilCmd.BadOption(ctx, $"invalid option -- '{LeadingDashes.Replace(a, "", 1)}'");
            else operands.Add(a);
        }
        var target = operands.Count > 0 ? operands[0] : "root";
        var entry = UsersLib.FindUser(sh, target);
        if (entry is null && target != "root")
        {
            ctx.Err($"su: user {target} does not exist or the user entry does not contain all the required fields\n");
            return 1;
        }
        int Become(Sink io)
        {
            if (entry is not null && UsersLib.IsNologin(entry.Shell))
            {
                io.Out("This account is currently not available.\n");
                return 1;
            }
            if (command is not null)
            {
                var scriptIo = new IO(io.OutFn, io.ErrFn, null, ctx.IsTTY, (io as IO)?.Reader);
                return sh.RunAs(target, () => sh.RunScript(command, "bash", new List<string>(), scriptIo));
            }
            UsersLib.SwitchUser(sh, target, login, m => io.Err($"su: warning: {m}\n"));
            return 0;
        }
        if (sh.CurrentUser().Uid == 0) return Become(ctx);
        if (!sh.CanAskInteractively())
        {
            ctx.Err("su: must be run from a terminal\n");
            return 1;
        }
        sh.AskText(
            "Password: ",
            (password, io) =>
            {
                var hash = UsersLib.ShadowHash(sh, target) ?? "!";
                if (!hash.StartsWith('!') && !hash.StartsWith('*') && UsersLib.VerifyPassword(sh, target, password)) return Become(io);
                io.Err("su: Authentication failure\n");
                if (target == "root" && (hash.StartsWith('*') || hash.StartsWith('!')))
                {
                    io.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.suRootNoPassword")}{UtilCmd.Color.Reset}\n");
                }
                else if (hash.StartsWith('!') || hash.StartsWith('*'))
                {
                    io.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.suUserNoPassword", ("user", target))}{UtilCmd.Color.Reset}\n");
                }
                return 1;
            },
            true);
        return 0;
    }

    private static readonly CommandDef Su = Simple("su", "Byter användare", RunSu, """
NAMN
       su - byt användare (substitute user)

SYNOPSIS
       su [-] [ANVÄNDARE]
       su -c KOMMANDO [ANVÄNDARE]

BESKRIVNING
       Startar ett skal som en annan användare (root om ingen anges).
       Du måste skriva den andra användarens lösenord – inte ditt eget.
       Är du redan root behövs inget lösenord. Gå tillbaka med exit.

       På Ubuntu är root-kontot låst, så där används "sudo -i" i stället
       för "su -".

FLAGGOR
       -, -l     inloggningsskal: gå till användarens hemkatalog
       -c CMD    kör bara ett kommando som användaren

EXEMPEL
       su - kim
       su -c whoami kim
""");
}
