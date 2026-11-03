namespace Codestead.Shell.Commands;

// The tar command: bundles files into an archive (.tar, .tar.gz) and unpacks them.

public static partial class ArchiveCmd
{
    private static FsNode EntryNode(ArchiveEntry e) => new() { Type = e.Type, Mode = e.Mode, Owner = e.Owner, Group = e.Group, Mtime = e.Mtime, Content = null };

    private static readonly Regex LeadingDotDotRe = new(@"^(\.\.(/|\z))+", RegexOptions.CultureInvariant);

    private const string TarTry = "Try 'tar --help' or 'tar --usage' for more information.\n";
    private const string TarFatal = "tar: Error is not recoverable: exiting now\n";
    private const string TarFailed = "tar: Exiting with failure status due to previous errors\n";

    private static readonly Regex OldStyleRe = new("^[a-zA-Z]+\\z", RegexOptions.CultureInvariant);

    /// <summary>Parses tar options, also the old style without a dash: tar czvf x.tar.gz dir</summary>
    private static Opts ParseTarArgs(List<string> args)
    {
        var list = args.ToList();
        if (list.Count > 0 && OldStyleRe.IsMatch(list[0]) && !list[0].StartsWith('-'))
        {
            var letters = list[0];
            list.RemoveAt(0);
            var expanded = new List<string>();
            foreach (var ch in letters)
            {
                expanded.Add("-" + ch);
                if ((ch == 'f' || ch == 'C') && list.Count > 0)
                {
                    expanded.Add(list[0]);
                    list.RemoveAt(0);
                }
            }
            list = expanded.Concat(list).ToList();
        }
        return UtilCmd.ParseOpts(list, new OptSpec
        {
            Flags = "cxtvzp",
            Values = "fC",
            Long = new Dictionary<string, string>
            {
                ["create"] = "c",
                ["extract"] = "x",
                ["get"] = "x",
                ["list"] = "t",
                ["verbose"] = "v",
                ["gzip"] = "z",
                ["gunzip"] = "z",
                ["ungzip"] = "z",
                ["file"] = "f",
                ["directory"] = "C",
                ["preserve-permissions"] = "p",
                ["same-permissions"] = "p",
            },
        });
    }

    private static string TarLong(ArchiveEntry e)
    {
        var ug = $"{e.Owner}/{e.Group}";
        var size = Js.Num(EntrySize(e));
        return $"{UtilCmd.ModeString(EntryNode(e))} {ug}{" ".Repeat(Math.Max(1, 19 - ug.Length - size.Length))}{size} {IsoDate(e.Mtime)} {EntryLabel(e)}";
    }

