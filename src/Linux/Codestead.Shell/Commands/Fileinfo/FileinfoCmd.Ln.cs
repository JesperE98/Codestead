namespace Codestead.Shell.Commands;

// The ln command: make links between files (symbolic with -s).

public static partial class FileinfoCmd
{
    private static readonly CommandDef Ln = new()
    {
        Name = "ln",
        Summary = "Skapar länkar till filer (symboliska med -s)",
        SummaryEn = "Make links between files (symbolic with -s)",
        Man = """
            NAMN
                   ln - skapa länkar mellan filer

            SYNOPSIS
                   ln [-s] [-f] [-v] MÅL [LÄNKNAMN]
                   ln [-s] [-f] [-v] MÅL... KATALOG

            BESKRIVNING
                   Skapar LÄNKNAMN som pekar på MÅL. Utan LÄNKNAMN får länken samma
                   namn som MÅL, i katalogen du står i.

                   En symbolisk länk (-s) är en liten fil som innehåller en sökväg.
                   Den kan peka på kataloger och på andra filsystem, och den slutar
                   fungera om målet tas bort eller flyttas. En relativ sökväg i
                   länken räknas från katalogen där länken ligger.

                   En hård länk (utan -s) är ett namn till på samma fil (samma
                   inod). Filen finns kvar så länge den har minst ett namn.

            FLAGGOR
                   -s, --symbolic   skapa en symbolisk länk
                   -f, --force      ta bort en fil som redan har länkens namn
                   -n               behandla en länk till en katalog som en fil
                   -v, --verbose    berätta vilken länk som skapas

            EXEMPEL
                   ln -s /var/log/syslog loggen
                   ln -s ~/projekt/start.sh ~/bin/start
                   ln anteckningar.txt kopia-som-delar-innehall.txt
            """,
        ManEn = """
            NAME
                   ln - make links between files

            SYNOPSIS
                   ln [-s] [-f] [-v] TARGET [LINK_NAME]
                   ln [-s] [-f] [-v] TARGET... DIRECTORY

            DESCRIPTION
                   Creates LINK_NAME pointing to TARGET. Without LINK_NAME the link
                   gets the same name as TARGET, in the directory you are in.

                   A symbolic link (-s) is a small file that contains a path. It can
                   point to directories and to other file systems, and it stops
                   working if the target is removed or moved. A relative path in the
                   link counts from the directory the link is in.

                   A hard link (without -s) is one more name for the same file (the
                   same inode). The file lives on as long as it has at least one name.

            OPTIONS
                   -s, --symbolic   make a symbolic link
                   -f, --force      remove a file that already has the link's name
                   -n               treat a link to a directory as a file
                   -v, --verbose    print the name of each link made

            EXAMPLES
                   ln -s /var/log/syslog thelog
                   ln -s ~/project/start.sh ~/bin/start
                   ln notes.txt same-file-other-name.txt
            """,
        Run = RunLn,
    };

    private static int RunLn(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "sfnvrT",
            Long = new() { ["symbolic"] = "s", ["force"] = "f", ["verbose"] = "v", ["no-dereference"] = "n", ["relative"] = "r", ["no-target-directory"] = "T" },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing file operand");
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool symbolic = o.Flags.Contains("s");
        var ops = o.Operands.ToList();
        string? dest = ops.Count > 1 ? ops[^1] : null;
        var sources = ops.Count > 1 ? ops.Take(ops.Count - 1).ToList() : ops;
        // Where the link(s) go: into a directory (also "." when no name is given) or under a new name.
        string? destDir = null;
        if (dest is null) destDir = ".";
        else if (!o.Flags.Contains("T"))
        {
            var destPath = sh.Resolve(dest);
            var asDir = o.Flags.Contains("n") ? sh.Vfs.TryLookupLink(destPath, user) : sh.Vfs.TryLookup(destPath, user);
            if (asDir?.Type == "dir") destDir = dest;
        }
        if (sources.Count > 1 && destDir is null)
        {
            ctx.Err($"ln: target '{dest}' is not a directory\n");
            return 1;
        }
        int code = 0;
        foreach (var src in sources)
        {
            var label = destDir is null ? dest! : destDir == "." && dest is null ? VfsLib.Basename(src) : JoinPath(destDir.TrimEnd('/') is { Length: > 0 } d ? d : "/", VfsLib.Basename(src));
            var linkPath = sh.Resolve(label);
            var kind = symbolic ? "symbolic link" : "hard link";
            try
            {
                FsNode? target = null;
                if (!symbolic)
                {
                    try
                    {
                        target = sh.Vfs.Lookup(sh.Resolve(src), user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"ln: failed to access '{src}': {e.Message}\n");
                        code = 1;
                        continue;
                    }
                    if (target.Type == "dir")
                    {
                        ctx.Err($"ln: {src}: hard link not allowed for directory\n");
                        code = 1;
                        continue;
                    }
                }
                var existing = sh.Vfs.TryLookupLink(linkPath, user);
                if (existing is not null)
                {
                    if (!symbolic && ReferenceEquals(existing, target))
                    {
                        ctx.Err($"ln: '{src}' and '{label}' are the same file\n");
                        code = 1;
                        continue;
                    }
                    if (!o.Flags.Contains("f")) throw new FsError("EEXIST");
                    if (existing.Type == "dir")
                    {
                        ctx.Err($"ln: {label}: cannot overwrite directory\n");
                        code = 1;
                        continue;
                    }
                    sh.Vfs.Remove(linkPath, user);
                }
                if (symbolic)
                {
                    var text = src;
                    // -r: a path relative to where the link is (ln -sr ../a b).
                    if (o.Flags.Contains("r")) text = RelativePath(VfsLib.Dirname(linkPath), sh.Resolve(src));
                    sh.Vfs.Insert(linkPath, VfsLib.MakeLink(text, user.Name, user.Groups.FirstOrDefault()), user);
                    if (o.Flags.Contains("v")) ctx.Out($"'{label}' -> '{text}'\n");
                }
                else
                {
                    sh.Vfs.HardLink(target!, linkPath, user);
                    if (o.Flags.Contains("v")) ctx.Out($"'{label}' => '{src}'\n");
                }
            }
            catch (FsError e)
            {
                ctx.Err($"ln: failed to create {kind} '{label}': {e.Message}\n");
                code = 1;
            }
        }
        return code;
    }
}
