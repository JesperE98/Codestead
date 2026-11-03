namespace Codestead.Shell.Commands;

// scp and rsync: copying files to and from the server over ssh (and, for rsync, between directories).

public static partial class SshCmd
{
    /// <summary>One side of a copy: a path on this computer or on the server.</summary>
    private sealed class Place
    {
        public required Shell Sh { get; init; }
        public required User User { get; init; }
        /// <summary>The absolute path.</summary>
        public required string Path { get; init; }
        /// <summary>As the student wrote it (for messages).</summary>
        public required string Label { get; init; }
        /// <summary>The path ended with / (rsync: copy what is in the directory, not the directory).</summary>
        public bool Slash { get; init; }
        public bool Remote { get; init; }
    }

    private static readonly Regex RemoteRe = new(@"^(?:([^@/:]+)@)?([^/:]+):(.*)$", RegexOptions.CultureInvariant);

    /// <summary>"user@host:path" → (dest, path); null for a local path.</summary>
    private static (string Raw, string Path)? SplitRemote(string arg)
    {
        var m = RemoteRe.Match(arg);
        if (!m.Success) return null;
        var raw = (m.Groups[1].Success ? m.Groups[1].Value + "@" : "") + m.Groups[2].Value;
        return (raw, m.Groups[3].Value);
    }

    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

    private static Place LocalPlace(Shell sh, string arg) =>
        new() { Sh = sh, User = sh.CurrentUser(), Path = sh.Resolve(arg == "" ? "." : arg), Label = arg, Slash = arg.EndsWith('/') };

    /// <summary>A path on the server: relative paths start in the home directory there.</summary>
    private static Place RemotePlace(Shell server, string path, string label)
    {
        var home = server.World.Home;
        var abs = path == "" || path == "~" ? home
            : path.StartsWith("~/", StringComparison.Ordinal) ? home + path[1..]
            : path.StartsWith('/') ? path
            : $"{home}/{path}";
        return new() { Sh = server, User = server.CurrentUser(), Path = VfsLib.NormalizePath(abs), Label = label, Slash = path.EndsWith('/'), Remote = true };
    }

    /// <summary>A copy of a file or directory tree, owned by <paramref name="owner"/>.</summary>
    private static FsNode CopyFor(FsNode node, User owner, bool keepTimes)
    {
        var copy = VfsLib.CloneNode(node);
        void Own(FsNode n)
        {
            n.Owner = owner.Name;
            n.Group = owner.Groups.FirstOrDefault() ?? owner.Name;
            if (!keepTimes) n.Mtime = Js.Now();
            foreach (var c in n.Children?.Values ?? Enumerable.Empty<FsNode>()) Own(c);
        }
        Own(copy);
        return copy;
    }

    private static string SizeText(long bytes) =>
        bytes < 1024 ? Js.Num(bytes) : bytes < 1024 * 1024 ? $"{Js.ToFixed(bytes / 1024.0, 1)}KB" : $"{Js.ToFixed(bytes / 1048576.0, 1)}MB";

    /// <summary>Connects (host key question, password or key) and then runs <paramref name="then"/> with the server.</summary>
    private static int WithServer(CmdCtx ctx, string who, string raw, double? port, Func<Shell, Sink, int> then)
    {
        var sh = ctx.Sh;
        var (d, configError) = ParseDest(raw, null, sh, port);
        if (d is null)
        {
            ctx.Err(configError!);
            return 255;
        }
        return SshConnect(ctx, d, io =>
        {
            if (!Authenticate(sh, d, io)) return 255;
            return then(ServerFor(sh), io);
        });
    }

    // ---------- scp ----------

    private static readonly CommandDef Scp = new()
    {
        Name = "scp",
        Summary = "Kopierar filer till och från en annan dator över SSH",
        SummaryEn = "Copy files to and from another computer over SSH",
        Man = """
            NAMN
                   scp - kopiera filer över SSH (secure copy)

            SYNOPSIS
                   scp [-r] [-P PORT] KÄLLA... MÅL

            BESKRIVNING
                   Fungerar som cp, men KÄLLA eller MÅL kan ligga på en annan dator:
                   skriv [ANVÄNDARE@]VÄRD:SÖKVÄG. En relativ SÖKVÄG räknas från
                   hemkatalogen på den andra datorn, och VÄRD: ensamt betyder
                   hemkatalogen. Inloggningen är samma som för ssh (lösenord eller
                   nyckel), och namn i ~/.ssh/config fungerar.

            FLAGGOR
                   -r        kopiera kataloger med allt innehåll
                   -P PORT   anslut till en annan port än 22 (stort P!)
                   -p        behåll ändringstiderna
                   -q        visa inte förloppet

            EXEMPEL
                   scp rapport.txt $USER@server.lan:
                   scp $USER@server.lan:valkommen.txt .
                   scp -r projekt/ $USER@server.lan:backup/
            """,
        ManEn = """
            NAME
                   scp - copy files over SSH (secure copy)

            SYNOPSIS
                   scp [-r] [-P PORT] SOURCE... TARGET

            DESCRIPTION
                   Works like cp, but SOURCE or TARGET can be on another computer:
                   write [USER@]HOST:PATH. A relative PATH counts from the home
                   directory on the other computer, and HOST: alone means the home
                   directory. Logging in works as for ssh (password or key), and
                   names from ~/.ssh/config work.

            OPTIONS
                   -r        copy directories with everything in them
                   -P PORT   connect to a port other than 22 (capital P!)
                   -p        keep the modification times
                   -q        do not show the progress

            EXAMPLES
                   scp report.txt $USER@server.lan:
                   scp $USER@server.lan:welcome.txt .
                   scp -r project/ $USER@server.lan:backup/
            """,
        Run = RunScp,
    };

