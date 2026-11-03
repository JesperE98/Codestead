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

/// <summary>A file or directory in a tar or zip archive.</summary>
public partial class ArchiveEntry
{
    /// <summary>Relative path, without a trailing /.</summary>
    public string Path { get; set; } = "";
    /// <summary>"file", "dir" or "link" (a symbolic link: <see cref="Content"/> is where it points).</summary>
    public string Type { get; set; } = "file";
    public int Mode { get; set; }
    public string Owner { get; set; } = "";
    public string Group { get; set; } = "";
    public long Mtime { get; set; }
    public string? Content { get; set; }
    /// <summary>Pretend size, for simulated binaries (e.g. /usr/bin/ls).</summary>
    public long? Size { get; set; }
}

/// <summary>What gzip stores: the original name, a pretend size if any, and the data itself.</summary>
public partial class GzPayload
{
    public string? N { get; set; }
    public long? S { get; set; }
    public string D { get; set; } = "";
}

public static partial class ArchiveCmd
{
    public const string TarMagic = "\u0000SIMTAR1";
    public const string GzMagic = "\u001f\u008b\u0008SIMGZ1";
    public const string ZipMagic = "PK\u0003\u0004SIMZIP1";

    // ---------------------------------------------------------------- encoding

    private const string B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    // 64 characters from Latin-1 (¡ ... á, except the soft hyphen) – looks like binary data.
    private static readonly string Scrambled = BuildScrambled();
    private static readonly Dictionary<char, char> ToScrambled = new();
    private static readonly Dictionary<char, char> FromScrambled = BuildMaps();

    private static string BuildScrambled()
    {
        var s = new StringBuilder();
        for (int c = 0xa1; s.Length < 64; c++)
            if (c != 0xad) s.Append((char)c);
        return s.ToString();
    }

    private static Dictionary<char, char> BuildMaps()
    {
        var from = new Dictionary<char, char>();
        for (int i = 0; i < 64; i++)
        {
            ToScrambled[B64[i]] = Scrambled[i];
            from[Scrambled[i]] = B64[i];
        }
        return from;
    }

    private static string Encode(string text)
    {
        var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
        var o = new StringBuilder(b64.Length);
        foreach (var ch in b64)
            if (ch != '=') o.Append(ToScrambled[ch]);
        return o.ToString();
    }

    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    private static string? Decode(string data)
    {
        try
        {
            var b64 = new StringBuilder(data.Length + 3);
            foreach (var ch in data)
            {
                if (!FromScrambled.TryGetValue(ch, out var m)) return null;
                b64.Append(m);
            }
            b64.Append('=', (4 - b64.Length % 4) % 4);
            var bytes = Convert.FromBase64String(b64.ToString());
            var text = StrictUtf8.GetString(bytes);
            // TextDecoder drops a leading byte order mark.
            return text.StartsWith('﻿') ? text[1..] : text;
        }
        catch (Exception e) when (e is FormatException or ArgumentException)
        {
            return null;
        }
    }

    private static string Wrap(string magic, long size, string json) => $"{magic}\u0000{Js.Num(size)}\u0000{Encode(json)}";

    /// <summary>The JSON inside an archive, or null.</summary>
    private static JsonElement? Unwrap(string magic, string content)
    {
        if (!content.StartsWith(magic + "\u0000", StringComparison.Ordinal)) return null;
        var rest = content[(magic.Length + 1)..];
        int nul = rest.IndexOf('\u0000');
        if (nul < 0) return null;
        var json = Decode(rest[(nul + 1)..]);
        if (json is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception e) when (e is JsonException or ArgumentException or InvalidOperationException)
        {
            return null;
        }
    }

    // ---------------------------------------------------------------- JSON (exactly like JSON.stringify)

    private static void JsonString(StringBuilder sb, string s)
    {
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20)
                    {
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        sb.Append(c).Append(s[++i]);
                    }
                    else if (char.IsSurrogate(c))
                    {
                        // A lone surrogate (well-formed JSON.stringify).
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
    }

