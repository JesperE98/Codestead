using System.Text.Json;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/archive.ts – archives and compression: tar, gzip, gunzip, zcat,
// zip and unzip – plus du, which shows how much space files and directories take.
//
// The archives are ordinary strings in the virtual file system:
//
//     MARKER NUL pretend-size NUL encoded-content
//
// The content is JSON (paths, type, permissions, owner, time and file content) encoded with
// base64 and a substituted alphabet, so that `cat archive.tar` looks like binary garbage. The
// pretend size (shown by ls -l and du) is a simple estimate of how well deflate – the algorithm
// in gzip and zip – would have compressed the content. The markers are recognised by
// VfsLib.NodeSize().

public static partial class ArchiveCmd
{
    public const string TarMagic = "\u0000SIMTAR1";
    public const string GzMagic = "\u001f\u008b\u0008SIMGZ1";
    public const string ZipMagic = "PK\u0003\u0004SIMZIP1";

    // ---------------------------------------------------------------- format

    public static string MakeTar(List<ArchiveEntry> entries) => Wrap(TarMagic, TarSize(entries), EntriesJson(entries));

    public static List<ArchiveEntry>? ReadTar(string content) => ReadEntries(TarMagic, content);

    public static string GzipString(string data, string? name = null, long? size = null)
    {
        var p = new GzPayload { D = data };
        if (!string.IsNullOrEmpty(name)) p.N = name;
        if (size is not null) p.S = size;
        return Wrap(GzMagic, GzSize(p), GzJson(p));
    }

    public static GzPayload? GunzipString(string content)
    {
        var p = Unwrap(GzMagic, content);
        if (p is not { ValueKind: JsonValueKind.Object } root) return null;
        var d = JStr(root, "d");
        if (d is null) return null;
        var payload = new GzPayload { D = d };
        if (root.TryGetProperty("n", out var n) && n.ValueKind == JsonValueKind.String) payload.N = n.GetString();
        if (JNum(root, "s") is double s) payload.S = (long)s;
        return payload;
    }

    public static string MakeZip(List<ArchiveEntry> entries) => Wrap(ZipMagic, ZipSize(entries), EntriesJson(entries));

    public static List<ArchiveEntry>? ReadZip(string content) => ReadEntries(ZipMagic, content);

    /// <summary>Reads an archive in any format (used among other things by the tasks' checks). Format: "tar", "tar.gz" or "zip".</summary>
    public static (string Format, List<ArchiveEntry> Entries)? ReadArchive(string content)
    {
        var tar = ReadTar(content);
        if (tar is not null) return ("tar", tar);
        var zip = ReadZip(content);
        if (zip is not null) return ("zip", zip);
        var gz = GunzipString(content);
        var inner = gz is not null ? ReadTar(gz.D) : null;
        return inner is not null ? ("tar.gz", inner) : null;
    }

    // ---------------------------------------------------------------- helpers

    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

    /// <summary>How tar and zip show an entry: directories get a trailing /.</summary>
    private static string EntryLabel(ArchiveEntry e) => e.Type == "dir" ? $"{e.Path}/" : e.Path;

    private static string Pad2(int n) => n.ToString(CultureInfo.InvariantCulture).PadLeft(2, '0');

    private static string IsoDate(long ms)
    {
        var d = Js.LocalDate(ms);
        return $"{d.Year}-{Pad2(d.Month)}-{Pad2(d.Day)} {Pad2(d.Hour)}:{Pad2(d.Minute)}";
    }

    private static List<string> SortedChildren(FsNode node) => (node.Children?.Keys.ToList() ?? new List<string>()).SortJs();

    private sealed class WalkHandlers
    {
        public required Action<ArchiveEntry> Add { get; init; }
        public required Action<string, string> Error { get; init; }
        /// <summary>True = skip (e.g. the archive file itself).</summary>
        public Func<string, string, bool>? Skip { get; init; }
    }

    /// <summary>Walks a file or directory and turns it into archive entries.</summary>
    private static void WalkTree(User user, FsNode node, string abs, string name, bool recursive, WalkHandlers h)
    {
        if (h.Skip?.Invoke(abs, name) == true) return;
        int mode = node.Mode & Js.Oct(7777);
        if (node.Type == "link")
        {
            // Archives keep symbolic links as links (they are not followed).
            h.Add(new ArchiveEntry { Path = name, Type = "link", Mode = mode, Owner = node.Owner, Group = node.Group, Mtime = node.Mtime, Content = node.Content ?? "" });
            return;
        }
        if (node.Type == "file")
        {
            if (!VfsLib.HasPerm(node, user, 'r'))
            {
                h.Error(name, "Permission denied");
                return;
            }
            var e = new ArchiveEntry { Path = name, Type = "file", Mode = mode, Owner = node.Owner, Group = node.Group, Mtime = node.Mtime, Content = node.Content ?? "" };
            if (node.Size is not null) e.Size = node.Size;
            h.Add(e);
            return;
        }
        // The name '' means the root directory (tar -cf x.tar /): it is not added itself.
        if (name != "") h.Add(new ArchiveEntry { Path = name, Type = "dir", Mode = mode, Owner = node.Owner, Group = node.Group, Mtime = node.Mtime });
        if (!recursive) return;
        if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
        {
            h.Error(name != "" ? name : "/", "Permission denied");
            return;
        }
        foreach (var child in SortedChildren(node))
            WalkTree(user, node.Children![child], JoinPath(abs, child), name == "" ? child : $"{name}/{child}", recursive, h);
    }

    /// <summary>Turns a path in an archive into safe segments (no .. or absolute paths).</summary>
    private static List<string>? SafeSegments(string path)
    {
        var segs = path.Split('/').Where(s => s != "" && s != ".").ToList();
        return segs.Contains("..") ? null : segs;
    }

