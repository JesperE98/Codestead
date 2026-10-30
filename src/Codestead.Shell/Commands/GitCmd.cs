using System.Security.Cryptography;
using System.Text.Json;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/git.ts (part 1: objects, refs, revisions, index, config, work tree).
//
// git – a small but real version control system working against the virtual file system.
// The repository is stored in .git/ as ordinary files: objects (blob, tree, commit, tag) under
// .git/objects/xx/…, branches under .git/refs/heads/, HEAD, index, config and a simple reflog
// in .git/logs/HEAD. Everything is text, so the repository is saved with the terminal as JSON.
// Objects are hashed with SHA-1 like real git – a blob gets the same id as on a real computer.
// Trees are stored simplified as a flat list of paths.

/// <summary>A summary of a repository (see <see cref="GitCmd.GitRepoState"/>).</summary>
public partial class RepoState
{
    public string? Branch { get; set; }
    public string? Head { get; set; }
    public OrderedDictionary<string, string> Branches { get; set; } = Js.Obj<string>();
    /// <summary>The files in the HEAD commit.</summary>
    public List<string> Files { get; set; } = new();
    /// <summary>Number of commits reachable from HEAD.</summary>
    public int Commits { get; set; }
}

public static partial class GitCmd
{
    private const RegexOptions RO = RegexOptions.CultureInvariant;

    // ---------- SHA-1 ----------