    private static void EntryJson(StringBuilder sb, ArchiveEntry e)
    {
        sb.Append("{\"path\":");
        JsonString(sb, e.Path);
        sb.Append(",\"type\":");
        JsonString(sb, e.Type);
        sb.Append(",\"mode\":").Append(Js.Num(e.Mode));
        sb.Append(",\"owner\":");
        JsonString(sb, e.Owner);
        sb.Append(",\"group\":");
        JsonString(sb, e.Group);
        sb.Append(",\"mtime\":").Append(Js.Num(e.Mtime));
        if (e.Content is not null)
        {
            sb.Append(",\"content\":");
            JsonString(sb, e.Content);
        }
        if (e.Size is long size) sb.Append(",\"size\":").Append(Js.Num(size));
        sb.Append('}');
    }

    private static string EntriesJson(List<ArchiveEntry> entries)
    {
        var sb = new StringBuilder("{\"entries\":[");
        for (int i = 0; i < entries.Count; i++)
        {
            if (i > 0) sb.Append(',');
            EntryJson(sb, entries[i]);
        }
        return sb.Append("]}").ToString();
    }

    private static string GzJson(GzPayload p)
    {
        var sb = new StringBuilder("{\"d\":");
        JsonString(sb, p.D);
        if (p.N is not null)
        {
            sb.Append(",\"n\":");
            JsonString(sb, p.N);
        }
        if (p.S is long s) sb.Append(",\"s\":").Append(Js.Num(s));
        return sb.Append('}').ToString();
    }

    private static string? JStr(JsonElement o, string name) =>
        o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? JNum(JsonElement o, string name) =>
        o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    private static List<ArchiveEntry>? ReadEntries(string magic, string content)
    {
        var p = Unwrap(magic, content);
        if (p is not { ValueKind: JsonValueKind.Object } root) return null;
        if (!root.TryGetProperty("entries", out var arr) || arr.ValueKind != JsonValueKind.Array) return null;
        var list = new List<ArchiveEntry>();
        foreach (var el in arr.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            var e = new ArchiveEntry
            {
                Path = JStr(el, "path") ?? "",
                Type = JStr(el, "type") ?? "file",
                Mode = (int)(JNum(el, "mode") ?? 0),
                Owner = JStr(el, "owner") ?? "",
                Group = JStr(el, "group") ?? "",
                Mtime = (long)(JNum(el, "mtime") ?? 0),
                Content = JStr(el, "content"),
            };
            if (JNum(el, "size") is double size) e.Size = (long)size;
            list.Add(e);
        }
        return list;
    }

    // ---------------------------------------------------------------- sizes

    /// <summary>The size of the content as programs see it (archives have a pretend size).</summary>
    private static long LogicalSize(string content) =>
        VfsLib.NodeSize(new FsNode { Type = "file", Mode = 0, Owner = "", Group = "", Mtime = 0, Content = content });

