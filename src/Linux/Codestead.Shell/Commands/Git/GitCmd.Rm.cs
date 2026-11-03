namespace Codestead.Shell.Commands;

// git rm.

public static partial class GitCmd
{
    private static int CmdRm(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "cached", "r", "f|force", "q|quiet", "n|dry-run" }, "rm");
        var r = NeedRepo(g);
        NeedWork(r);
        var raw = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (raw.Count == 0)
            throw Fail("usage: git rm [-f | --force] [-n] [-r] [--cached] [--ignore-unmatch]\n              [--quiet] [--pathspec-from-file=<file> [--pathspec-file-nul]]\n              [--] [<pathspec>...]", 129);
        var idx = ReadIndex(r);
        var head = CommitTree(r, ReadHead(r).Hash);
        var work = ScanWork(r);
        var targets = new List<string>();
        foreach (var s in raw.Select(x => ToSpec(r, x)).ToList())
        {
            var hits = idx.Entries.Keys.Where(p => SpecMatch(s, p)).ToList();
            if (hits.Count == 0) throw Fatal($"pathspec '{s.Raw}' did not match any files");
            if (!o.Has("r") && hits.Any(p => p != s.Rel) && s.Glob is null) throw Fatal($"not removing '{s.Raw}' recursively without -r");
            targets.AddRange(hits);
        }
        if (!o.Has("force"))
        {
            var staged = targets.Where(p => idx.Entries[p] != head[p] && work.Get(p)?.Hash == idx.Entries[p]).ToList();
            var local = targets.Where(p => work.Files.ContainsKey(p) && work.Get(p)!.Hash != idx.Entries[p]).ToList();
            var both = local.Where(p => idx.Entries[p] != head[p]).ToList();
            if (both.Count > 0 && !o.Has("cached"))
                throw Fail($"error: the following file{(both.Count > 1 ? "s have" : " has")} staged content different from both the\nfile and the HEAD:\n{string.Concat(both.Select(p => $"    {Show(r, p)}\n"))}(use -f to force removal)");
            if (!o.Has("cached"))
            {
                if (staged.Count > 0)
                    throw Fail($"error: the following file{(staged.Count > 1 ? "s have" : " has")} changes staged in the index:\n{string.Concat(staged.Select(p => $"    {Show(r, p)}\n"))}(use --cached to keep the file, or -f to force removal)");
                if (local.Count > 0)
                    throw Fail($"error: the following file{(local.Count > 1 ? "s have" : " has")} local modifications:\n{string.Concat(local.Select(p => $"    {Show(r, p)}\n"))}(use --cached to keep the file, or -f to force removal)");
            }
        }
        foreach (var p in SortedOrdinal(Union(targets)))
        {
            if (!o.Has("quiet")) g.Out($"rm '{p}'\n");
            if (o.Has("dry-run")) continue;
            idx.Entries.Delete(p);
            idx.Unmerged.Delete(p);
            if (!o.Has("cached")) RemoveWorkFile(r, p);
        }
        if (!o.Has("dry-run")) WriteIndex(r, idx);
        return 0;
    }
}
