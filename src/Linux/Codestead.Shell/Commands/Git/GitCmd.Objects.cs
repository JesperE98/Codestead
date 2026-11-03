namespace Codestead.Shell.Commands;

// Objects: blobs, trees and commits stored under .git/objects.

public static partial class GitCmd
{
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
}
