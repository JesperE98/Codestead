namespace Codestead.Shell.Commands;

// The rsync command: synchronize directories (locally or over SSH), copying only what changed.

public static partial class SshCmd
{
    private static readonly CommandDef Rsync = new()
    {
        Name = "rsync",
        Summary = "Synkroniserar kataloger (lokalt eller över SSH) och kopierar bara det som ändrats",
        SummaryEn = "Synchronize directories (locally or over SSH), copying only what changed",
        Man = """
            NAMN
                   rsync - synkronisera filer och kataloger

            SYNOPSIS
                   rsync [-av] [--delete] [-n] KÄLLA... MÅL

            BESKRIVNING
                   Kopierar KÄLLA till MÅL, men bara filer som saknas eller har
                   ändrats – andra gången går det därför mycket fortare. KÄLLA eller
                   MÅL kan ligga på en annan dator ([ANVÄNDARE@]VÄRD:SÖKVÄG, över
                   ssh).

                   Ett snedstreck sist i KÄLLA är viktigt:
                       rsync -a bilder  backup/   ger backup/bilder/...
                       rsync -a bilder/ backup/   ger backup/... (bara innehållet)

            FLAGGOR
                   -a, --archive   kopiera kataloger rekursivt och behåll
                                   rättigheter och tider (det du nästan alltid vill)
                   -r              kopiera kataloger rekursivt
                   -v, --verbose   visa vilka filer som kopieras
                   -n, --dry-run   visa vad som skulle hända, men gör inget
                   --delete        ta bort filer i MÅL som inte finns i KÄLLA
                   -z              komprimera under överföringen
                   -P, --progress  visa förloppet

            EXEMPEL
                   rsync -av projekt/ backup/projekt/
                   rsync -av --delete projekt/ $USER@server.lan:projekt/
                   rsync -avn --delete projekt/ backup/   (prova först!)
            """,
        ManEn = """
            NAME
                   rsync - synchronize files and directories

            SYNOPSIS
                   rsync [-av] [--delete] [-n] SOURCE... TARGET

            DESCRIPTION
                   Copies SOURCE to TARGET, but only files that are missing or have
                   changed – so the second time is much faster. SOURCE or TARGET can
                   be on another computer ([USER@]HOST:PATH, over ssh).

                   A slash at the end of SOURCE matters:
                       rsync -a pictures  backup/   gives backup/pictures/...
                       rsync -a pictures/ backup/   gives backup/... (just the content)

            OPTIONS
                   -a, --archive   copy directories recursively and keep permissions
                                   and times (what you almost always want)
                   -r              copy directories recursively
                   -v, --verbose   show which files are copied
                   -n, --dry-run   show what would happen, but do nothing
                   --delete        delete files in TARGET that are not in SOURCE
                   -z              compress during the transfer
                   -P, --progress  show the progress

            EXAMPLES
                   rsync -av project/ backup/project/
                   rsync -av --delete project/ $USER@server.lan:project/
                   rsync -avn --delete project/ backup/   (try it first!)
            """,
        Run = RunRsync,
    };

