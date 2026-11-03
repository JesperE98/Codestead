namespace Codestead.Shell.Commands;

// git mv.

public static partial class GitCmd
{
    private static int CmdMv(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "f|force", "v|verbose", "n|dry-run", "k" }, "mv");
        var r = NeedRepo(g);
        var root = NeedWork(r);
        var ops = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (ops.Count < 2) throw Fail("usage: git mv [-v] [-f] [-n] [-k] <source> <destination>\n   or: git mv [-v] [-f] [-n] [-k] <source>... <destination-directory>", 129);
        var destRaw = ops[^1];
        ops.RemoveAt(ops.Count - 1);
        var destSpec = ToSpec(r, destRaw);
        bool destIsDir = ops.Count > 1 || IsDirAt(g, Join(root, destSpec.Rel));
        if (ops.Count > 1 && !IsDirAt(g, Join(root, destSpec.Rel))) throw Fatal($"destination '{destRaw}' is not a directory");
        var idx = ReadIndex(r);
        var moves = new List<(string From, string To)>();
        foreach (var srcRaw in ops)
        {
            var src = ToSpec(r, srcRaw);
            var target = destIsDir ? (destSpec.Rel != "" ? $"{destSpec.Rel}/" : "") + src.Rel.Split('/')[^1] : destSpec.Rel;
            var desc = $"source={srcRaw}, destination={(destIsDir ? RelPath(g.Cwd, Join(root, target)) : destRaw)}";
            if (!ExistsAt(g, Join(root, src.Rel))) throw Fatal($"bad source, {desc}");
            var inside = idx.Entries.Keys.Where(p => p == src.Rel || p.StartsWith(src.Rel + "/", StringComparison.Ordinal)).ToList();
            if (inside.Count == 0) throw Fatal($"not under version control, {desc}");
            if (target == src.Rel || target.StartsWith(src.Rel + "/", StringComparison.Ordinal)) throw Fatal($"can not move directory into itself, {desc}");
            if (ExistsAt(g, Join(root, target)) && !o.Has("force")) throw Fatal($"destination exists, {desc}");
            foreach (var p in inside) moves.Add((p, target + p.Slice(src.Rel.Length)));
            if (o.Has("verbose") || o.Has("dry-run")) g.Out($"Renaming {src.Rel} to {target}\n");
            if (o.Has("dry-run")) continue;
            var node = g.Sh.Vfs.Lookup(Join(root, src.Rel), g.User);
            Mkdirp(g, VfsLib.Dirname(Join(root, target)));
            if (ExistsAt(g, Join(root, target))) g.Sh.Vfs.Remove(Join(root, target), g.User);
            g.Sh.Vfs.Insert(Join(root, target), node, g.User);
            g.Sh.Vfs.Remove(Join(root, src.Rel), g.User);
        }
        if (!o.Has("dry-run"))
        {
            foreach (var (from, to) in moves)
            {
                idx.Entries[to] = idx.Entries[from];
                idx.Entries.Delete(from);
            }
            WriteIndex(r, idx);
        }
        return 0;
    }
}
