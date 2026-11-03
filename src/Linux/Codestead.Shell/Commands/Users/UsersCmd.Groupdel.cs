namespace Codestead.Shell.Commands;

// The groupdel command: delete a group (needs root).

public static partial class UsersCmd
{
    private static readonly CommandDef Groupdel = new()
    {
        Name = "groupdel",
        Summary = "Tar bort en grupp (kräver root)",
        SummaryEn = "Delete a group (needs root)",
        Man = """
        NAMN
               groupdel - ta bort en grupp

        SYNOPSIS
               groupdel GRUPP

        BESKRIVNING
               Det går inte att ta bort en grupp som är någons primära grupp.
        """,
        ManEn = """
        NAME
               groupdel - delete a group

        SYNOPSIS
               groupdel GROUP

        DESCRIPTION
               A group that is someone's primary group cannot be removed.
        """,
        Run = ctx =>
        {
            if (ctx.Args.Count != 1 || ctx.Args[0].StartsWith('-'))
            {
                ctx.Err("Usage: groupdel [options] GROUP\n");
                return 2;
            }
            if (!IsRoot(ctx.Sh))
            {
                ctx.Err("groupdel: Permission denied.\ngroupdel: cannot lock /etc/group; try again later.\n");
                return 10;
            }
            return DelGroup(ctx.Sh, ctx, "groupdel", ctx.Args[0]);
        },
    };
}