    private static int TarCreate(CmdCtx ctx, Opts o)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        if (o.Operands.Count == 0)
        {
            ctx.Err("tar: Cowardly refusing to create an empty archive\n" + TarTry);
            return 2;
        }
        var file = o.Values.Get("f");
        bool toStdout = file is null || file == "-";
        if (toStdout && ctx.IsTTY)
        {
            ctx.Err("tar: Refusing to write archive contents to terminal (missing -f option?)\n" + TarFatal);
            return 2;
        }
        var @base = sh.Cwd;
        if (o.Values.Get("C") is string cdir)
        {
            @base = sh.Resolve(cdir);
            if (sh.Vfs.TryLookup(@base, user)?.Type != "dir")
            {
                ctx.Err($"tar: {cdir}: Cannot chdir: No such file or directory\n" + TarFatal);
                return 2;
            }
        }
        var archivePath = toStdout ? null : sh.Resolve(file!);
        if (archivePath is not null)
        {
            // Just like real tar, the archive file is created (emptied) before anything is read.
            try
            {
                sh.Vfs.WriteFile(archivePath, "", user);
            }
            catch (FsError e)
            {
                ctx.Err($"tar: {file}: Cannot open: {e.Message}\n" + TarFatal);
                return 2;
            }
        }
        // When the archive goes to stdout, the list from -v goes to stderr.
        void Verbose(string s)
        {
            if (toStdout) ctx.Err(s);
            else ctx.Out(s);
        }
        var entries = new List<ArchiveEntry>();
        var warned = new HashSet<string>();
        bool failed = false;
        foreach (var op in o.Operands)
        {
            var abs = VfsLib.ResolvePath(@base, op);
            // The archive must be extractable anywhere, so the paths are made relative.
            var name = op == "/" ? "/" : TrailingSlashesRe.Replace(op, "", 1);
            void Strip(Regex re, string prefix)
            {
                if (!re.IsMatch(name)) return;
                name = re.Replace(name, "", 1);
                if (!warned.Contains(prefix)) ctx.Err($"tar: Removing leading `{prefix}' from member names\n");
                warned.Add(prefix);
            }
            Strip(LeadingSlashesRe, "/");
            Strip(LeadingDotDotRe, "../");
            FsNode node;
            try
            {
                node = sh.Vfs.Lookup(abs, user);
            }
            catch (FsError e)
            {
                ctx.Err($"tar: {op}: Cannot stat: {e.Message}\n");
                failed = true;
                continue;
            }
            WalkTree(user, node, abs, name, true, new WalkHandlers
            {
                Add = e =>
                {
                    entries.Add(e);
                    if (o.Flags.Contains("v")) Verbose(EntryLabel(e) + "\n");
                },
                Error = (n, msg) =>
                {
                    ctx.Err($"tar: {n}: Cannot open: {msg}\n");
                    failed = true;
                },
                Skip = (a, n) =>
                {
                    if (a != archivePath) return false;
                    ctx.Err($"tar: {n}: file is the archive; not dumped\n");
                    return true;
                },
            });
        }
        var data = MakeTar(entries);
        if (o.Flags.Contains("z")) data = GzipString(data);
        if (archivePath is not null)
        {
            try
            {
                sh.Vfs.WriteFile(archivePath, data, user);
            }
            catch (FsError e)
            {
                ctx.Err($"tar: {file}: Cannot write: {e.Message}\n" + TarFatal);
                return 2;
            }
        }
        else
        {
            ctx.Out(data);
        }
        if (failed) ctx.Err(TarFailed);
        return failed ? 2 : 0;
    }

    private static int TarRead(CmdCtx ctx, Opts o, bool extract)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var file = o.Values.Get("f");
        string raw;
        if (file is null || file == "-")
        {
            if (ctx.Stdin is null)
            {
                ctx.Err("tar: Refusing to read archive contents from terminal (missing -f option?)\n" + TarFatal);
                return 2;
            }
            raw = ctx.Stdin;
        }
        else
        {
            try
            {
                raw = sh.Vfs.ReadFile(sh.Resolve(file), user);
            }
            catch (FsError e)
            {
                bool isDir = e.Code == "EISDIR";
                ctx.Err($"tar: {file}: {(isDir ? "Cannot read" : "Cannot open")}: {e.Message}\n" + TarFatal);
                return 2;
            }
        }
        if (raw == "") return 0; // an empty archive contains nothing
        var gz = GunzipString(raw);
        if (o.Flags.Contains("z") && gz is null)
        {
            ctx.Err("gzip: stdin: not in gzip format\ntar: Child returned status 1\n" + TarFatal);
            return 2;
        }
        // GNU tar recognises compressed archives by itself when reading, even without -z.
        var entries = ReadTar(gz is not null ? gz.D : raw);
        if (entries is null)
        {
            ctx.Err("tar: This does not look like a tar archive\n" + TarFailed);
            return 2;
        }
        var (selected, missing) = SelectEntries(entries, o.Operands);
        bool failed = false;

        if (!extract)
        {
            foreach (var e in selected) ctx.Out((o.Flags.Contains("v") ? TarLong(e) : EntryLabel(e)) + "\n");
        }
        else
        {
            var @base = sh.Cwd;
            if (o.Values.Get("C") is string cdir)
            {
                @base = sh.Resolve(cdir);
                FsNode? dir = null;
                var msg = "No such file or directory";
                try
                {
                    dir = sh.Vfs.Lookup(@base, user);
                    if (dir.Type != "dir") msg = "Not a directory";
                }
                catch (FsError e)
                {
                    msg = e.Message;
                }
                if (dir?.Type != "dir")
                {
                    ctx.Err($"tar: {cdir}: Cannot chdir: {msg}\n" + TarFatal);
                    return 2;
                }
            }
            bool ok = ExtractEntries(ctx, selected, @base, new ExtractOptions
            {
                KeepOwner = user.Uid == 0,
                Umask = o.Flags.Contains("p") || user.Uid == 0 ? 0 : Js.Oct(22),
                Before = (e, _) =>
                {
                    if (o.Flags.Contains("v")) ctx.Out(EntryLabel(e) + "\n");
                    return true;
                },
                Error = (e, what, msg) => ctx.Err($"tar: {e.Path}: {(what == "dir" ? "Cannot mkdir" : "Cannot open")}: {msg}\n"),
            });
            if (!ok) failed = true;
        }
        foreach (var m in missing) ctx.Err($"tar: {m}: Not found in archive\n");
        if (missing.Count > 0) failed = true;
        if (failed) ctx.Err(TarFailed);
        return failed ? 2 : 0;
    }

    private static readonly CommandDef Tar = new()
    {
        Name = "tar",
        Summary = "Packar ihop filer till ett arkiv (.tar, .tar.gz) och packar upp dem",
        Man = """
NAMN
       tar - packa ihop filer till ett arkiv, och packa upp dem igen
             (tape archive)

SYNOPSIS
       tar -c [-v] [-z] -f ARKIV FIL...      skapa ett arkiv
       tar -t [-v] [-z] -f ARKIV             lista innehållet
       tar -x [-v] [-z] -f ARKIV [-C KAT]    packa upp

BESKRIVNING
       tar samlar många filer och kataloger i EN fil, ett arkiv. Rättigheter,
       ägare och tidsstämplar följer med. tar komprimerar inte själv – med
       -z skickas arkivet genom gzip, och då brukar filen heta .tar.gz
       eller .tgz.

       Flaggorna kan skrivas ihop, och bindestrecket kan utelämnas:
       tar -czvf, tar czvf och tar -c -z -v -f betyder samma sak.

FLAGGOR
       -c, --create       skapa ett nytt arkiv (create)
       -x, --extract      packa upp (extract)
       -t, --list         lista innehållet (table of contents)
       -v, --verbose      visa filerna som hanteras; med -t i ls -l-format
       -f, --file=ARKIV   arkivfilen. Lägg f sist bland ihopskrivna flaggor,
                          eftersom filnamnet ska komma direkt efter
       -z, --gzip         komprimera/dekomprimera med gzip
       -C, --directory=KAT  byt till katalogen KAT först (vid -x: packa
                          upp där i stället för i aktuell katalog)
       -p                 behåll rättigheterna exakt vid uppackning

EXEMPEL
       tar -czvf dokument.tar.gz dokument     packa ihop och komprimera
       tar -tzvf dokument.tar.gz              titta i arkivet
       tar -xzvf dokument.tar.gz -C /tmp      packa upp i /tmp

MINNESREGEL
       c = create, x = extract, t = list, z = gzip, v = verbose, f = file.
       "Create Zipped Verbose File" – czvf.
""",
        Run = ctx =>
        {
            var o = ParseTarArgs(ctx.Args);
            if (o.Error is not null)
            {
                ctx.Err($"tar: {o.Error}\n" + TarTry);
                return 2;
            }
            var ops = new[] { "c", "x", "t" }.Where(f => o.Flags.Contains(f)).ToList();
            if (ops.Count == 0)
            {
                ctx.Err("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\n" + TarTry);
                return 2;
            }
            if (ops.Count > 1)
            {
                ctx.Err("tar: You may not specify more than one '-Acdtrux', '--delete' or  '--test-label' option\n" + TarTry);
                return 2;
            }
            if (ops[0] == "c") return TarCreate(ctx, o);
            return TarRead(ctx, o, ops[0] == "x");
        },
    };
}
