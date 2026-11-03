namespace Codestead.Shell.Commands;

// The zip command: bundles and compresses files into a .zip file.

public static partial class ArchiveCmd
{
    private static readonly Regex ShortOptRe = new("-- '(.)'", RegexOptions.CultureInvariant);

    private static readonly CommandDef Zip = new()
    {
        Name = "zip",
        Summary = "Packar ihop och komprimerar filer till en .zip-fil",
        Man = """
NAMN
       zip - packa ihop och komprimera filer till ett zip-arkiv

SYNOPSIS
       zip [-r] [-q] [-j] ARKIV.zip FIL...

BESKRIVNING
       zip gör både det som tar och gzip gör: packar ihop flera filer till
       ett arkiv och komprimerar dem. Formatet kommer från Windows-världen,
       så välj zip när du ska skicka filer till någon som inte kör Linux.

       Finns arkivet redan läggs filerna till (eller uppdateras) i det.
       Saknar ARKIV filändelse läggs .zip till.

FLAGGOR
       -r    ta med kataloger och allt deras innehåll (recursive). Utan -r
             läggs bara den tomma katalogen till!
       -q    tyst – skriv inte ut något
       -j    spara bara filnamnen, inte katalogerna (junk paths)

EXEMPEL
       zip -r dokument.zip dokument
       zip bilder.zip bild1.png bild2.png

SE ÄVEN
       unzip(1), tar(1)
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "rqj0123456789",
                Long = new Dictionary<string, string> { ["recurse-paths"] = "r", ["quiet"] = "q", ["junk-paths"] = "j" },
            });
            if (o.Error is not null)
            {
                var m = ShortOptRe.Match(o.Error);
                ctx.Err($"zip error: Invalid command arguments ({(m.Success ? $"short option '{m.Groups[1].Value}' not supported" : o.Error)})\n");
                return 16;
            }
            if (o.Operands.Count == 0)
            {
                ctx.Out(
                    "Usage: zip [-options] zipfile list\n" +
                    "  The default action is to add or replace zipfile entries from list.\n" +
                    "  -r   recurse into directories     -q   quiet operation\n" +
                    "  -j   junk (don't record) directory names\n");
                return 0;
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var archive = o.Operands[0];
            if (!VfsLib.Basename(archive).Contains('.')) archive += ".zip";
            var archivePath = sh.Resolve(archive);
            var files = o.Operands.Skip(1).ToList();
            if (files.Count == 0)
            {
                ctx.Err($"\nzip error: Nothing to do! ({archive})\n");
                return 12;
            }
            var entries = new List<ArchiveEntry>();
            var existing = sh.Vfs.TryLookup(archivePath, user);
            if (existing is not null)
            {
                string content;
                try
                {
                    content = sh.Vfs.ReadFile(archivePath, user);
                }
                catch (FsError e)
                {
                    ctx.Err($"zip I/O error: {e.Message}\n\nzip error: Could not open input file ({archive})\n");
                    return 15;
                }
                var old = content == "" ? new List<ArchiveEntry>() : ReadZip(content);
                if (old is null)
                {
                    ctx.Err($"\nzip error: Zip file structure invalid ({archive})\n");
                    return 3;
                }
                entries = old;
            }
            int added = 0;
            foreach (var op in files)
            {
                var abs = sh.Resolve(op);
                FsNode node;
                try
                {
                    node = sh.Vfs.Lookup(abs, user);
                }
                catch (FsError)
                {
                    ctx.Err($"\tzip warning: name not matched: {op}\n");
                    continue;
                }
                // zip always stores relative paths: leading / and ./ are removed.
                var name = LeadingDotSlashRe.Replace(LeadingSlashesRe.Replace(TrailingSlashesRe.Replace(op, "", 1), "", 1), "", 1);
                WalkTree(user, node, abs, name == "." ? "" : name, o.Flags.Contains("r"), new WalkHandlers
                {
                    Add = e =>
                    {
                        if (o.Flags.Contains("j"))
                        {
                            if (e.Type == "dir") return;
                            e.Path = VfsLib.Basename(e.Path);
                        }
                        int idx = entries.FindIndex(x => x.Path == e.Path);
                        if (idx >= 0) entries[idx] = e;
                        else entries.Add(e);
                        added++;
                        if (!o.Flags.Contains("q")) ctx.Out($"  {(idx >= 0 ? "updating" : "adding")}: {EntryLabel(e)} ({ZipMethod(e)})\n");
                    },
                    Error = (n, _) => ctx.Err($"\tzip warning: could not open for reading: {n}\n"),
                    Skip = (a, _) => a == archivePath,
                });
            }
            if (added == 0 && existing is null)
            {
                ctx.Err($"\nzip error: Nothing to do! ({archive})\n");
                return 12;
            }
            try
            {
                sh.Vfs.WriteFile(archivePath, MakeZip(entries), user);
            }
            catch (FsError e)
            {
                ctx.Err($"zip I/O error: {e.Message}\n\nzip error: Could not create output file ({archive})\n");
                return 15;
            }
            return 0;
        },
    };
}