    private static int RunRsync(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "avrnzPhuqtpogD",
            Values = "e",
            Long = new()
            {
                ["archive"] = "a", ["verbose"] = "v", ["recursive"] = "r", ["dry-run"] = "n", ["compress"] = "z",
                ["progress"] = "P", ["human-readable"] = "h", ["update"] = "u", ["quiet"] = "q", ["delete"] = "X",
                ["times"] = "t", ["perms"] = "p",
            },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var sh = ctx.Sh;
        if (o.Operands.Count < 2)
        {
            ctx.Err("rsync  version 3.4.1  protocol version 32\nUsage: rsync [OPTION]... SRC [SRC]... DEST\n");
            return 1;
        }
        var remotes = o.Operands.Select(SplitRemote).ToList();
        var hosts = remotes.Where(r => r is not null).Select(r => r!.Value.Raw).Distinct().ToList();
        if (hosts.Count > 1 || (remotes[^1] is not null && remotes.Take(remotes.Count - 1).Any(r => r is not null)))
        {
            ctx.Err("The source and destination cannot both be remote.\nrsync error: syntax or usage error (code 1) at main.c(1494) [Receiver=3.4.1]\n");
            return 1;
        }
        var opts = new SyncOptions
        {
            Recursive = o.Flags.Contains("a") || o.Flags.Contains("r"),
            Archive = o.Flags.Contains("a") || o.Flags.Contains("t"),
            Verbose = o.Flags.Contains("v") || o.Flags.Contains("P"),
            DryRun = o.Flags.Contains("n"),
            Delete = o.Flags.Contains("X"),
        };
        var sourceArgs = o.Operands.Take(o.Operands.Count - 1).ToList();
        var target = o.Operands[^1];
        if (hosts.Count == 0)
            return Sync(sourceArgs.Select(s => LocalPlace(sh, s)).ToList(), LocalPlace(sh, target), opts, ctx);
        return WithServer(ctx, "rsync", hosts[0], null, (server, io) =>
        {
            var toServer = remotes[^1] is not null;
            var dest = toServer ? RemotePlace(server, remotes[^1]!.Value.Path, target) : LocalPlace(sh, target);
            var from = sourceArgs.Select(s => toServer ? LocalPlace(sh, s) : RemotePlace(server, SplitRemote(s)!.Value.Path, s)).ToList();
            return Sync(from, dest, opts, io);
        });
    }

    private sealed class SyncOptions
    {
        public bool Recursive { get; init; }
        public bool Archive { get; init; }
        public bool Verbose { get; init; }
        public bool DryRun { get; init; }
        public bool Delete { get; init; }
    }

