namespace Codestead.Shell.Commands;

// The gpasswd command: add or remove members of a group.

public static partial class UsersCmd
{
    private static readonly CommandDef Gpasswd = new()
    {
        Name = "gpasswd",
        Summary = "Lägger till eller tar bort medlemmar i en grupp",
        SummaryEn = "Add or remove members of a group",
        Man = """
        NAMN
               gpasswd - administrera /etc/group

        SYNOPSIS
               gpasswd -a ANVÄNDARE GRUPP
               gpasswd -d ANVÄNDARE GRUPP

        FLAGGOR
               -a ANVÄNDARE   lägg till användaren i gruppen
               -d ANVÄNDARE   ta bort användaren ur gruppen
               -M LISTA       sätt hela medlemslistan (kommaseparerad)

        EXEMPEL
               sudo gpasswd -a kim utvecklare
               sudo gpasswd -d kim utvecklare
        """,
        ManEn = """
        NAME
               gpasswd - administer /etc/group

        SYNOPSIS
               gpasswd -a USER GROUP
               gpasswd -d USER GROUP

        OPTIONS
               -a USER   add the user to the group
               -d USER   remove the user from the group
               -M LIST   set the whole member list (comma separated)

        EXAMPLES
               sudo gpasswd -a kim developers
               sudo gpasswd -d kim developers
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "adM", Long = new() { ["add"] = "a", ["delete"] = "d", ["members"] = "M" } });
            if (o.Error is not null || o.Operands.Count != 1 || o.Values.Count != 1)
            {
                ctx.Err("Usage: gpasswd [option] GROUP\n\nOptions:\n  -a, --add USER                add USER to GROUP\n  -d, --delete USER             remove USER from GROUP\n  -M, --members USER,...        set the list of members of GROUP\n");
                return 2;
            }
            var groupName = o.Operands[0];
            if (!IsRoot(sh))
            {
                ctx.Err("gpasswd: Permission denied.\n");
                return 1;
            }
            var db = UsersLib.LoadDb(sh);
            var group = db.Group.Find(g => g.Name == groupName);
            if (group is null)
            {
                ctx.Err($"gpasswd: group '{groupName}' does not exist in /etc/group\n");
                return 3;
            }
            var a = o.Values.Get("a");
            var d = o.Values.Get("d");
            var users = o.Values.Get("M") is { } mv ? SplitList(mv) : new List<string> { (a ?? d)! };
            foreach (var u in users)
            {
                if (!db.Passwd.Any(e => e.Name == u))
                {
                    ctx.Err($"gpasswd: user '{u}' does not exist\n");
                    return 3;
                }
            }
            if (a is not null)
            {
                ctx.Out($"Adding user {a} to group {groupName}\n");
                if (!group.Members.Contains(a)) group.Members.Add(a);
            }
            else if (d is not null)
            {
                if (!group.Members.Contains(d))
                {
                    ctx.Err($"gpasswd: user '{d}' is not a member of '{groupName}'\n");
                    return 3;
                }
                ctx.Out($"Removing user {d} from group {groupName}\n");
                group.Members = group.Members.Where(m => m != d).ToList();
            }
            else
            {
                group.Members = users;
            }
            UsersLib.SaveDb(sh, db);
            return 0;
        },
    };
}
