namespace Codestead.Shell.Commands;

// The chmod command: changes file permissions.

public static partial class FsCmd
{
    private static readonly CommandDef Chmod = new()
    {
        Name = "chmod",
        Summary = "Ändrar rättigheter på filer",
        Man = """
NAMN
       chmod - ändra rättigheter (change mode)

SYNOPSIS
       chmod [-R] LÄGE FIL...

BESKRIVNING
       LÄGE kan anges med siffror eller symboler.

       Siffror (oktalt): en siffra per grupp – ägare, grupp, övriga.
       r = 4, w = 2, x = 1. Lägg ihop dem:
           chmod 755 skript.sh   rwxr-xr-x
           chmod 644 fil.txt     rw-r--r--
           chmod 600 hemligt     rw-------

       Symboler: [ugoa][+-=][rwx]
           u = ägare (user), g = grupp, o = övriga (others), a = alla
           chmod +x skript.sh    gör körbar för alla
           chmod u+x,g-w fil     lägg till x för ägaren, ta bort w för gruppen
           chmod o= fil          ta bort alla rättigheter för övriga

FLAGGOR
       -R    ändra rekursivt i kataloger
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            bool recursive = false;
            string? mode = null;
            var files = new List<string>();
            foreach (var a in ctx.Args)
            {
                if (a == "-R" || a == "--recursive") recursive = true;
                else if (mode is null) mode = a;
                else files.Add(a);
            }
            if (mode is null) return UtilCmd.BadOption(ctx, "missing operand");
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{mode}'");
            if (ApplyMode(0, mode, false) is null) return UtilCmd.BadOption(ctx, $"invalid mode: '{mode}'");
            int code = 0;
            void Apply(string label, FsNode node)
            {
                if (user.Uid != 0 && node.Owner != user.Name)
                {
                    ctx.Err($"chmod: changing permissions of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                node.Mode = ApplyMode(node.Mode, mode, node.Type == "dir")!.Value;
                if (recursive && node.Type == "dir")
                {
                    // Symbolic links inside the directory are left alone (their own permissions do not matter).
                    foreach (var (n, c) in node.Children!.ToList()) if (c.Type != "link") Apply($"{label}/{n}", c);
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
                    ctx.Err($"chmod: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
