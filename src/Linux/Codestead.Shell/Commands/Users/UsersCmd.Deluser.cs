namespace Codestead.Shell.Commands;

// The deluser command: remove a user, or a user from a group (Debian).

public static partial class UsersCmd
{
    private static readonly CommandDef Deluser = new()
    {
        Name = "deluser",
        Summary = "Tar bort en användare, eller en användare ur en grupp (Debian)",
        SummaryEn = "Remove a user, or a user from a group (Debian)",
        Man = """
        NAMN
               deluser - ta bort en användare (eller en användare ur en grupp)

        SYNOPSIS
               deluser [--remove-home] ANVÄNDARE
               deluser ANVÄNDARE GRUPP

        EXEMPEL
               sudo deluser --remove-home vikarie
               sudo deluser kim sudo
        """,
        ManEn = """
        NAME
               deluser - remove a user (or a user from a group)

        SYNOPSIS
               deluser [--remove-home] USER
               deluser USER GROUP

        EXAMPLES
               sudo deluser --remove-home substitute
               sudo deluser kim sudo
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may remove a user or group from the system.\n");
                return 1;
            }
            var removeHome = ctx.Args.Contains("--remove-home") || ctx.Args.Contains("--remove-all-files");
            var rest = ctx.Args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToList();
            var name = rest.Count > 0 ? rest[0] : null;
            var group = rest.Count > 1 ? rest[1] : null;
            if (string.IsNullOrEmpty(name))
            {
                ctx.Err("fatal: No options allowed after names.\n");
                return 1;
            }
            var db = UsersLib.LoadDb(sh);
            if (!db.Passwd.Any(e => e.Name == name))
            {
                ctx.Err($"fatal: The user `{name}' does not exist.\n");
                return 2;
            }
            if (group is not null)
            {
                var g = db.Group.Find(e => e.Name == group);
                if (g is null)
                {
                    ctx.Err($"fatal: The group `{group}' does not exist.\n");
                    return 3;
                }
                if (!g.Members.Contains(name))
                {
                    ctx.Err($"fatal: The user `{name}' is not a member of group `{group}'.\n");
                    return 6;
                }
                ctx.Out($"info: Removing user `{name}' from group `{group}' ...\n");
                g.Members = g.Members.Where(m => m != name).ToList();
                UsersLib.SaveDb(sh, db);
                return 0;
            }
            if (removeHome) ctx.Out("info: Looking for files to backup/remove ...\ninfo: Removing files ...\n");
            ctx.Out($"info: Removing crontab ...\ninfo: Removing user `{name}' ...\n");
            var quiet = new Sink(_ => { }, s =>
            {
                if (!s.Contains("mail spool", StringComparison.Ordinal)) ctx.Err(s);
            });
            return DeleteUser(sh, quiet, "userdel", name, removeHome, false);
        },
    };
}
