namespace Codestead.Shell.Commands;

// The chgrp command: change the group of files.

public static partial class UsersCmd
{
    private static readonly CommandDef Chgrp = new()
    {
        Name = "chgrp",
        Summary = "Byter grupp på filer",
        SummaryEn = "Change the group of files",
        Man = """
        NAMN
               chgrp - byt grupp på filer

        SYNOPSIS
               chgrp [-R] GRUPP FIL...

        BESKRIVNING
               Du får byta grupp på dina egna filer till en grupp som du själv är
               medlem i. root får byta till vilken grupp som helst.

        FLAGGOR
               -R    ändra rekursivt i kataloger

        EXEMPEL
               chgrp utvecklare projekt.txt
               sudo chgrp -R utvecklare /srv/projekt
        """,
        ManEn = """
        NAME
               chgrp - change the group of files

        SYNOPSIS
               chgrp [-R] GROUP FILE...

        DESCRIPTION
               You may change the group of your own files to a group you are a
               member of. root may change to any group.

        OPTIONS
               -R    operate recursively on directories

        EXAMPLES
               chgrp developers project.txt
               sudo chgrp -R developers /srv/project
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "Rv", Long = new() { ["recursive"] = "R", ["verbose"] = "v" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var group = o.Operands[0];
            var files = o.Operands.Skip(1).ToList();
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{group}'");
            if (UsersLib.FindGroup(sh, group) is null)
            {
                ctx.Err($"chgrp: invalid group: '{group}'\n");
                return 1;
            }
            var user = sh.CurrentUser();
            int code = 0;
            void Apply(string label, FsNode node)
            {
                if (user.Uid != 0 && (node.Owner != user.Name || !user.Groups.Contains(group)))
                {
                    ctx.Err($"chgrp: changing group of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                node.Group = group;
                if (o.Flags.Contains("R") && node.Type == "dir")
                    foreach (var (n, c) in node.Children!) Apply($"{label}/{n}", c);
            }
            foreach (var f in files)
            {
                try
                {
                    Apply(f, sh.Vfs.Lookup(sh.Resolve(f), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"chgrp: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