    /// <summary>
    /// Estimates how many bytes deflate (gzip/zip) compresses the text to: a simple LZ77 that
    /// looks for repetitions, where a repetition costs a few bytes and other characters a
    /// little under a byte each. Small files therefore do not get smaller.
    /// </summary>
    public static long DeflateSize(string text)
    {
        var b = Encoding.UTF8.GetBytes(text);
        int n = b.Length;
        if (n == 0) return 2;
        var last = new Dictionary<int, int>();
        int Key(int i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
        long literals = 0;
        long matches = 0;
        int i = 0;
        while (i < n)
        {
            if (i + 2 < n)
            {
                int k = Key(i);
                bool found = last.TryGetValue(k, out var j);
                last[k] = i;
                if (found && i - j <= 32768)
                {
                    int len = 3;
                    while (i + len < n && len < 258 && b[j + len] == b[i + len]) len++;
                    for (int p = i + 1; p < i + len && p + 2 < n; p++) last[Key(p)] = p;
                    matches++;
                    i += len;
                    continue;
                }
            }
            literals++;
            i++;
        }
        double fixedBits = literals * 8.5 + matches * 18;
        double dynamicBits = literals * 5 + matches * 22 + 500;
        return (long)Math.Ceiling(Math.Min(fixedBits, dynamicBits) / 8) + 2;
    }

    private static long EntrySize(ArchiveEntry e) => e.Type == "dir" ? 0 : e.Size ?? LogicalSize(e.Content ?? "");

    /// <summary>Roughly how many bytes deflate makes of the content.</summary>
    private static long PackedSize(string content, long? size = null)
    {
        if (size is long s) return (long)AwkCmd.JsRound(s * 0.45);
        var entries = ReadTar(content);
        // A tar archive is mostly zeros and headers, which compress to almost nothing.
        if (entries is not null) return 2 + entries.Sum(e => 24 + Js.Utf8Length(e.Path) + CompressedEntrySize(e));
        // Already compressed (.gz, .zip) does not get smaller – rather a little larger.
        if (content.StartsWith(GzMagic, StringComparison.Ordinal) || content.StartsWith(ZipMagic, StringComparison.Ordinal)) return LogicalSize(content) + 5;
        return DeflateSize(content);
    }

    /// <summary>Compressed size of a file in an archive. Never larger than the original (then it is stored uncompressed).</summary>
    private static long CompressedEntrySize(ArchiveEntry e)
    {
        if (e.Type == "dir") return 0;
        return Math.Min(PackedSize(e.Content ?? "", e.Size), EntrySize(e));
    }

    private static long CeilDiv(long a, long b) => (long)Math.Ceiling((double)a / b);

    /// <summary>A real tar archive: a 512 byte header per file, content in blocks of 512, in total a multiple of 10240.</summary>
    private static long TarSize(List<ArchiveEntry> entries)
    {
        long n = 1024;
        foreach (var e in entries) n += 512 + CeilDiv(EntrySize(e), 512) * 512;
        return CeilDiv(n, 10240) * 10240;
    }

    private static long GzSize(GzPayload p) =>
        18 + (!string.IsNullOrEmpty(p.N) ? Js.Utf8Length(p.N) + 1 : 0) + PackedSize(p.D, p.S);

    private static long ZipSize(List<ArchiveEntry> entries) =>
        entries.Aggregate(22L, (s, e) => s + 76 + 2 * Js.Utf8Length(EntryLabel(e)) + CompressedEntrySize(e));

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

    private static FsNode EntryNode(ArchiveEntry e) => new() { Type = e.Type, Mode = e.Mode, Owner = e.Owner, Group = e.Group, Mtime = e.Mtime, Content = null };

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
    private static readonly Regex LeadingDotDotRe = new(@"^(\.\.(/|\z))+", RegexOptions.CultureInvariant);

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

    // ---------------------------------------------------------------- tar

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

    // ---------------------------------------------------------------- gzip, gunzip, zcat

    private static string Ratio(long compressed, long uncompressed)
    {
        double r = uncompressed == 0 ? 0 : (1 - (double)compressed / uncompressed) * 100;
        return $"{AwkCmd.JsToFixed(r, 1).PadLeft(5)}%";
    }

    private static readonly (string Suffix, string Replacement)[] GzSuffixes =
    {
        (".tgz", ".tar"),
        (".gz", ""),
    };

    private static Func<CmdCtx, int> GzipLike(string mode) => ctx =>
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "cdfklqrtv123456789",
            Long = new Dictionary<string, string>
            {
                ["stdout"] = "c",
                ["to-stdout"] = "c",
                ["decompress"] = "d",
                ["uncompress"] = "d",
                ["force"] = "f",
                ["keep"] = "k",
                ["list"] = "l",
                ["quiet"] = "q",
                ["recursive"] = "r",
                ["test"] = "t",
                ["verbose"] = "v",
                ["fast"] = "1",
                ["best"] = "9",
            },
        });
        if (o.Error is not null)
        {
            ctx.Err($"gzip: {o.Error}\nTry `gzip --help' for more information.\n");
            return 1;
        }
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool Has(string f) => o.Flags.Contains(f);
        bool decompress = mode != "gzip" || Has("d") || Has("l") || Has("t");
        bool toStdout = mode == "zcat" || Has("c");
        bool verbose = Has("v") && !Has("q");
        int code = 0;
        void Warn() => code = Math.Max(code, 2);
        void Fail() => code = 1;
        int NotToTerminal()
        {
            ctx.Err("gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h\n");
            return 1;
        }
        var listRows = new List<(long C, long U, string Name)>();

        void HandleStdin()
        {
            var input = ctx.Stdin ?? "";
            if (!decompress)
            {
                if (ctx.IsTTY && !Has("f"))
                {
                    code = NotToTerminal();
                    return;
                }
                ctx.Out(GzipString(input));
                return;
            }
            if (input == "")
            {
                ctx.Err("gzip: stdin: unexpected end of file\n");
                Fail();
                return;
            }
            var gz = GunzipString(input);
            if (gz is null)
            {
                ctx.Err("gzip: stdin: not in gzip format\n");
                Fail();
                return;
            }
            if (Has("l")) listRows.Add((LogicalSize(input), gz.S ?? LogicalSize(gz.D), "stdout"));
            else if (!Has("t")) ctx.Out(gz.D);
        }

        void HandleFile(string label, string abs, FsNode node)
        {
            string content;
            try
            {
                content = sh.Vfs.ReadFile(abs, user);
            }
            catch (FsError e)
            {
                ctx.Err($"gzip: {label}: {e.Message}\n");
                Fail();
                return;
            }

            // Creates the output file with the same permissions and time as the original, and removes the original.
            bool Replace(string outLabel, string data, long? size = null)
            {
                var outAbs = JoinPath(VfsLib.Dirname(abs), VfsLib.Basename(outLabel));
                if (sh.Vfs.TryLookup(outAbs, user) is not null && !Has("f"))
                {
                    ctx.Err($"gzip: {outLabel} already exists; not overwritten\n");
                    Warn();
                    return false;
                }
                try
                {
                    var outNode = VfsLib.MakeFile(data, user.Uid == 0 ? node.Owner : user.Name, node.Mode, user.Uid == 0 ? node.Group : user.Groups.FirstOrDefault());
                    outNode.Mtime = node.Mtime;
                    if (size is not null) outNode.Size = size;
                    sh.Vfs.Insert(outAbs, outNode, user);
                    if (!Has("k")) sh.Vfs.Remove(abs, user);
                }
                catch (FsError e)
                {
                    ctx.Err($"gzip: {outLabel}: {e.Message}\n");
                    Fail();
                    return false;
                }
                return true;
            }

            if (decompress)
            {
                (string Suffix, string Replacement)? suffix = null;
                foreach (var sfx in GzSuffixes)
                {
                    if (label.EndsWith(sfx.Suffix, StringComparison.Ordinal) && label.Length > sfx.Suffix.Length)
                    {
                        suffix = sfx;
                        break;
                    }
                }
                if (suffix is null && !toStdout && !Has("l") && !Has("t"))
                {
                    ctx.Err($"gzip: {label}: unknown suffix -- ignored\n");
                    Warn();
                    return;
                }
                var gz = GunzipString(content);
                if (gz is null)
                {
                    ctx.Err($"gzip: {label}: not in gzip format\n");
                    Fail();
                    return;
                }
                var outLabel = suffix is { } sx ? label[..^sx.Suffix.Length] + sx.Replacement : label;
                long uncompressed = gz.S ?? LogicalSize(gz.D);
                if (Has("l"))
                {
                    listRows.Add((VfsLib.NodeSize(node), uncompressed, outLabel));
                }
                else if (Has("t"))
                {
                    if (verbose) ctx.Err($"{label}:\t OK\n");
                }
                else if (toStdout)
                {
                    ctx.Out(gz.D);
                }
                else if (Replace(outLabel, gz.D, gz.S))
                {
                    if (verbose) ctx.Err($"{label}:\t{Ratio(VfsLib.NodeSize(node), uncompressed)} -- {(Has("k") ? "created" : "replaced with")} {outLabel}\n");
                }
                return;
            }

            if (GzSuffixes.Any(s => label.EndsWith(s.Suffix, StringComparison.Ordinal)) && !toStdout)
            {
                ctx.Err($"gzip: {label} already has {(label.EndsWith(".tgz", StringComparison.Ordinal) ? ".tgz" : ".gz")} suffix -- unchanged\n");
                Warn();
                return;
            }
            var data = GzipString(content, VfsLib.Basename(label), node.Size);
            if (toStdout)
            {
                if (ctx.IsTTY && !Has("f"))
                {
                    code = NotToTerminal();
                    return;
                }
                ctx.Out(data);
            }
            else if (Replace($"{label}.gz", data))
            {
                if (verbose) ctx.Err($"{label}:\t{Ratio(LogicalSize(data), VfsLib.NodeSize(node))} -- {(Has("k") ? "created" : "replaced with")} {label}.gz\n");
            }
        }

        void Visit(string label, string abs)
        {
            FsNode node;
            try
            {
                node = sh.Vfs.Lookup(abs, user);
            }
            catch (FsError e)
            {
                ctx.Err($"gzip: {label}: {e.Message}\n");
                Fail();
                return;
            }
            if (node.Type == "dir")
            {
                if (!Has("r"))
                {
                    ctx.Err($"gzip: {label} is a directory -- ignored\n");
                    Warn();
                    return;
                }
                if (!VfsLib.HasPerm(node, user, 'r'))
                {
                    ctx.Err($"gzip: {label}: Permission denied\n");
                    Fail();
                    return;
                }
                foreach (var child in SortedChildren(node))
                    Visit(label.EndsWith('/') ? label + child : $"{label}/{child}", JoinPath(abs, child));
                return;
            }
            HandleFile(label, abs, node);
        }

        var operands = o.Operands.Count > 0 ? o.Operands : new List<string> { "-" };
        foreach (var op in operands)
        {
            if (op == "-") HandleStdin();
            else Visit(op, sh.Resolve(op));
        }

        if (listRows.Count > 0)
        {
            string Row(long c, long u, string name) =>
                $"{Js.Num(c).PadLeft(19)} {Js.Num(u).PadLeft(19)} {Ratio(c, u)} {name}\n";
            ctx.Out($"{"compressed".PadLeft(19)} {"uncompressed".PadLeft(19)}  ratio uncompressed_name\n");
            foreach (var r in listRows) ctx.Out(Row(r.C, r.U, r.Name));
            if (listRows.Count > 1)
            {
                long c = listRows.Sum(r => r.C);
                long u = listRows.Sum(r => r.U);
                ctx.Out(Row(c, u, "(totals)"));
            }
        }
        return code;
    };

    private const string GzipMan = """
NAMN
       gzip, gunzip, zcat - komprimera och dekomprimera filer

SYNOPSIS
       gzip [-k] [-v] [-d] [-c] [-l] FIL...
       gunzip FIL.gz...
       zcat FIL.gz...

BESKRIVNING
       gzip komprimerar EN fil i taget: fil.txt ersätts med den mindre
       filen fil.txt.gz. Rättigheter och tidsstämpel följer med. Vill du
       komprimera en hel katalog packar du först ihop den med tar (eller
       använder tar -z direkt).

       gunzip är samma sak som gzip -d och zcat samma sak som gzip -dc:
       zcat skriver ut innehållet utan att packa upp filen.

       Mycket små filer blir ofta STÖRRE av att komprimeras, eftersom
       gzip lägger till ett huvud med bland annat filnamnet.

FLAGGOR
       -k, --keep         behåll originalfilen
       -d, --decompress   dekomprimera (som gunzip)
       -c, --stdout       skriv resultatet till standard output
       -l, --list         visa storlek före och efter komprimering
       -v, --verbose      berätta hur mycket mindre filen blev
       -r, --recursive    komprimera alla filer i kataloger, var för sig
       -f, --force        skriv över filer som redan finns
       -1 ... -9          snabbare (-1) eller bättre (-9) komprimering

EXEMPEL
       gzip -kv server.log         komprimera, men behåll originalet
       gzip -l server.log.gz       hur mycket sparade vi?
       zcat server.log.gz | grep ERROR
""";

    private static readonly CommandDef Gzip = new() { Name = "gzip", Summary = "Komprimerar filer (fil → fil.gz)", Man = GzipMan, Run = GzipLike("gzip") };
    private static readonly CommandDef Gunzip = new() { Name = "gunzip", Summary = "Packar upp .gz-filer (samma som gzip -d)", Man = GzipMan, Run = GzipLike("gunzip") };
    private static readonly CommandDef Zcat = new() { Name = "zcat", Summary = "Visar innehållet i .gz-filer utan att packa upp dem", Man = GzipMan, Run = GzipLike("zcat") };

    // ---------------------------------------------------------------- zip and unzip

    private static string ZipMethod(ArchiveEntry e)
    {
        long size = EntrySize(e);
        if (e.Type == "dir" || size == 0) return "stored 0%";
        double pct = AwkCmd.JsRound((1 - (double)CompressedEntrySize(e) / size) * 100);
        return pct > 0 ? $"deflated {Js.Num(pct)}%" : "stored 0%";
    }

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

    // ---------------------------------------------------------------- du

    private static readonly Regex DigitsRe = new("^[0-9]+\\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Du = new()
    {
        Name = "du",
        Summary = "Visar hur mycket diskutrymme filer och kataloger tar",
        Man = """
NAMN
       du - visa hur mycket diskutrymme filer och kataloger använder
            (disk usage)

SYNOPSIS
       du [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storleken för varje katalog (och underkatalog) i kilobyte.
       Utan FIL visas aktuell katalog.

       Disken delas in i block om 4 KiB, så även en fil på 10 byte tar
       4.0K på disken. Den verkliga storleken visar du med --apparent-size
       eller med ls -l.

FLAGGOR
       -h, --human-readable   läsbara storlekar (4.0K, 12M, 1.5G)
       -s, --summarize        visa bara en summa per argument
       -a, --all              visa även filer, inte bara kataloger
       -c, --total            lägg till en rad med totalsumman
       -d, --max-depth=N      visa bara N nivåer ner
       -b, --bytes            verklig storlek i byte (--apparent-size)
           --apparent-size    verklig storlek i stället för diskutrymme

EXEMPEL
       du -sh dokument                 hur stor är katalogen?
       du -h -d 1 ~                    storleken på allt i hemkatalogen
       du -h dokument.tar dokument.tar.gz
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "hsacb",
                Values = "d",
                Long = new Dictionary<string, string>
                {
                    ["human-readable"] = "h",
                    ["summarize"] = "s",
                    ["all"] = "a",
                    ["total"] = "c",
                    ["bytes"] = "b",
                    ["apparent-size"] = "A",
                    ["max-depth"] = "d",
                },
            });
            if (o.Error is not null)
            {
                ctx.Err($"du: {o.Error}\nTry 'du --help' for more information.\n");
                return 1;
            }
            bool Has(string f) => o.Flags.Contains(f);
            if (Has("s") && Has("a"))
            {
                ctx.Err("du: cannot both summarize and show all entries\nTry 'du --help' for more information.\n");
                return 1;
            }
            double maxDepth = double.PositiveInfinity;
            if (o.Values.Get("d") is string dv)
            {
                if (!DigitsRe.IsMatch(dv))
                {
                    ctx.Err($"du: invalid maximum depth '{dv}'\nTry 'du --help' for more information.\n");
                    return 1;
                }
                maxDepth = Js.Number(dv);
            }
            if (Has("s")) maxDepth = 0;
            bool apparent = Has("b") || Has("A");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            long Usage(FsNode n) => apparent ? VfsLib.NodeSize(n) : CeilDiv(VfsLib.NodeSize(n), 4096) * 4096;
            string Fmt(long bytes) => Has("h") ? UtilCmd.HumanSize(bytes) : Has("b") ? Js.Num(bytes) : Js.Num(CeilDiv(bytes, 1024));
            int code = 0;
            long total = 0;

            long Walk(string label, FsNode node, int depth)
            {
                long size = Usage(node);
                if (node.Type == "dir")
                {
                    if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
                    {
                        ctx.Err($"du: cannot read directory '{label}': Permission denied\n");
                        code = 1;
                    }
                    else
                    {
                        foreach (var child in SortedChildren(node))
                            size += Walk(label.EndsWith('/') ? label + child : $"{label}/{child}", node.Children![child], depth + 1);
                    }
                }
                if (depth <= maxDepth && (node.Type == "dir" || Has("a") || depth == 0)) ctx.Out($"{Fmt(size)}\t{label}\n");
                return size;
            }

            foreach (var op in o.Operands.Count > 0 ? o.Operands : new List<string> { "." })
            {
                try
                {
                    total += Walk(op, sh.Vfs.Lookup(sh.Resolve(op), user), 0);
                }
                catch (FsError e)
                {
                    ctx.Err($"du: cannot access '{op}': {e.Message}\n");
                    code = 1;
                }
            }
            if (Has("c")) ctx.Out($"{Fmt(total)}\ttotal\n");
            return code;
        },
    };

    public static List<CommandDef> All { get; } = new() { Tar, Gzip, Gunzip, Zcat, Zip, Unzip, Du };
}
