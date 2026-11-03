namespace Codestead.Shell.Commands;

// The scp command: copy files to and from another computer over SSH.

public static partial class SshCmd
{
    private static string SizeText(long bytes) =>
        bytes < 1024 ? Js.Num(bytes) : bytes < 1024 * 1024 ? $"{Js.ToFixed(bytes / 1024.0, 1)}KB" : $"{Js.ToFixed(bytes / 1048576.0, 1)}MB";

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
}
