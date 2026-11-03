namespace Codestead.Shell.Commands;

// The userdel command: delete a user (needs root).

public static partial class UsersCmd
{
    private static readonly CommandDef Userdel = new()
    {
        Name = "userdel",
        Summary = "Tar bort en användare (kräver root)",
        SummaryEn = "Delete a user (needs root)",
        Man = """
        NAMN
               userdel - ta bort ett användarkonto

        SYNOPSIS
               userdel [-r] ANVÄNDARE

        BESKRIVNING
               Tar bort användaren ur /etc/passwd, /etc/shadow och /etc/group.
               Utan -r ligger hemkatalogen och filerna kvar.

        FLAGGOR
               -r    ta också bort hemkatalogen
               -f    ta bort även om användaren är inloggad

        EXEMPEL
               sudo userdel -r vikarie
        """,
        ManEn = """
        NAME
               userdel - delete a user account

        SYNOPSIS
               userdel [-r] USER

        DESCRIPTION
               Removes the user from /etc/passwd, /etc/shadow and /etc/group.
               Without -r the home directory and files are left behind.

        OPTIONS
               -r    also remove the home directory
               -f    remove even if the user is logged in

        EXAMPLES
               sudo userdel -r substitute
        """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "rf", Long = new() { ["remove"] = "r", ["force"] = "f" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: userdel [options] LOGIN\n\nOptions:\n  -f, --force    force removal of files, even if not owned by user\n  -r, --remove   remove home directory and mail spool\n");
                return 2;
            }
            if (!IsRoot(ctx.Sh)) return Denied(ctx);
            return DeleteUser(ctx.Sh, ctx, "userdel", o.Operands[0], o.Flags.Contains("r"), o.Flags.Contains("f"));
        },
    };
}
