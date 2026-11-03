namespace Codestead.Shell.Commands;

// Copying files over ssh: what scp and rsync share.

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

    /// <summary>scp and rsync (in their own list so they are created after the other commands in this class).</summary>
    public static List<CommandDef> Transfer => new() { Scp, Rsync };
}
