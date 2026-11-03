namespace Codestead.Shell.Commands;

// The groups command: shows which groups you belong to.

public static partial class SystemCmd
{
    private static readonly CommandDef Groups = Simple("groups", "Visar vilka grupper du tillhör", ctx =>
    {
        var sh = ctx.Sh;
        if (ctx.Args.Count == 0)
        {
            ctx.Out(string.Join(" ", sh.CurrentUser().Groups) + "\n");
            return 0;
        }
        int code = 0;
        foreach (var name in ctx.Args)
        {
            if (!UsersLib.UserExists(sh, name))
            {
                ctx.Err($"groups: '{name}': no such user\n");
                code = 1;
                continue;
            }
            ctx.Out($"{name} : {string.Join(" ", sh.GetUser(name).Groups)}\n");
        }
        return code;
    }, """
NAMN
       groups - visa vilka grupper en användare tillhör

SYNOPSIS
       groups [ANVÄNDARE]...

BESKRIVNING
       Medlemmar i gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       får använda sudo. Grupperna står i /etc/group.
""");
}
