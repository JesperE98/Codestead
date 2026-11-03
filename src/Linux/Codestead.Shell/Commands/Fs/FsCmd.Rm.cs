namespace Codestead.Shell.Commands;

// The rm command: removes files and directories.

public static partial class FsCmd
{
    private static readonly CommandDef Rm = new()
    {
        Name = "rm",
        Summary = "Tar bort filer och kataloger",
        Man = """
NAMN
       rm - ta bort filer eller kataloger (remove)

SYNOPSIS
       rm [FLAGGA]... FIL...

BESKRIVNING
       Tar bort filer. Det finns ingen papperskorg – det som tas bort är borta!

FLAGGOR
       -r, -R, --recursive   ta bort kataloger och allt innehåll
       -f, --force           ignorera filer som inte finns, fråga aldrig
       -v, --verbose         berätta vad som tas bort

VARNING
       rm -rf är kraftfullt. Dubbelkolla alltid sökvägen innan du trycker Enter.
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "rRfiv",
                Long = new() { ["recursive"] = "r", ["force"] = "f", ["verbose"] = "v", ["no-preserve-root"] = "P" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            bool force = o.Flags.Contains("f");
            bool recursive = o.Flags.Contains("r") || o.Flags.Contains("R");
            if (o.Operands.Count == 0)
            {
                if (force) return 0;
                return UtilCmd.BadOption(ctx, "missing operand");
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in o.Operands)
            {
                var path = sh.Resolve(t);
                var b = VfsLib.Basename(t);
                if (b == "." || b == "..")
                {
                    ctx.Err($"rm: refusing to remove '.' or '..' directory: skipping '{t}'\n");
                    code = 1;
                    continue;
                }
                if (path == "/")
                {
                    if (!recursive)
                    {
                        ctx.Err("rm: cannot remove '/': Is a directory\n");
                        code = 1;
                        continue;
                    }
                    if (!o.Flags.Contains("P"))
                    {
                        ctx.Err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n");
                        code = 1;
                        continue;
                    }
                    if (user.Uid != 0)
                    {
                        ctx.Err("rm: cannot remove '/': Permission denied\n");
                        code = 1;
                        continue;
                    }
                    sh.Vfs.Root.Children = Js.Obj<FsNode>();
                    continue;
                }
                try
                {
                    // rm removes a symbolic link itself, never what it points to.
                    var node = sh.Vfs.Lookup(path, user, follow: t.EndsWith('/'));
                    if (node.Type == "dir" && !recursive) throw new FsError("EISDIR");
                    sh.Vfs.Remove(path, user);
                    if (o.Flags.Contains("v")) ctx.Out(node.Type == "dir" ? $"removed directory '{t}'\n" : $"removed '{t}'\n");
                }
                catch (FsError e)
                {
                    if (force && e.Code == "ENOENT") continue;
                    ctx.Err($"rm: cannot remove '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
