namespace Codestead.Shell.Commands;

// git ls-files.

public static partial class GitCmd
{
    private static int CmdLsFiles(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "s|stage", "o|others", "c|cached", "u|unmerged", "exclude-standard", "i|ignored", "d|deleted", "m|modified" }, "ls-files");
        var r = NeedRepo(g);
        NeedWork(r);
        var idx = ReadIndex(r);
        var specs = o.Operands.Select(p => ToSpec(r, p)).ToList();
        bool Pick(string p) => specs.Count == 0 || specs.Any(s => SpecMatch(s, p));
        var prefix = RelPath(r.Root!, g.Cwd) == "." ? "" : RelPath(r.Root!, g.Cwd) + "/";
        bool InCwd(string p) => p.StartsWith(prefix, StringComparison.Ordinal);
        List<string> list;
        if (o.Has("others") || o.Has("ignored"))
        {
            var work = ScanWork(r);
            list = work.Files.Where(kv => !idx.Entries.Has(kv.Key) && (o.Has("ignored") ? kv.Value.Ignored : !o.Has("exclude-standard") || !kv.Value.Ignored)).Select(kv => kv.Key).ToList();
        }
        else if (o.Has("deleted") || o.Has("modified"))
        {
            var work = ScanWork(r);
            list = idx.Entries.Keys.Where(p => (o.Has("deleted") && !work.Files.ContainsKey(p)) || (o.Has("modified") && work.Get(p)?.Hash != idx.Entries[p])).ToList();
        }
        else list = Union(idx.Entries.Keys, idx.Unmerged.Keys);
        foreach (var p in SortedOrdinal(list.Where(Pick).Where(InCwd)))
        {
            var name = p.Slice(prefix.Length);
            if (o.Has("stage"))
            {
                var u = idx.Unmerged[p];
                if (u is not null)
                {
                    foreach (var (v, n) in new[] { (u.Base, 1), (u.Ours, 2), (u.Theirs, 3) })
                        if (!string.IsNullOrEmpty(v)) g.Out($"100644 {v} {n}\t{name}\n");
                }
                else g.Out($"100644 {idx.Entries[p]} 0\t{name}\n");
            }
            else g.Out(name + "\n");
        }
        return 0;
    }
}