    public static string Sha1(string text) => Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes(text)));

    /// <summary>The same id as `git hash-object` gives for a file with the content `data`.</summary>
    public static string BlobHash(string data) => Sha1($"blob {Js.Utf8Length(data)}\0{data}");

    private static readonly string Zero = "0".Repeat(40);
    private static string Short(string h) => h.Slice(0, 7);

    // ---------- Errors and output ----------

    /// <summary>Aborts the git command with a text on stderr and an exit status.</summary>
    private sealed class GitExit : Exception
    {
        public string Text { get; }
        public int Code { get; }

        public GitExit(string text, int code) : base(text)
        {
            Text = text;
            Code = code;
        }
    }

    private static GitExit Fatal(string msg) => new($"fatal: {msg}\n", 128);

    private static GitExit Fail(string text, int code = 1) => new(text.EndsWith('\n') || text == "" ? text : text + "\n", code);

    private static class Col
    {
        public const string Reset = "\x1b[m";
        public const string Bold = "\x1b[1m";
        public const string Red = "\x1b[31m";
        public const string Green = "\x1b[32m";
        public const string Yellow = "\x1b[33m";
        public const string Cyan = "\x1b[36m";
        public const string BoldRed = "\x1b[1;31m";
        public const string BoldGreen = "\x1b[1;32m";
        public const string BoldYellow = "\x1b[1;33m";
        public const string BoldCyan = "\x1b[1;36m";
        public const string Blue = "\x1b[34m";
    }

    private sealed class G
    {
        public required CmdCtx Ctx;
        public required Shell Sh;
        public required User User;
        public required string Cwd;
        public required bool Tty;
        public required Action<string> Out;
        public required Action<string> Err;

        /// <summary>Colours the text if output goes to the terminal.</summary>
        public string C(string color, string s) => Tty && s != "" ? $"{color}{s}{Col.Reset}" : s;

        public void Note(string sv, string en) => Ctx.Err($"{UtilCmd.Color.Dim}{Sh.Msg(sv, en)}{UtilCmd.Color.Reset}\n");

        public void Hint(string text) =>
            Ctx.Err(string.Join("\n", text.Split('\n').Select(l => Tty ? $"{Col.Yellow}hint:{(l != "" ? " " + l : "")}{Col.Reset}" : $"hint:{(l != "" ? " " + l : "")}")) + "\n");
    }

    private static G MakeG(CmdCtx ctx) => new()
    {
        Ctx = ctx,
        Sh = ctx.Sh,
        User = ctx.Sh.CurrentUser(),
        Cwd = ctx.Sh.Cwd,
        Tty = ctx.IsTTY,
        Out = s => ctx.Out(s),
        Err = s => ctx.Err(s),
    };

    // ---------- JS object semantics ----------

    /// <summary>
    /// A plain JS object used as a map (Record&lt;string, T&gt;): missing keys read as null and
    /// keys iterate like Object.keys (array-index keys first in numeric order, then insertion order).
    /// </summary>
    private sealed class JsMap<T> where T : class
    {
        private readonly OrderedDictionary<string, T> d = new(StringComparer.Ordinal);

        public T? this[string key]
        {
            get => d.TryGetValue(key, out var v) ? v : null;
            set => d[key] = value!;
        }

        public bool Has(string key) => d.ContainsKey(key);
        public void Delete(string key) => d.Remove(key);
        public int Count => d.Count;
        public List<string> Keys => JsKeyOrder(d.Keys);

        /// <summary>{ ...this }</summary>
        public JsMap<T> Copy()
        {
            var c = new JsMap<T>();
            foreach (var k in Keys) c[k] = d[k];
            return c;
        }

        /// <summary>{ ...this, ...other }</summary>
        public JsMap<T> Merge(JsMap<T> other)
        {
            var c = Copy();
            foreach (var k in other.Keys) c[k] = other[k];
            return c;
        }
    }

    private static bool IsArrayIndex(string k)
    {
        if (k.Length == 0 || k.Length > 10) return false;
        if (k == "0") return true;
        if (k[0] < '1' || k[0] > '9') return false;
        foreach (var ch in k)
            if (ch < '0' || ch > '9') return false;
        return ulong.Parse(k, CultureInfo.InvariantCulture) < 4294967295UL;
    }

    /// <summary>The order Object.keys gives for keys inserted in this order.</summary>
    private static List<string> JsKeyOrder(IEnumerable<string> keys)
    {
        var all = keys.ToList();
        var idx = all.Where(IsArrayIndex).OrderBy(k => ulong.Parse(k, CultureInfo.InvariantCulture)).ToList();
        if (idx.Count == 0) return all;
        idx.AddRange(all.Where(k => !IsArrayIndex(k)));
        return idx;
    }

    /// <summary>new Set([...a, ...b]) – distinct values in first-seen order.</summary>
    private static List<string> Union(params IEnumerable<string>[] lists)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var res = new List<string>();
        foreach (var l in lists)
            foreach (var x in l)
                if (seen.Add(x)) res.Add(x);
        return res;
    }

    /// <summary>A Set&lt;string&gt; that iterates in insertion order.</summary>
    private sealed class OSet : IEnumerable<string>
    {
        private readonly HashSet<string> set = new(StringComparer.Ordinal);
        private readonly List<string> order = new();

        public bool Add(string x)
        {
            if (!set.Add(x)) return false;
            order.Add(x);
            return true;
        }

        public bool Has(string x) => set.Contains(x);
        public int Count => order.Count;
        public IEnumerator<string> GetEnumerator() => order.GetEnumerator();
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private static List<string> SortedOrdinal(IEnumerable<string> xs)
    {
        var l = xs.ToList();
        l.Sort(StringComparer.Ordinal);
        return l;
    }

    // ---------- JSON.stringify(x, null, 1) ----------

    private static string JsonQuote(string s)
    {
        var sb = new StringBuilder("\"");
        for (int i = 0; i < s.Length; i++)
        {
            char ch = s[i];
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20) sb.Append($"\\u{(int)ch:x4}");
                    else if (char.IsHighSurrogate(ch) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        sb.Append(ch).Append(s[i + 1]);
                        i++;
                    }
                    else if (char.IsSurrogate(ch)) sb.Append($"\\u{(int)ch:x4}");
                    else sb.Append(ch);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }

    /// <summary>
    /// Serialises a value like JSON.stringify(v, null, 1). Values: string, long/int,
    /// List&lt;object&gt; (array) or List&lt;KeyValuePair&lt;string, object?&gt;&gt; (object; null values are skipped).
    /// </summary>
    private static string JsonStringify(object v, string indent = "")
    {
        var inner = indent + " ";
        switch (v)
        {
            case string s:
                return JsonQuote(s);
            case int n:
                return n.ToString(CultureInfo.InvariantCulture);
            case long n:
                return n.ToString(CultureInfo.InvariantCulture);
            case List<KeyValuePair<string, object?>> obj:
            {
                var parts = obj.Where(kv => kv.Value is not null).Select(kv => $"{inner}{JsonQuote(kv.Key)}: {JsonStringify(kv.Value!, inner)}").ToList();
                return parts.Count == 0 ? "{}" : "{\n" + string.Join(",\n", parts) + "\n" + indent + "}";
            }
            case List<object> arr:
            {
                if (arr.Count == 0) return "[]";
                return "[\n" + string.Join(",\n", arr.Select(x => inner + JsonStringify(x, inner))) + "\n" + indent + "]";
            }
            default:
                throw new ArgumentException("unsupported JSON value");
        }
    }

    private static List<KeyValuePair<string, object?>> JsonTree(JsMap<string> t) =>
        t.Keys.Select(k => new KeyValuePair<string, object?>(k, t[k])).ToList();

    private static JsMap<string> TreeFromJson(JsonElement e)
    {
        var t = new JsMap<string>();
        if (e.ValueKind != JsonValueKind.Object) return t;
        foreach (var p in e.EnumerateObject())
        {
            if (p.Value.ValueKind == JsonValueKind.String) t[p.Name] = p.Value.GetString()!;
            else if (p.Value.ValueKind is not JsonValueKind.Null) t[p.Name] = p.Value.ToString();
        }
        return t;
    }

    // ---------- File system ----------

    private static string Join(string a, string b) => b == "" ? a : a == "/" ? $"/{b}" : $"{a}/{b}";

    private static string? ReadText(G g, string path)
    {
        try
        {
            var node = g.Sh.Vfs.Lookup(path, g.User);
            if (node.Type != "file") return null;
            return g.Sh.Vfs.ReadFile(path, g.User);
        }
        catch (FsError e) when (e.Code is "ENOENT" or "ENOTDIR")
        {
            return null;
        }
    }

    private static void Mkdirp(G g, string path)
    {
        var cur = "";
        foreach (var seg in VfsLib.NormalizePath(path).Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            var node = g.Sh.Vfs.TryLookup(cur, g.User);
            if (node is null) g.Sh.Vfs.Mkdir(cur, g.User);
            else if (node.Type != "dir") throw new FsError("ENOTDIR");
        }
    }

    private static void WriteText(G g, string path, string content)
    {
        Mkdirp(g, VfsLib.Dirname(path));
        g.Sh.Vfs.WriteFile(path, content, g.User);
    }

    private static void RemoveFile(G g, string path)
    {
        if (g.Sh.Vfs.TryLookup(path, g.User) is not null) g.Sh.Vfs.Remove(path, g.User);
    }

    /// <summary>Removes empty directories upwards from `dir` (but never `stop`).</summary>
    private static void PruneDirs(G g, string dir, string stop)
    {
        while (dir != stop && dir.StartsWith(stop + "/", StringComparison.Ordinal))
        {
            var node = g.Sh.Vfs.TryLookup(dir, g.User);
            if (node is null || node.Type != "dir" || (node.Children?.Count ?? 0) > 0) return;
            g.Sh.Vfs.Remove(dir, g.User);
            dir = VfsLib.Dirname(dir);
        }
    }

    private static bool IsDirAt(G g, string p) => g.Sh.Vfs.TryLookup(p, g.User)?.Type == "dir";
    private static bool ExistsAt(G g, string p) => g.Sh.Vfs.TryLookup(p, g.User) is not null;

    /// <summary>Path from the directory `from` to `to` (both absolute).</summary>
    private static string RelPath(string from, string to)
    {
        var a = from.Split('/').Where(s => s != "").ToList();
        var b = to.Split('/').Where(s => s != "").ToList();
        int i = 0;
        while (i < a.Count && i < b.Count && a[i] == b[i]) i++;
        var parts = a.Skip(i).Select(_ => "..").Concat(b.Skip(i)).ToList();
        var s = string.Join("/", parts);
        return s != "" ? s : ".";
    }

    // ---------- The repository ----------

    private sealed class Repo
    {
        public required G G;
        public required string GitDir;
        /// <summary>The work tree, or null for a "bare" repository (only the history, as on a server).</summary>
        public required string? Root;
        /// <summary>Content of blobs that only exist in the work tree (not saved as objects).</summary>
        public Dictionary<string, string> Blobs { get; } = new(StringComparer.Ordinal);
        public Dictionary<string, Commit> CommitCache { get; } = new(StringComparer.Ordinal);
    }

    private static bool LooksLikeGitDir(G g, string dir) =>
        ReadText(g, $"{dir}/HEAD") is not null && IsDirAt(g, $"{dir}/objects") && IsDirAt(g, $"{dir}/refs");

    private static Repo OpenRepo(G g, string gitDir, string? root) => new() { G = g, GitDir = gitDir, Root = root };

    private static Repo? Discover(G g, string start)
    {
        var dir = VfsLib.NormalizePath(start);
        for (;;)
        {
            if (IsDirAt(g, Join(dir, ".git")) && LooksLikeGitDir(g, Join(dir, ".git"))) return OpenRepo(g, Join(dir, ".git"), dir);
            if (LooksLikeGitDir(g, dir)) return OpenRepo(g, dir, null);
            if (dir == "/") return null;
            dir = VfsLib.Dirname(dir);
        }
    }

    private static Repo NeedRepo(G g) => Discover(g, g.Cwd) ?? throw Fatal("not a git repository (or any of the parent directories): .git");

    private static string NeedWork(Repo r) => r.Root ?? throw Fatal("this operation must be run in a work tree");

    private static string Gpath(Repo r, string rel) => $"{r.GitDir}/{rel}";

    // ---------- Objects ----------

    private sealed record Obj(string Type, string Data);

    private static string ObjPath(Repo r, string h) => Gpath(r, $"objects/{h.Slice(0, 2)}/{h.Slice(2)}");

    private static string WriteObj(Repo r, string type, string data)
    {
        var raw = $"{type} {Js.Utf8Length(data)}\0{data}";
        var h = Sha1(raw);
        var p = ObjPath(r, h);
        if (!ExistsAt(r.G, p)) WriteText(r.G, p, raw);
        return h;
    }

    private static Obj? ReadObj(Repo r, string h)
    {
        if (r.Blobs.TryGetValue(h, out var blob)) return new Obj("blob", blob);
        var raw = ReadText(r.G, ObjPath(r, h));
        if (raw is null) return null;
        int nul = raw.IndexOf('\0');
        return new Obj(raw.Slice(0, nul).Split(' ')[0], raw.Slice(nul + 1));
    }

    private static string ReadBlob(Repo r, string h)
    {
        var o = ReadObj(r, h) ?? throw Fatal($"unable to read {h}");
        return o.Data;
    }

    private static readonly Regex TwoHexRe = new("^[0-9a-f]{2}\\z", RO);

    /// <summary>All object ids in the repository.</summary>
    private static List<string> AllObjects(Repo r)
    {
        var dir = r.G.Sh.Vfs.TryLookup(Gpath(r, "objects"), r.G.User);
        var ids = new List<string>();
        foreach (var pre in JsKeyOrder(dir?.Children?.Keys ?? (IEnumerable<string>)Array.Empty<string>()))
        {
            var node = dir!.Children![pre];
            if (!TwoHexRe.IsMatch(pre) || node.Type != "dir") continue;
            foreach (var rest in JsKeyOrder(node.Children?.Keys ?? (IEnumerable<string>)Array.Empty<string>())) ids.Add(pre + rest);
        }
        return ids;
    }

    // A tree (Tree in the TypeScript) is a JsMap<string>: path → blob id. Real git has one tree
    // per directory; here a flat list is enough.

    private static string WriteTree(Repo r, JsMap<string> t)
    {
        var data = string.Concat(SortedOrdinal(t.Keys).Select(p => $"100644 blob {t[p]}\t{p}\n"));
        return WriteObj(r, "tree", data);
    }

    private static readonly Regex TreeLineRe = new("^[0-9]+ blob ([0-9a-f]{40})\t(.*)\\z", RO);

    private static JsMap<string> ReadTree(Repo r, string h)
    {
        var o = ReadObj(r, h);
        if (o is null || o.Type != "tree") throw Fatal($"not a tree object: {h}");
        var t = new JsMap<string>();
        foreach (var line in o.Data.Split('\n'))
        {
            var m = TreeLineRe.Match(line);
            if (m.Success) t[m.Groups[2].Value] = m.Groups[1].Value;
        }
        return t;
    }

    private sealed class Ident
    {
        public string Name = "";
        public string Email = "";
        public long Time;
        public string Tz = "+0000";
    }

    private sealed class Commit
    {
        public string Hash = "";
        public string Tree = "";
        public List<string> Parents = new();
        public Ident Author = new();
        public Ident Committer = new();
        public string Message = "";
    }

    private static string FmtIdent(Ident i) => $"{i.Name} <{i.Email}> {i.Time} {i.Tz}";

    private static readonly Regex IdentRe = new("^(.*) <(.*)> ([0-9]+) ([+-][0-9]{4})\\z", RO);

    private static Ident ParseIdent(string s)
    {
        var m = IdentRe.Match(s);
        if (!m.Success) return new Ident { Name = s, Email = "", Time = 0, Tz = "+0000" };
        return new Ident { Name = m.Groups[1].Value, Email = m.Groups[2].Value, Time = (long)Js.Number(m.Groups[3].Value), Tz = m.Groups[4].Value };
    }

    private static string WriteCommit(Repo r, Commit c)
    {
        var data = $"tree {c.Tree}\n";
        foreach (var p in c.Parents) data += $"parent {p}\n";
        data += $"author {FmtIdent(c.Author)}\ncommitter {FmtIdent(c.Committer)}\n\n{c.Message}";
        return WriteObj(r, "commit", data);
    }

    private static Commit ReadCommit(Repo r, string h)
    {
        if (r.CommitCache.TryGetValue(h, out var hit)) return hit;
        var o = ReadObj(r, h);
        if (o is null || o.Type != "commit") throw Fatal($"bad object {h}");
        int end = o.Data.IndexOf("\n\n", StringComparison.Ordinal);
        var head = end < 0 ? o.Data : o.Data.Slice(0, end);
        var c = new Commit { Hash = h, Tree = "", Author = ParseIdent(""), Committer = ParseIdent(""), Message = end < 0 ? "" : o.Data.Slice(end + 2) };
        foreach (var line in head.Split('\n'))
        {
            int sp = line.IndexOf(' ');
            var key = line.Slice(0, sp);
            var val = line.Slice(sp + 1);
            if (key == "tree") c.Tree = val;
            else if (key == "parent") c.Parents.Add(val);
            else if (key == "author") c.Author = ParseIdent(val);
            else if (key == "committer") c.Committer = ParseIdent(val);
        }
        r.CommitCache[h] = c;
        return c;
    }

    private static JsMap<string> CommitTree(Repo r, string? h) => !string.IsNullOrEmpty(h) ? ReadTree(r, ReadCommit(r, h).Tree) : new JsMap<string>();

    private static string Subject(string message) => message.Split('\n')[0];
    private static string Subject(Commit c) => Subject(c.Message);

    private static readonly Regex TagObjectRe = new("^object ([0-9a-f]{40})", RO);

    /// <summary>Follows annotated tags to the object they point at.</summary>
    private static string Peel(Repo r, string h)
    {
        for (int i = 0; i < 10; i++)
        {
            var o = ReadObj(r, h);
            if (o is null || o.Type != "tag") return h;
            var m = TagObjectRe.Match(o.Data);
            if (m.Success) h = m.Groups[1].Value;
        }
        return h;
    }

    // ---------- References ----------

    private static readonly Regex Hash40Re = new("^[0-9a-f]{40}\\z", RO);

    private static string? ReadRef(Repo r, string name, int depth = 0)
    {
        var text = ReadText(r.G, Gpath(r, name));
        if (text is null) return null;
        var t = text.Trim();
        if (t.StartsWith("ref: ", StringComparison.Ordinal)) return depth > 5 ? null : ReadRef(r, t.Slice(5), depth + 1);
        return Hash40Re.IsMatch(t) ? t : null;
    }

    private static void WriteRef(Repo r, string name, string h) => WriteText(r.G, Gpath(r, name), h + "\n");

    private static void DeleteRef(Repo r, string name)
    {
        RemoveFile(r.G, Gpath(r, name));
        PruneDirs(r.G, VfsLib.Dirname(Gpath(r, name)), Gpath(r, "refs"));
    }

    /// <summary>The names of all references under e.g. "refs/heads/" (without the prefix), sorted.</summary>
    private static List<string> ListRefs(Repo r, string prefix)
    {
        var names = new List<string>();
        void Walk(FsNode node, string rel)
        {
            if (node.Children is null) return;
            foreach (var name in JsKeyOrder(node.Children.Keys))
            {
                var child = node.Children[name];
                var p = rel != "" ? $"{rel}/{name}" : name;
                if (child.Type == "dir") Walk(child, p);
                else names.Add(p);
            }
        }
        var dir = r.G.Sh.Vfs.TryLookup(Gpath(r, prefix.EndsWith('/') ? prefix[..^1] : prefix), r.G.User);
        if (dir?.Type == "dir") Walk(dir, "");
        return SortedOrdinal(names);
    }

    private sealed class Head
    {
        /// <summary>The branch HEAD points at, or null if HEAD is detached.</summary>
        public string? Branch;
        /// <summary>The commit HEAD points at (missing in an empty repository).</summary>
        public string? Hash;
    }

    private static Head ReadHead(Repo r)
    {
        var text = (ReadText(r.G, Gpath(r, "HEAD")) ?? "").Trim();
        if (text.StartsWith("ref: refs/heads/", StringComparison.Ordinal))
        {
            var branch = text.Slice("ref: refs/heads/".Length);
            return new Head { Branch = branch, Hash = ReadRef(r, $"refs/heads/{branch}") };
        }
        return new Head { Branch = null, Hash = Hash40Re.IsMatch(text) ? text : null };
    }

    private static void SetHeadBranch(Repo r, string branch) => WriteText(r.G, Gpath(r, "HEAD"), $"ref: refs/heads/{branch}\n");

    private static void SetHeadDetached(Repo r, string h) => WriteText(r.G, Gpath(r, "HEAD"), h + "\n");

    /// <summary>Moves the branch HEAD points at (or HEAD itself if detached).</summary>
    private static void MoveHead(Repo r, string h, string reflogMsg)
    {
        var head = ReadHead(r);
        if (!string.IsNullOrEmpty(head.Branch)) WriteRef(r, $"refs/heads/{head.Branch}", h);
        else SetHeadDetached(r, h);
        Reflog(r, head.Hash, h, reflogMsg);
    }

    private static void Reflog(Repo r, string? from, string to, string msg)
    {
        var id = Identity(r.G, r, false) ?? new Ident { Name = r.G.User.Name, Email = $"{r.G.User.Name}@{r.G.Sh.Distro.Hostname}", Time = Now(), Tz = TzNow() };
        var path = Gpath(r, "logs/HEAD");
        var old = ReadText(r.G, path) ?? "";
        WriteText(r.G, path, old + $"{from ?? Zero} {to} {FmtIdent(id)}\t{msg}\n");
    }

    private sealed record ReflogEntry(string To, string Msg);

    private static List<ReflogEntry> ReadReflog(Repo r) =>
        (ReadText(r.G, Gpath(r, "logs/HEAD")) ?? "")
            .Split('\n')
            .Where(l => l != "")
            .Select(l =>
            {
                var parts = l.Split(' ');
                return new ReflogEntry(parts.Length > 1 ? parts[1] : "", l.Slice(l.IndexOf('\t') + 1));
            })
            .ToList();

    private static readonly Regex CheckoutMoveRe = new("^checkout: moving from (\\S+) to ", RO);

    /// <summary>The branch you were on before the latest switch (for `git switch -`).</summary>
    private static string? PreviousBranch(Repo r)
    {
        var log = ReadReflog(r);
        for (int i = log.Count - 1; i >= 0; i--)
        {
            var m = CheckoutMoveRe.Match(log[i].Msg);
            if (m.Success) return m.Groups[1].Value;
        }
        return null;
    }

    private static readonly Regex BadRefRe = new("\\.\\.|@\\{|//|/\\.|^\\.|[\\s~^:?*\\[\\\\\\x00-\\x1f\\x7f]", RO);

    private static bool ValidBranchName(string? name) =>
        !string.IsNullOrEmpty(name) &&
        !name.StartsWith('-') &&
        !name.StartsWith('/') &&
        !name.EndsWith('/') &&
        !name.EndsWith('.') &&
        !name.EndsWith(".lock", StringComparison.Ordinal) &&
        name != "HEAD" &&
        name != "@" &&
        !BadRefRe.IsMatch(name);

    private static void CheckBranchName(G g, string name)
    {
        if (ValidBranchName(name)) return;
        g.Err($"fatal: '{name}' is not a valid branch name\n");
        g.Hint("See `man git check-ref-format`\nDisable this message with \"git config set advice.refSyntax false\"");
        throw new GitExit("", 128);
    }

    private static bool BranchExists(Repo r, string b) => ReadRef(r, $"refs/heads/{b}") is not null;

    // ---------- Revisions ----------

    private static readonly Regex RevRe = new("^(.*?)((?:[~^][0-9]*)*)\\z", RO);
    private static readonly Regex SpecialHeadRe = new("^(HEAD|ORIG_HEAD|MERGE_HEAD|FETCH_HEAD)\\z", RO);
    private static readonly Regex ShortHexRe = new("^[0-9a-f]{4,40}\\z", RO);
    private static readonly Regex RevOpRe = new("[~^][0-9]*", RO);
    private static readonly Regex WsRe = new("\\s", RO);

    /// <summary>Resolves e.g. HEAD, main, origin/main, v1.0, a1b2c3d, HEAD~2 and main^2. Returns an object id.</summary>
    private static string? ResolveRev(Repo r, string rev)
    {
        var m = RevRe.Match(rev);
        if (!m.Success) return null;
        var @base = m.Groups[1].Value;
        var suffix = m.Groups[2].Value;
        if (@base == "" || @base == "@") @base = "HEAD";
        string? h = null;
        if (SpecialHeadRe.IsMatch(@base))
        {
            h = @base == "HEAD" ? ReadHead(r).Hash : ReadText(r.G, Gpath(r, @base)) is { } txt ? WsRe.Split(txt.Trim())[0] : null;
        }
        else if (@base == "@{-1}" || @base == "-")
        {
            var prev = PreviousBranch(r);
            h = prev is not null ? (ReadRef(r, $"refs/heads/{prev}") ?? (Hash40Re.IsMatch(prev) ? prev : null)) : null;
        }
        else
        {
            var refs = @base.StartsWith("refs/", StringComparison.Ordinal)
                ? new[] { @base }
                : new[] { $"refs/{@base}", $"refs/tags/{@base}", $"refs/heads/{@base}", $"refs/remotes/{@base}", $"refs/remotes/{@base}/HEAD" };
            foreach (var rf in refs)
            {
                h = ReadRef(r, rf);
                if (!string.IsNullOrEmpty(h)) break;
            }
            if (string.IsNullOrEmpty(h) && ShortHexRe.IsMatch(@base))
            {
                var hits = AllObjects(r).Where(id => id.StartsWith(@base, StringComparison.Ordinal)).ToList();
                if (hits.Count == 1) h = hits[0];
                else if (hits.Count > 1) throw Fatal($"short object ID {@base} is ambiguous");
            }
        }
        if (string.IsNullOrEmpty(h) || !Hash40Re.IsMatch(h)) return null;
        foreach (Match opm in RevOpRe.Matches(suffix))
        {
            var op = opm.Value;
            double n = op.Length > 1 ? Js.Number(op.Slice(1)) : 1;
            var c = ReadCommit(r, Peel(r, h));
            if (op[0] == '~')
            {
                for (double i = 0; i < n; i++)
                {
                    if (c.Parents.Count == 0) return null;
                    c = ReadCommit(r, c.Parents[0]);
                }
                h = c.Hash;
            }
            else
            {
                if (n == 0)
                {
                    h = c.Hash;
                    continue;
                }
                var pi = n - 1;
                if (pi < 0 || pi >= c.Parents.Count) return null;
                h = c.Parents[(int)pi];
            }
        }
        return h;
    }

    private static string? ResolveCommit(Repo r, string rev)
    {
        var h = ResolveRev(r, rev);
        if (h is null) return null;
        var p = Peel(r, h);
        return ReadObj(r, p)?.Type == "commit" ? p : null;
    }

    private static string NeedCommit(Repo r, string rev) => ResolveCommit(r, rev) ?? throw Fatal($"not a valid object name: '{rev}'");

    /// <summary>A tree from e.g. "HEAD", a commit or a tree id.</summary>
    private static JsMap<string>? RevTree(Repo r, string rev)
    {
        var h = ResolveRev(r, rev);
        if (h is null) return null;
        var p = Peel(r, h);
        var o = ReadObj(r, p);
        if (o?.Type == "commit") return ReadTree(r, ReadCommit(r, p).Tree);
        if (o?.Type == "tree") return ReadTree(r, p);
        return null;
    }

    private static OSet Ancestors(Repo r, string? h)
    {
        var seen = new OSet();
        var stack = new List<string>();
        if (!string.IsNullOrEmpty(h)) stack.Add(h);
        while (stack.Count > 0)
        {
            var x = stack[^1];
            stack.RemoveAt(stack.Count - 1);
            if (seen.Has(x)) continue;
            seen.Add(x);
            stack.AddRange(ReadCommit(r, x).Parents);
        }
        return seen;
    }

    private static bool IsAncestor(Repo r, string a, string b) => Ancestors(r, b).Has(a);

    private static string? MergeBase(Repo r, string a, string b)
    {
        var A = Ancestors(r, a);
        var common = Ancestors(r, b).Where(A.Has).ToList();
        var best = common.Where(x => !common.Any(y => y != x && IsAncestor(r, x, y))).ToList();
        best.StableSort((x, y) => ReadCommit(r, y).Committer.Time.CompareTo(ReadCommit(r, x).Committer.Time));
        return best.Count > 0 ? best[0] : null;
    }

    // ---------- Index ----------

    private sealed class Unmerged
    {
        public string? Base;
        public string? Ours;
        public string? Theirs;
    }

    private sealed class Index
    {
        public JsMap<string> Entries = new();
        /// <summary>Files with a conflict after a merge, with the three versions.</summary>
        public JsMap<Unmerged> Unmerged = new();
    }

    private static Index ReadIndex(Repo r)
    {
        var text = ReadText(r.G, Gpath(r, "index"));
        if (string.IsNullOrEmpty(text)) return new Index();
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw Fatal("index file corrupt");
            var idx = new Index();
            if (root.TryGetProperty("entries", out var entries)) idx.Entries = TreeFromJson(entries);
            if (root.TryGetProperty("unmerged", out var unmerged) && unmerged.ValueKind == JsonValueKind.Object)
            {
                foreach (var p in unmerged.EnumerateObject())
                {
                    string? Str(string k) => p.Value.ValueKind == JsonValueKind.Object && p.Value.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                    idx.Unmerged[p.Name] = new Unmerged { Base = Str("base"), Ours = Str("ours"), Theirs = Str("theirs") };
                }
            }
            return idx;
        }
        catch (JsonException)
        {
            throw Fatal("index file corrupt");
        }
    }

    private static void WriteIndex(Repo r, Index idx)
    {
        List<KeyValuePair<string, object?>> Sorted<T>(JsMap<T> o, Func<T, object> conv) where T : class =>
            JsKeyOrder(SortedOrdinal(o.Keys)).Select(k => new KeyValuePair<string, object?>(k, conv(o[k]!))).ToList();
        var json = new List<KeyValuePair<string, object?>>
        {
            new("version", 1),
            new("entries", Sorted(idx.Entries, h => h)),
            new("unmerged", Sorted(idx.Unmerged, u => new List<KeyValuePair<string, object?>> { new("base", u.Base), new("ours", u.Ours), new("theirs", u.Theirs) })),
        };
        WriteText(r.G, Gpath(r, "index"), JsonStringify(json) + "\n");
    }

    // ---------- Configuration ----------

    private sealed class ConfigEntry
    {
        public string Key = "";
        public string Value = "";
        public string Scope = "";
        public string Path = "";
    }

    private static readonly Regex SectionRe = new("^\\[\\s*([A-Za-z0-9.-]+)(?:\\s+\"((?:[^\"\\\\]|\\\\.)*)\")?\\s*\\]", RO);
    private static readonly Regex KvRe = new("^([A-Za-z][A-Za-z0-9-]*)\\s*(?:=\\s*(.*))?\\z", RO);
    private static readonly Regex KvNameRe = new("^([A-Za-z][A-Za-z0-9-]*)\\s*(=|\\z)", RO);
    private static readonly Regex UnescapeRe = new("\\\\(.)", RO);

    private static List<ConfigEntry> ParseConfig(string text)
    {
        var entries = new List<ConfigEntry>();
        var section = "";
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line == "" || line.StartsWith('#') || line.StartsWith(';')) continue;
            var head = SectionRe.Match(line);
            if (head.Success)
            {
                section = head.Groups[1].Value.ToLowerInvariant() + (head.Groups[2].Success ? "." + UnescapeRe.Replace(head.Groups[2].Value, "$1") : "");
                continue;
            }
            var kv = KvRe.Match(line);
            if (!kv.Success || section == "") continue;
            entries.Add(new ConfigEntry { Key = $"{section}.{kv.Groups[1].Value.ToLowerInvariant()}", Value = !kv.Groups[2].Success ? "true" : Unquote(kv.Groups[2].Value) });
        }
        return entries;
    }

    private static string Unquote(string v)
    {
        var sb = new StringBuilder();
        bool q = false;
        for (int i = 0; i < v.Length; i++)
        {
            char ch = v[i];
            if (ch == '"') q = !q;
            else if (ch == '\\' && i + 1 < v.Length)
            {
                char n = v[++i];
                sb.Append(n == 'n' ? '\n' : n == 't' ? '\t' : n);
            }
            else if (!q && (ch == '#' || ch == ';')) break;
            else sb.Append(ch);
        }
        var o = sb.ToString();
        return q ? o : o.Trim();
    }

    private static readonly Regex NeedsQuoteRe = new("^\\s|\\s\\z|[#;\"\\\\\\n\\t]", RO);

    private static string QuoteValue(string v)
    {
        var esc = v.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\t", "\\t");
        return NeedsQuoteRe.IsMatch(v) ? $"\"{esc}\"" : esc;
    }

    private sealed class KeyParts
    {
        public string Section = "";
        public string? Sub;
        public string Name = "";
    }

    private static readonly Regex KeyNameRe = new("^[A-Za-z][A-Za-z0-9-]*\\z", RO);

    private static KeyParts? SplitKey(string key)
    {
        int first = key.IndexOf('.');
        int last = key.LastIndexOf('.');
        if (first < 0) return null;
        var name = key.Slice(last + 1);
        if (!KeyNameRe.IsMatch(name)) return null;
        return new KeyParts { Section = key.Slice(0, first).ToLowerInvariant(), Sub = first == last ? null : key.Slice(first + 1, last), Name = name };
    }

    private static string NormKey(KeyParts k) => $"{k.Section}{(k.Sub is not null ? "." + k.Sub : "")}.{k.Name.ToLowerInvariant()}";

    private static readonly Regex SubQuoteRe = new("([\"\\\\])", RO);

    /// <summary>Sets (or removes, with value null) a key in the configuration text.</summary>
    private static string SetConfigText(string text, KeyParts key, string? value)
    {
        var lines = text.Split('\n').ToList();
        if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        bool inSection = false;
        int sectionEnd = -1;
        int keyLine = -1;
        var toRemove = new List<int>();
        for (int i = 0; i < lines.Count; i++)
        {
            var line = lines[i].Trim();
            var head = SectionRe.Match(line);
            if (head.Success)
            {
                string? sub = head.Groups[2].Success ? UnescapeRe.Replace(head.Groups[2].Value, "$1") : null;
                inSection = head.Groups[1].Value.ToLowerInvariant() == key.Section && sub == key.Sub;
                if (inSection) sectionEnd = i + 1;
                continue;
            }
            if (!inSection) continue;
            sectionEnd = i + 1;
            var kv = KvNameRe.Match(line);
            if (kv.Success && kv.Groups[1].Value.ToLowerInvariant() == key.Name.ToLowerInvariant())
            {
                keyLine = i;
                toRemove.Add(i);
            }
        }
        if (value is null)
        {
            return string.Concat(lines.Where((_, i) => !toRemove.Contains(i)).Select(l => l + "\n"));
        }
        var formatted = $"\t{key.Name} = {QuoteValue(value)}";
        if (keyLine >= 0) lines[keyLine] = formatted;
        else if (sectionEnd >= 0) lines.Insert(sectionEnd, formatted);
        else
        {
            lines.Add(key.Sub is not null ? $"[{key.Section} \"{SubQuoteRe.Replace(key.Sub, "\\$1")}\"]" : $"[{key.Section}]");
            lines.Add(formatted);
        }
        return string.Concat(lines.Select(l => l + "\n"));
    }

    private static string GlobalConfigPath(G g) => $"{g.Sh.Home}/.gitconfig";

    /// <summary>All configuration files that apply, in order (later wins).</summary>
    private static List<(string Scope, string Path)> ConfigFiles(G g, Repo? r)
    {
        var files = new List<(string Scope, string Path)> { ("system", "/etc/gitconfig"), ("global", GlobalConfigPath(g)) };
        if (r is not null) files.Add(("local", Gpath(r, "config")));
        return files;
    }

    private static List<ConfigEntry> ConfigAll(G g, Repo? r) =>
        ConfigFiles(g, r).SelectMany(f => ParseConfig(ReadText(g, f.Path) ?? "").Select(e =>
        {
            e.Scope = f.Scope;
            e.Path = f.Path;
            return e;
        })).ToList();

    private static string? GetConfig(G g, Repo? r, string key)
    {
        var k = SplitKey(key);
        if (k is null) return null;
        var nk = NormKey(k);
        return ConfigAll(g, r).Where(e => e.Key == nk).LastOrDefault()?.Value;
    }

    private static readonly Regex TrueRe = new("^(true|yes|on|1)\\z", RO | RegexOptions.IgnoreCase);

    private static bool ConfigBool(string? v, bool def) => v is null ? def : TrueRe.IsMatch(v);

    private static void SetConfig(G g, string path, string key, string? value)
    {
        var k = SplitKey(key) ?? throw Fail($"error: key does not contain a section: {key}", 2);
        var text = ReadText(g, path) ?? "";
        WriteText(g, path, SetConfigText(text, k, value));
    }

    // ---------- Identity and time ----------

    private static long Now() => (long)Math.Floor(Js.Now() / 1000.0);

    private static string TzNow()
    {
        var off = (int)Math.Round(TimeZoneInfo.Local.GetUtcOffset(DateTimeOffset.FromUnixTimeMilliseconds(Js.Now())).TotalMinutes);
        int a = Math.Abs(off);
        return $"{(off < 0 ? "-" : "+")}{(a / 60).ToString(CultureInfo.InvariantCulture).PadLeft(2, '0')}{(a % 60).ToString(CultureInfo.InvariantCulture).PadLeft(2, '0')}";
    }

    private static string FmtDate(Ident i)
    {
        int sign = i.Tz.CharAt(0) == "-" ? -1 : 1;
        var off = sign * (Js.Number(i.Tz.Slice(1, 3)) * 60 + Js.Number(i.Tz.Slice(3, 5)));
        var d = DateTimeOffset.FromUnixTimeMilliseconds((long)((i.Time + off * 60) * 1000)).UtcDateTime;
        var t = $"{d.Hour:00}:{d.Minute:00}:{d.Second:00}";
        return $"{UtilCmd.Days[(int)d.DayOfWeek]} {UtilCmd.Months[d.Month - 1]} {d.Day} {t} {d.Year} {i.Tz}";
    }

    /// <summary>The name from /etc/passwd (GECOS), which real git uses if user.name is missing.</summary>
    private static string GecosName(G g)
    {
        var passwd = g.Sh.Vfs.TryLookup("/etc/passwd", g.Sh.RootUser())?.Content ?? "";
        var line = passwd.Split('\n').FirstOrDefault(l => l.StartsWith(g.User.Name + ":", StringComparison.Ordinal));
        var fields = line?.Split(':');
        var gecos = fields is not null && fields.Length > 4 ? fields[4].Split(',')[0] : null;
        return !string.IsNullOrEmpty(gecos) ? gecos : g.User.Name;
    }

    private static Ident? Identity(G g, Repo? r, bool strict = true)
    {
        var email = GetConfig(g, r, "user.email") ?? g.Sh.Env.Get("EMAIL");
        var cfgName = GetConfig(g, r, "user.name");
        var name = !string.IsNullOrEmpty(cfgName) ? cfgName : GecosName(g);
        if (string.IsNullOrEmpty(email))
        {
            if (!strict) return null;
            throw Fail(
                $"Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email \"you@example.com\"\n  git config --global user.name \"Your Name\"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got '{g.User.Name}@{g.Sh.Distro.Hostname}.(none)')",
                128);
        }
        return new Ident { Name = name, Email = email, Time = Now(), Tz = TzNow() };
    }

    // ---------- Work tree and .gitignore ----------

    private sealed class IgnoreRule
    {
        public string Base = "";
        public required Regex Re;
        public bool Neg;
        public bool DirOnly;
        public bool Anchored;
    }

    private static readonly Regex GlobEscapeRe = new("[.+^${}()|\\]\\\\/]", RO);

    /// <summary>Translates a glob to a regular expression source (the same text the TypeScript builds).</summary>
    private static string GlobToRegex(string glob, bool slashStar)
    {
        var re = new StringBuilder();
        for (int i = 0; i < glob.Length; i++)
        {
            char ch = glob[i];
            if (ch == '*')
            {
                if (glob.CharAt(i + 1) == "*")
                {
                    i++;
                    if (glob.CharAt(i + 1) == "/")
                    {
                        i++;
                        re.Append("(?:.*/)?");
                    }
                    else re.Append(".*");
                }
                else re.Append(slashStar ? ".*" : "[^/]*");
            }
            else if (ch == '?') re.Append("[^/]");
            else if (ch == '[')
            {
                int end = i + 2 <= glob.Length ? glob.IndexOf(']', i + 2) : -1;
                if (end < 0) re.Append("\\[");
                else
                {
                    var cls = glob.Slice(i + 1, end);
                    if (cls.StartsWith('!')) cls = "^" + cls.Slice(1);
                    // JS keeps "[" literal inside a class; .NET may read "-[" as subtraction, so escape it.
                    re.Append('[').Append(cls.Replace("\\", "\\\\").Replace("[", "\\[")).Append(']');
                    i = end;
                }
            }
            else if (ch == '\\' && i + 1 < glob.Length)
            {
                // JS reads an escaped letter or digit as the character itself; .NET would see \d, \w, \a ...
                char n = glob[++i];
                re.Append(char.IsAsciiLetterOrDigit(n) ? n.ToString() : "\\" + n);
            }
            else re.Append(GlobEscapeRe.Replace(ch.ToString(), "\\$0"));
        }
        return re.ToString();
    }

    private static readonly Regex TrailingWsRe = new("(?<!\\\\)\\s+\\z", RO);

    private static List<IgnoreRule> ParseIgnore(string text, string @base)
    {
        var rules = new List<IgnoreRule>();
        foreach (var raw in text.Split('\n'))
        {
            var line = TrailingWsRe.Replace(raw, "", 1);
            if (line == "" || line.StartsWith('#')) continue;
            bool neg = false;
            if (line.StartsWith('!'))
            {
                neg = true;
                line = line.Slice(1);
            }
            else if (line.StartsWith("\\!", StringComparison.Ordinal) || line.StartsWith("\\#", StringComparison.Ordinal)) line = line.Slice(1);
            bool dirOnly = false;
            if (line.EndsWith('/'))
            {
                dirOnly = true;
                line = line.TrimEnd('/');
            }
            if (line == "") continue;
            bool anchored = line.Contains('/');
            if (line.StartsWith('/')) line = line.Slice(1);
            Regex re;
            try
            {
                re = new Regex($"^{GlobToRegex(line, false)}\\z", RO);
            }
            catch (ArgumentException)
            {
                re = new Regex("(?!)", RO);
            }
            rules.Add(new IgnoreRule { Base = @base, Re = re, Neg = neg, DirOnly = dirOnly, Anchored = anchored });
        }
        return rules;
    }

    private sealed class Ignores
    {
        private readonly List<IgnoreRule> rules;

        public Ignores(List<IgnoreRule> rules) => this.rules = rules;

        private bool Match(string path, bool isDir)
        {
            bool result = false;
            foreach (var rule in rules)
            {
                if (rule.DirOnly && !isDir) continue;
                if (rule.Base != "" && !path.StartsWith(rule.Base + "/", StringComparison.Ordinal)) continue;
                var rel = rule.Base != "" ? path.Slice(rule.Base.Length + 1) : path;
                var subject = rule.Anchored ? rel : rel.Slice(rel.LastIndexOf('/') + 1);
                if (rule.Re.IsMatch(subject)) result = !rule.Neg;
            }
            return result;
        }

        public bool Ignored(string path, bool isDir = false)
        {
            var parts = path.Split('/');
            for (int i = 1; i < parts.Length; i++)
                if (Match(string.Join("/", parts.Take(i)), true)) return true;
            return Match(path, isDir);
        }
    }

    private sealed class WorkFile
    {
        public string Content = "";
        public bool Ignored;
        public string Hash = "";
    }

    private sealed class Work
    {
        public OrderedDictionary<string, WorkFile> Files = new(StringComparer.Ordinal);
        public required Ignores Ignores;

        public WorkFile? Get(string p) => Files.TryGetValue(p, out var w) ? w : null;
    }

    /// <summary>Reads every file in the work tree (except .git) and the rules in .gitignore.</summary>
    private static Work ScanWork(Repo r)
    {
        var root = NeedWork(r);
        var g = r.G;
        var found = new List<(string Path, string Content)>();
        var ignoreFiles = new List<(string Rel, string Text)>();
        void Walk(FsNode node, string rel)
        {
            if (!VfsLib.HasPerm(node, g.User, 'r') || !VfsLib.HasPerm(node, g.User, 'x')) return;
            if (node.Children is null) return;
            foreach (var name in SortedOrdinal(node.Children.Keys))
            {
                if (name == ".git") continue;
                var child = node.Children[name];
                var p = rel != "" ? $"{rel}/{name}" : name;
                if (child.Type == "dir") Walk(child, p);
                else if (VfsLib.HasPerm(child, g.User, 'r'))
                {
                    found.Add((p, child.Content ?? ""));
                    if (name == ".gitignore") ignoreFiles.Add((rel, child.Content ?? ""));
                }
            }
        }
        Walk(g.Sh.Vfs.Lookup(root, g.User), "");
        ignoreFiles.StableSort((a, b) => (a.Rel != "" ? a.Rel.Split('/').Length : 0) - (b.Rel != "" ? b.Rel.Split('/').Length : 0));
        var rules = ParseIgnore(ReadText(g, Gpath(r, "info/exclude")) ?? "", "");
        foreach (var (b, text) in ignoreFiles) rules.AddRange(ParseIgnore(text, b));
        var ignores = new Ignores(rules);
        var work = new Work { Ignores = ignores };
        foreach (var (p, content) in found)
        {
            var hash = BlobHash(content);
            r.Blobs[hash] = content;
            work.Files[p] = new WorkFile { Content = content, Hash = hash, Ignored = ignores.Ignored(p) };
        }
        return work;
    }

    private static void WriteWorkFile(Repo r, string path, string content)
    {
        var abs = Join(NeedWork(r), path);
        var node = r.G.Sh.Vfs.TryLookup(abs, r.G.User);
        if (node?.Type == "dir") throw new FsError("EISDIR");
        WriteText(r.G, abs, content);
    }

    private static void RemoveWorkFile(Repo r, string path)
    {
        var root = NeedWork(r);
        var abs = Join(root, path);
        RemoveFile(r.G, abs);
        PruneDirs(r.G, VfsLib.Dirname(abs), root);
    }

    // ---------- Paths (pathspec) ----------

    private sealed class Spec
    {
        public string Raw = "";
        public string Rel = "";
        public Regex? Glob;
    }

    private static readonly Regex GlobCharsRe = new("[*?\\[]", RO);

    private static Spec ToSpec(Repo r, string raw)
    {
        var root = NeedWork(r);
        var abs = VfsLib.ResolvePath(r.G.Cwd, raw == "" ? "." : raw);
        string rel;
        if (abs == root) rel = "";
        else if (abs.StartsWith(root + "/", StringComparison.Ordinal)) rel = abs.Slice(root.Length + 1);
        else throw Fatal($"{raw}: '{raw}' is outside repository at '{root}'");
        Regex? glob = null;
        if (GlobCharsRe.IsMatch(rel))
        {
            try
            {
                glob = new Regex($"^{GlobToRegex(rel, true)}(/.*)?\\z", RO);
            }
            catch (ArgumentException)
            {
                glob = new Regex("(?!)", RO);
            }
        }
        return new Spec { Raw = raw, Rel = rel, Glob = glob };
    }

    private static bool SpecMatch(Spec s, string path) =>
        s.Rel == "" || path == s.Rel || path.StartsWith(s.Rel + "/", StringComparison.Ordinal) || (s.Glob?.IsMatch(path) ?? false);

    /// <summary>How the path in the repository is shown, relative to the current directory.</summary>
    private static string Show(Repo r, string path)
    {
        var root = NeedWork(r);
        bool dir = path.EndsWith('/');
        var p = RelPath(r.G.Cwd, Join(root, dir ? path[..^1] : path));
        return dir ? p + "/" : p;
    }
}
