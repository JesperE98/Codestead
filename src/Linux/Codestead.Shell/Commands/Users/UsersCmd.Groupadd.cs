namespace Codestead.Shell.Commands;

// The groupadd command: create a new group (needs root).

public static partial class UsersCmd
{
    private static readonly CommandDef Groupadd = new()
    {
        Name = "groupadd",
        Summary = "Skapar en ny grupp (kräver root)",
        SummaryEn = "Create a new group (needs root)",
        Man = """
        NAMN
               groupadd - skapa en ny grupp

        SYNOPSIS
               groupadd [-g GID] [-r] GRUPP

        BESKRIVNING
               Lägger till gruppen i /etc/group. Nya grupper får nästa lediga GID
               från 1000 och uppåt. Lägg till medlemmar med "usermod -aG" eller
               "gpasswd -a".

        FLAGGOR
               -g GID   välj grupp-id själv
               -r       systemgrupp (GID under 1000)
               -f       inget fel om gruppen redan finns

        EXEMPEL
               sudo groupadd utvecklare
        """,
        ManEn = """
        NAME
               groupadd - create a new group

        SYNOPSIS
               groupadd [-g GID] [-r] GROUP

        DESCRIPTION
               Adds the group to /etc/group. New groups get the next free GID from
               1000 upwards. Add members with "usermod -aG" or "gpasswd -a".

        OPTIONS
               -g GID   choose the group ID yourself
               -r       system group (GID below 1000)
               -f       no error if the group already exists

        EXAMPLES
               sudo groupadd developers
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "rf", Values = "g", Long = new() { ["system"] = "r", ["force"] = "f", ["gid"] = "g" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: groupadd [options] GROUP\n\nTry 'man groupadd' for the options.\n");
                return 2;
            }
            if (!IsRoot(sh))
            {
                ctx.Err("groupadd: Permission denied.\ngroupadd: cannot lock /etc/group; try again later.\n");
                return 10;
            }
            if (o.Flags.Contains("f") && UsersLib.FindGroup(sh, o.Operands[0]) is not null) return 0;
            return AddGroup(sh, ctx, "groupadd", o.Operands[0], o.Flags.Contains("r"), o.Values.Get("g"));
        },
    };
}