    private static int RunScp(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "rpqvC346BT", Values = "Pio" });
        if (o.Error is not null || o.Operands.Count < 2)
        {
            ctx.Err("usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target\n");
            return 1;
        }
        double? port = o.Values.TryGetValue("P", out var pv) ? Js.Number(pv) : null;
        bool recursive = o.Flags.Contains("r");
        bool quiet = o.Flags.Contains("q") || !ctx.IsTTY;
        bool keepTimes = o.Flags.Contains("p");
        var sh = ctx.Sh;
        var sources = o.Operands.Take(o.Operands.Count - 1).ToList();
        var target = o.Operands[^1];
        var remotes = o.Operands.Select(SplitRemote).ToList();
        var hosts = remotes.Where(r => r is not null).Select(r => r!.Value.Raw).Distinct().ToList();
        if (hosts.Count == 0)
        {
            // No host anywhere: scp copies locally, like cp.
            var args = new List<string>();
            if (recursive) args.Add("-r");
            args.AddRange(o.Operands);
            return sh.Invoke(new List<string> { "cp" }.Concat(args).ToList(), ctx, viaSudo: true);
        }
        if (hosts.Count > 1 || (remotes[^1] is not null && remotes.Take(remotes.Count - 1).Any(r => r is not null)))
        {
            ctx.Err($"{UtilCmd.Color.Dim}{sh.Msg("scp.oneSide")}{UtilCmd.Color.Reset}\n");
            return 1;
        }
        return WithServer(ctx, "scp", hosts[0], port, (server, io) =>
        {
            var toServer = remotes[^1] is not null;
            var dest = toServer ? RemotePlace(server, remotes[^1]!.Value.Path, target) : LocalPlace(sh, target);
            var from = sources.Select(s => toServer ? LocalPlace(sh, s) : RemotePlace(server, SplitRemote(s)!.Value.Path, s)).ToList();
            return CopyFiles("scp", from, dest, recursive, quiet, keepTimes, io);
        });
    }

    /// <summary>scp's copy: like cp, from one computer to the other, with a progress line per file.</summary>
    private static int CopyFiles(string who, List<Place> from, Place dest, bool recursive, bool quiet, bool keepTimes, Sink io)
    {
        int code = 0;
        var destNode = dest.Sh.Vfs.TryLookup(dest.Path, dest.User);
        if (from.Count > 1 && destNode?.Type != "dir")
        {
            io.Err($"{who}: {dest.Label}: Not a directory\n");
            return 1;
        }
        foreach (var src in from)
        {
            FsNode node;
            try
            {
                node = src.Sh.Vfs.Lookup(src.Path, src.User);
            }
            catch (FsError e)
            {
                io.Err(src.Remote ? $"{who}: {src.Path}: {e.Message}\n" : $"{who}: stat local \"{src.Label}\": {e.Message}\n");
                code = 1;
                continue;
            }
            if (node.Type == "dir" && !recursive)
            {
                io.Err(src.Remote ? $"{who}: download {src.Path}: not a regular file\n" : $"{who}: local \"{src.Label}\" is not a regular file\n");
                code = 1;
                continue;
            }
            if (node.Type == "file" && !VfsLib.HasPerm(node, src.User, 'r'))
            {
                io.Err($"{who}: {src.Label}: Permission denied\n");
                code = 1;
                continue;
            }
            var name = VfsLib.Basename(src.Path);
            var targetPath = destNode?.Type == "dir" ? JoinPath(dest.Path, name) : dest.Path;
            try
            {
                var existing = dest.Sh.Vfs.TryLookup(targetPath, dest.User);
                if (node.Type == "file" && existing?.Type == "file")
                {
                    if (!VfsLib.HasPerm(existing, dest.User, 'w')) throw new FsError("EACCES");
                    existing.Content = node.Content;
                    existing.Size = node.Size;
                    existing.Mtime = keepTimes ? node.Mtime : Js.Now();
                }
                else
                {
                    if (existing?.Type == "dir" && node.Type != "dir") throw new FsError("EISDIR");
                    dest.Sh.Vfs.Insert(targetPath, CopyFor(node, dest.User, keepTimes), dest.User);
                }
            }
            catch (FsError e)
            {
                io.Err($"{who}: {(dest.Remote ? targetPath : dest.Label)}: {e.Message}\n");
                code = 1;
                continue;
            }
            if (!quiet)
            {
                void Progress(string fileName, FsNode n)
                {
                    if (n.Type == "dir")
                    {
                        foreach (var (child, c) in n.Children!) Progress(child, c);
                        return;
                    }
                    var size = VfsLib.NodeSize(n);
                    io.Out($"{fileName,-40} 100% {SizeText(size),6} {SizeText(size * 8) + "/s",10}   00:00    \n");
                }
                Progress(name, node);
            }
        }
        return code;
    }

    // ---------- rsync ----------

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
                foreach (var (name, child) in src.Children!)
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
            bool same = existing is not null && existing.Type == src.Type && existing.Content == src.Content && existing.Size == src.Size;
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

    /// <summary>scp and rsync (in their own list so they are created after the other commands in this class).</summary>
    public static List<CommandDef> Transfer => new() { Scp, Rsync };
}