    private sealed class ExtractOptions
    {
        /// <summary>Keep the owner from the archive (only root can).</summary>
        public bool KeepOwner { get; init; }
        /// <summary>Bits removed from the permissions (umask).</summary>
        public int Umask { get; init; }
        /// <summary>Called before an entry is extracted (with what is already there). Returns false to skip it.</summary>
        public Func<ArchiveEntry, FsNode?, bool>? Before { get; init; }
        /// <summary>(entry, "file" | "dir", message)</summary>
        public required Action<ArchiveEntry, string, string> Error { get; init; }
    }

    /// <summary>Extracts entries under the directory base. Returns false if something went wrong.</summary>
    private static bool ExtractEntries(CmdCtx ctx, List<ArchiveEntry> entries, string @base, ExtractOptions opts)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool ok = true;
        // The directories' permissions are set last, so that a read-only directory can still be filled.
        var dirFixes = new List<(FsNode Node, ArchiveEntry E)>();
        (string Owner, string? Group) OwnerOf(ArchiveEntry e) => opts.KeepOwner ? (e.Owner, e.Group) : (user.Name, user.Groups.FirstOrDefault());
        int ModeOf(ArchiveEntry e) => e.Mode & (user.Uid == 0 ? Js.Oct(7777) : Js.Oct(777)) & ~opts.Umask;

        foreach (var e in entries)
        {
            var segs = SafeSegments(e.Path);
            if (segs is null)
            {
                opts.Error(e, e.Type, "Member name contains ..");
                ok = false;
                continue;
            }
            if (segs.Count == 0) continue; // the entry "./" – the directory we extract into
            var abs = segs.Aggregate(@base, JoinPath);
            var existing = e.Type == "link" ? sh.Vfs.TryLookupLink(abs, user) : sh.Vfs.TryLookup(abs, user);
            if (opts.Before is not null && !opts.Before(e, existing)) continue;
            try
            {
                // Missing parent directories are created silently, just like tar and unzip do.
                var cur = @base;
                foreach (var seg in segs.Take(segs.Count - 1))
                {
                    cur = JoinPath(cur, seg);
                    var n = sh.Vfs.TryLookup(cur, user);
                    if (n is null) sh.Vfs.Mkdir(cur, user);
                    else if (n.Type != "dir") throw new FsError("ENOTDIR");
                }
                if (e.Type == "dir")
                {
                    if (existing is not null && existing.Type != "dir") throw new FsError("EEXIST");
                    if (existing is null) sh.Vfs.Mkdir(abs, user);
                    var node = sh.Vfs.Lookup(abs, user);
                    if (existing is null || user.Uid == 0 || node.Owner == user.Name) dirFixes.Add((node, e));
                }
                else if (e.Type == "link")
                {
                    if (existing?.Type == "dir") throw new FsError("EISDIR");
                    var (o, g) = OwnerOf(e);
                    var link = VfsLib.MakeLink(e.Content ?? "", o, g);
                    link.Mtime = e.Mtime;
                    sh.Vfs.Insert(abs, link, user);
                }
                else
                {
                    if (existing?.Type == "dir") throw new FsError("EISDIR");
                    var (o, g) = OwnerOf(e);
                    var node = VfsLib.MakeFile(e.Content ?? "", o, ModeOf(e), g);
                    node.Mtime = e.Mtime;
                    if (e.Size is not null) node.Size = e.Size;
                    sh.Vfs.Insert(abs, node, user);
                }
            }
            catch (FsError err)
            {
                opts.Error(e, e.Type, err.Message);
                ok = false;
            }
        }
        dirFixes.Reverse();
        foreach (var (node, e) in dirFixes)
        {
            node.Mode = ModeOf(e);
            node.Mtime = e.Mtime;
            if (opts.KeepOwner)
            {
                var (o, g) = OwnerOf(e);
                node.Owner = o;
                node.Group = g ?? o;
            }
        }
        return ok;
    }

    private static readonly Regex LeadingDotSlashRe = new(@"^(\./)+", RegexOptions.CultureInvariant);
    private static readonly Regex TrailingSlashesRe = new(@"/+\z", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingSlashesRe = new(@"^/+", RegexOptions.CultureInvariant);

    /// <summary>Filters entries by the names the student gave (exact names, directories or wildcards).</summary>
    private static (List<ArchiveEntry> Selected, List<string> Missing) SelectEntries(List<ArchiveEntry> entries, List<string> patterns)
    {
        if (patterns.Count == 0) return (entries, new List<string>());
        var missing = new List<string>();
        var matchers = patterns.Select(p =>
        {
            var clean = TrailingSlashesRe.Replace(LeadingDotSlashRe.Replace(p, "", 1), "", 1);
            var re = ParserLib.GlobToRegex(clean);
            return (Func<string, bool>)(path => path == clean || path.StartsWith(clean + "/", StringComparison.Ordinal) || re.IsMatch(path));
        }).ToList();
        for (int i = 0; i < matchers.Count; i++)
            if (!entries.Any(e => matchers[i](e.Path))) missing.Add(patterns[i]);
        return (entries.Where(e => matchers.Any(m => m(e.Path))).ToList(), missing);
    }

    // ---------------------------------------------------------------- zip and unzip

    private static string ZipMethod(ArchiveEntry e)
    {
        long size = EntrySize(e);
        if (e.Type == "dir" || size == 0) return "stored 0%";
        double pct = AwkCmd.JsRound((1 - (double)CompressedEntrySize(e) / size) * 100);
        return pct > 0 ? $"deflated {Js.Num(pct)}%" : "stored 0%";
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Tar, Gzip, Gunzip, Zcat, Zip, Unzip, Du };
}
