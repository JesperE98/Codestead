namespace Codestead.Shell.Commands;

// The unzip command: unpacks .zip files.

public static partial class ArchiveCmd
{
    private static readonly CommandDef Unzip = new()
    {
        Name = "unzip",
        Summary = "Packar upp .zip-filer",
        Man = """
NAMN
       unzip - lista och packa upp filer från ett zip-arkiv

SYNOPSIS
       unzip [-l] [-o] [-n] [-q] ARKIV.zip [FIL...] [-d KATALOG]

BESKRIVNING
       Packar upp alla filer (eller bara de angivna) i aktuell katalog.
       Rättigheterna följer med, men filerna ägs av dig.

       Filer som redan finns hoppas över. Använd -o för att skriva över dem.

FLAGGOR
       -l            lista innehållet, packa inte upp
       -d KATALOG    packa upp i KATALOG (skapas om den saknas)
       -o            skriv över befintliga filer utan att fråga
       -n            skriv aldrig över befintliga filer
       -q            tyst – skriv inte ut något

EXEMPEL
       unzip -l dokument.zip
       unzip dokument.zip -d uppackat
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "lonq", Values = "d" });
            if (o.Error is not null)
            {
                ctx.Err($"unzip: {o.Error}\n");
                return 10;
            }
            if (o.Operands.Count == 0)
            {
                ctx.Out(
                    "UnZip 6.00 of 20 April 2009. Original by Info-ZIP.\n\n" +
                    "Usage: unzip [-opts] file[.zip] [list] [-d exdir]\n" +
                    "  -l  list files (short format)     -d  extract files into exdir\n" +
                    "  -o  overwrite files WITHOUT prompting\n" +
                    "  -n  never overwrite existing files  -q  quiet mode\n");
                return 0;
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var archive = o.Operands[0];
            string? content = null;
            foreach (var candidate in new[] { archive, $"{archive}.zip" })
            {
                try
                {
                    content = sh.Vfs.ReadFile(sh.Resolve(candidate), user);
                    break;
                }
                catch (FsError)
                {
                    // try the next name
                }
            }
            if (content is null)
            {
                ctx.Err($"unzip:  cannot find or open {archive}, {archive}.zip or {archive}.ZIP.\n");
                return 9;
            }
            var entries = ReadZip(content);
            if (entries is null)
            {
                ctx.Out($"Archive:  {archive}\n");
                ctx.Err(
                    "  End-of-central-directory signature not found.  Either this file is not\n" +
                    "  a zipfile, or it constitutes one disk of a multi-part archive.  In the\n" +
                    "  latter case the central directory and zipfile comment will be found on\n" +
                    "  the last disk(s) of this archive.\n" +
                    $"unzip:  cannot find zipfile directory in one of {archive} or\n" +
                    $"        {archive}.zip, and cannot find {archive}.ZIP, period.\n");
                return 9;
            }
            var (selected, missing) = SelectEntries(entries, o.Operands.Skip(1).ToList());
            bool quiet = o.Flags.Contains("q");
            int code = 0;

            if (o.Flags.Contains("l"))
            {
                ctx.Out($"Archive:  {archive}\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n");
                long total = 0;
                foreach (var e in selected)
                {
                    total += EntrySize(e);
                    ctx.Out($"{Js.Num(EntrySize(e)).PadLeft(9)}  {IsoDate(e.Mtime)}   {EntryLabel(e)}\n");
                }
                int n = selected.Count;
                ctx.Out($"---------                     -------\n{Js.Num(total).PadLeft(9)}                     {n} file{(n == 1 ? "" : "s")}\n");
            }
            else
            {
                var @base = sh.Cwd;
                var prefix = "";
                if (o.Values.Get("d") is string ddir)
                {
                    @base = sh.Resolve(ddir);
                    prefix = TrailingSlashesRe.Replace(ddir, "", 1) + "/";
                    try
                    {
                        var cur = "";
                        foreach (var seg in @base.Split('/').Where(s => s != ""))
                        {
                            cur += "/" + seg;
                            var n = sh.Vfs.TryLookup(cur, user);
                            if (n is null) sh.Vfs.Mkdir(cur, user);
                            else if (n.Type != "dir") throw new FsError("ENOTDIR");
                        }
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"checkdir:  cannot create extraction directory: {ddir}\n           {e.Message}\n");
                        return 3;
                    }
                }
                if (!quiet) ctx.Out($"Archive:  {archive}\n");
                bool ok = ExtractEntries(ctx, selected, @base, new ExtractOptions
                {
                    KeepOwner = false,
                    Umask = 0,
                    Before = (e, existing) =>
                    {
                        var label = prefix + EntryLabel(e);
                        if (existing?.Type == "file" && !o.Flags.Contains("o"))
                        {
                            if (!o.Flags.Contains("n") && !quiet) ctx.Out($"  skipping: {label}  (already exists; use -o to overwrite)\n");
                            return false;
                        }
                        if (!quiet)
                        {
                            if (e.Type == "dir")
                            {
                                if (existing is null) ctx.Out($"   creating: {label}\n");
                            }
                            else
                            {
                                ctx.Out($"{(ZipMethod(e).StartsWith("stored", StringComparison.Ordinal) ? " extracting" : "  inflating")}: {label}\n");
                            }
                        }
                        return true;
                    },
                    Error = (e, what, msg) =>
                        ctx.Err($"{(what == "dir" ? "checkdir error" : "error")}:  cannot create {prefix}{e.Path}\n        {msg}\n"),
                });
                if (!ok) code = 50;
            }
            foreach (var m in missing) ctx.Err($"caution: filename not matched:  {m}\n");
            if (missing.Count > 0 && code == 0) code = 11;
            return code;
        },
    };
}
