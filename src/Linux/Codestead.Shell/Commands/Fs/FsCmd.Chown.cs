namespace Codestead.Shell.Commands;

// The chown command: changes the owner of files (requires root).

public static partial class FsCmd
{
    private static readonly CommandDef Chown = new()
    {
        Name = "chown",
        Summary = "Byter ägare på filer (kräver root)",
        Man = """
NAMN
       chown - byt ägare och grupp på filer (change owner)

SYNOPSIS
       chown [-R] ÄGARE[:GRUPP] FIL...

BESKRIVNING
       Bara root kan byta ägare på filer, så du behöver oftast sudo:
           sudo chown $USER:$USER fil.txt

FLAGGOR
       -R    ändra rekursivt i kataloger
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            bool recursive = false;
            string? spec = null;
            var files = new List<string>();
            foreach (var a in ctx.Args)
            {
                if (a == "-R" || a == "--recursive") recursive = true;
                else if (spec is null) spec = a;
                else files.Add(a);
            }
            if (spec is null) return UtilCmd.BadOption(ctx, "missing operand");
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{spec}'");
            var parts = spec.Split(':');
            var owner = parts[0];
            string? groupSpec = parts.Length > 1 ? parts[1] : null;
            // Users and groups live in /etc/passwd and /etc/group. "kim:" means kim's login group.
            if (owner != "" && !UsersLib.UserExists(sh, owner))
            {
                ctx.Err($"chown: invalid user: '{spec}'\n");
                return 1;
            }
            var group = groupSpec == "" && owner != "" ? sh.GetUser(owner).Groups.FirstOrDefault() : groupSpec;
            if (!string.IsNullOrEmpty(group) && !UsersLib.GroupExists(sh, group))
            {
                ctx.Err($"chown: invalid group: '{spec}'\n");
                return 1;
            }
            int code = 0;
            void Apply(string label, FsNode node)
            {
                // Ordinary users may only change the group of their own files, to a group they belong to.
                bool ownGroupChange = (owner == "" || owner == user.Name) && node.Owner == user.Name && !string.IsNullOrEmpty(group) && user.Groups.Contains(group);
                if (user.Uid != 0 && !ownGroupChange)
                {
                    ctx.Err($"chown: changing ownership of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                if (owner != "") node.Owner = owner;
                if (!string.IsNullOrEmpty(group)) node.Group = group;
                if (recursive && node.Type == "dir")
                {
                    foreach (var (n, c) in node.Children!.ToList()) Apply($"{label}/{n}", c);
                }
            }
            foreach (var f in files)
            {
                try
                {
                    Apply(f, sh.Vfs.Lookup(sh.Resolve(f), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"chown: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
