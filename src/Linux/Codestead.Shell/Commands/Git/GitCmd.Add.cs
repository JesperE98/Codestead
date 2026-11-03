namespace Codestead.Shell.Commands;

// git add.

public static partial class GitCmd
{
    private static int CmdAdd(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "A|all", "u|update", "f|force", "v|verbose", "n|dry-run", "no-all" }, "add");
        var r = NeedRepo(g);
        NeedWork(r);
        var specsRaw = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (specsRaw.Count == 0)
        {
            if (!o.Has("all") && !o.Has("update"))
            {
                g.Out("Nothing specified, nothing added.\n");
                g.Hint("Maybe you wanted to say 'git add .'?\nDisable this message with \"git config set advice.addEmptyPathspec false\"");
                return 0;
            }
            specsRaw.Add(r.Root!);
        }
        var specs = specsRaw.Select(s => ToSpec(r, s)).ToList();
        var work = ScanWork(r);
        var idx = ReadIndex(r);
        var candidates = SortedOrdinal(Union(work.Files.Keys, idx.Entries.Keys, idx.Unmerged.Keys));
        var ignoredHits = new List<string>();
        var log = new List<string>();
        foreach (var spec in specs)
        {
            bool matched = false;
            bool ignoredOnly = false;
            foreach (var p in candidates)
            {
                if (!SpecMatch(spec, p)) continue;
                var w = work.Get(p);
                bool tracked = idx.Entries.Has(p) || idx.Unmerged.Has(p);
                if (w is not null)
                {
                    if (w.Ignored && !tracked && !o.Has("force"))
                    {
                        ignoredOnly = true;
                        continue;
                    }
                    if (o.Has("update") && !tracked) continue;
                    matched = true;
                    if (idx.Entries[p] != w.Hash || idx.Unmerged.Has(p))
                    {
                        if (!o.Has("dry-run"))
                        {
                            WriteObj(r, "blob", w.Content);
                            idx.Entries[p] = w.Hash;
                            idx.Unmerged.Delete(p);
                        }
                        log.Add($"add '{Show(r, p)}'");
                    }
                }
                else if (tracked)
                {
                    matched = true;
                    if (!o.Has("dry-run"))
                    {
                        idx.Entries.Delete(p);
                        idx.Unmerged.Delete(p);
                    }
                    log.Add($"remove '{Show(r, p)}'");
                }
            }
            if (!matched)
            {
                if (ignoredOnly) ignoredHits.Add(spec.Raw);
                else if (!(spec.Rel == "" || IsDirAt(g, Join(r.Root!, spec.Rel)))) throw Fatal($"pathspec '{spec.Raw}' did not match any files");
            }
        }
        if (!o.Has("dry-run")) WriteIndex(r, idx);
        if (o.Has("verbose") || o.Has("dry-run")) g.Out(string.Concat(log.Select(l => l + "\n")));
        if (ignoredHits.Count > 0)
        {
            g.Err($"The following paths are ignored by one of your .gitignore files:\n{string.Join("\n", ignoredHits)}\n");
            g.Hint("Use -f if you really want to add them.\nDisable this message with \"git config set advice.addIgnoredFile false\"");
            return 1;
        }
        return 0;
    }
}
