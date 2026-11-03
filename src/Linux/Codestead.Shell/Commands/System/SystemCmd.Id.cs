namespace Codestead.Shell.Commands;

// The id command: shows user and group IDs.

public static partial class SystemCmd
{
    private static readonly CommandDef Id = Simple("id", "Visar användar- och grupp-id", ctx =>
    {
        var sh = ctx.Sh;
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "ugGnr", Long = new() { ["user"] = "u", ["group"] = "g", ["groups"] = "G", ["name"] = "n", ["real"] = "r" } });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var name = o.Operands.Count > 0 ? o.Operands[0] : sh.CurrentUser().Name;
        if (o.Operands.Count > 0 && !UsersLib.UserExists(sh, name))
        {
            ctx.Err($"id: '{name}': no such user\n");
            return 1;
        }
        var u = sh.GetUser(name);
        string Gid(string g) => UsersLib.GidOf(sh, g) is int gid ? Js.Num(gid) : g;
        string Show(string n, string label) => o.Flags.Contains("n") ? label : n;
        var primary = u.Groups.FirstOrDefault() ?? "";
        if (o.Flags.Contains("u")) ctx.Out(Show(Js.Num(u.Uid), u.Name) + "\n");
        else if (o.Flags.Contains("g")) ctx.Out(Show(Gid(primary), primary) + "\n");
        else if (o.Flags.Contains("G")) ctx.Out(string.Join(" ", u.Groups.Select(g => Show(Gid(g), g))) + "\n");
        else ctx.Out($"uid={Js.Num(u.Uid)}({u.Name}) gid={Gid(primary)}({primary}) groups={string.Join(",", u.Groups.Select(g => $"{Gid(g)}({g})"))}\n");
        return 0;
    }, """
NAMN
       id - visa användar-id (uid), grupp-id (gid) och grupper

SYNOPSIS
       id [FLAGGOR] [ANVÄNDARE]

BESKRIVNING
       Uppgifterna kommer från /etc/passwd och /etc/group.

FLAGGOR
       -u    bara användar-id
       -g    bara primär grupp-id
       -G    alla grupp-id
       -n    namn i stället för nummer (med -u, -g eller -G)
""");
}