    /// <summary>
    /// rsync: makes the target like the sources, transferring only files whose content differs.
    /// The list of what changed is shown with -v (directories end with /).
    /// </summary>
    private static int Sync(List<Place> sources, Place dest, SyncOptions o, Sink io)
    {
        var lines = new List<string>();
        long sent = 0, total = 0;
        int code = 0;
        bool dry = o.DryRun;
        var dsh = dest.Sh;
        var du = dest.User;

        // The target directory is created if it is missing (one level, like rsync).
        var destNode = dsh.Vfs.TryLookup(dest.Path, du);
        // The target is a directory when it is one already, ends with /, or gets several things or a directory.
        bool intoDir = destNode?.Type == "dir" || dest.Slash || sources.Count > 1 ||
            sources.Any(s => s.Slash || (o.Recursive && s.Sh.Vfs.TryLookup(s.Path, s.User)?.Type == "dir"));
        bool createdRoot = destNode is null && intoDir;
        if (createdRoot)
        {
            if (!dry)
            {
                try
                {
                    dsh.Vfs.Mkdir(dest.Path, du);
                }
                catch (FsError e)
                {
                    io.Err($"rsync: [Receiver] mkdir \"{dest.Path}\" failed: {e.Message} (2)\nrsync error: error in file IO (code 11) at main.c(791) [Receiver=3.4.1]\n");
                    return 11;
                }
            }
            lines.Add($"created directory {dest.Label.TrimEnd('/')}");
        }

        void Put(FsNode src, string targetPath, string rel)
        {
            var existing = dsh.Vfs.TryLookupLink(targetPath, du);
            if (src.Type == "dir")
            {
                if (existing is not null && existing.Type != "dir")
                {
                    if (!dry) dsh.Vfs.Remove(targetPath, du);
                    existing = null;
                }
                if (existing is null || (rel == "" && createdRoot))
                {
                    if (existing is null && !dry) dsh.Vfs.Mkdir(targetPath, du);
                    lines.Add(rel == "" ? "./" : rel + "/");
                }
                var have = (existing ?? (dry ? null : dsh.Vfs.TryLookup(targetPath, du)))?.Children?.Keys.ToList() ?? new List<string>();
                // rsync sends the files sorted by name.
                foreach (var (name, child) in src.Children!.OrderBy(kv => kv.Key, StringComparer.Ordinal))
                {
                    if (child.Type == "dir" && !o.Recursive) continue;
                    Put(child, JoinPath(targetPath, name), rel == "" ? name : $"{rel}/{name}");
                }
                if (o.Delete)
                {
                    foreach (var name in have.Where(n => !src.Children!.ContainsKey(n)).ToList().SortJs())
                    {
                        lines.Add($"deleting {(rel == "" ? name : $"{rel}/{name}")}");
                        if (!dry) dsh.Vfs.Remove(JoinPath(targetPath, name), du);
                    }
                }
                if (!dry && o.Archive) dsh.Vfs.TryLookup(targetPath, du)!.Mode = src.Mode;
                return;
            }
            total += VfsLib.NodeSize(src);
            // rsync's quick check: the same size and modification time means the same file. Without -a (-t)
            // the copies get new times, so every run sends everything again.
            bool same = existing is not null && existing.Type == src.Type && VfsLib.NodeSize(existing) == VfsLib.NodeSize(src) && existing.Mtime == src.Mtime;
            if (same) return;
            sent += VfsLib.NodeSize(src);
            lines.Add(rel);
            if (dry) return;
            if (existing?.Type == "dir") throw new FsError("EISDIR");
            var copy = CopyFor(src, du, o.Archive);
            if (!o.Archive) copy.Mode = dsh.Vfs.NewFileMode | (src.Mode & Js.Oct(111) & ~dsh.Vfs.Umask);
            dsh.Vfs.Insert(targetPath, copy, du);
        }

        foreach (var s in sources)
        {
            FsNode node;
            try
            {
                node = s.Sh.Vfs.Lookup(s.Path, s.User);
            }
            catch (FsError e)
            {
                io.Err($"rsync: [sender] link_stat \"{s.Path}\" failed: {e.Message} (2)\n");
                code = 23;
                continue;
            }
            if (node.Type == "dir" && !o.Recursive)
            {
                lines.Add($"skipping directory {(s.Label.TrimEnd('/') is { Length: > 0 } l ? l : ".")}");
                continue;
            }
            try
            {
                var name = VfsLib.Basename(s.Path);
                if (node.Type == "dir" && s.Slash) Put(node, dest.Path, "");
                else if (intoDir) Put(node, JoinPath(dest.Path, name), name);
                else Put(node, dest.Path, name);
            }
            catch (FsError e)
            {
                io.Err($"rsync: [Receiver] {s.Label}: {e.Message} (13)\n");
                code = 23;
            }
        }

        if (o.Verbose)
        {
            io.Out("sending incremental file list\n");
            foreach (var l in lines) io.Out(l + "\n");
            io.Out($"\nsent {FormatBytes(sent + 60 + 20L * lines.Count)} bytes  received {FormatBytes(35 + 12L * lines.Count)} bytes  {FormatBytes(sent + 100)}.00 bytes/sec\n");
            var speedup = total == 0 ? 0 : total / (double)(sent + 95 + 32L * lines.Count);
            io.Out($"total size is {FormatBytes(total)}  speedup is {speedup.ToString("0.00", CultureInfo.InvariantCulture)}{(dry ? " (DRY RUN)" : "")}\n");
        }
        else
        {
            foreach (var l in lines.Where(l => l.StartsWith("skipping directory", StringComparison.Ordinal))) io.Out(l + "\n");
        }
        if (code == 23) io.Err("rsync error: some files/attrs were not transferred (see previous errors) (code 23) at main.c(1338) [sender=3.4.1]\n");
        return code;
    }

    private static string FormatBytes(long n) => n.ToString("#,0", CultureInfo.InvariantCulture);
}
