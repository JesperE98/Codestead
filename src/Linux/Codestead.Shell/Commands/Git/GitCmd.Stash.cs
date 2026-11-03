using System.Text.Json;

namespace Codestead.Shell.Commands;

// git stash.

public static partial class GitCmd
{
    private static List<KeyValuePair<string, object?>> JsonTree(JsMap<string> t) =>
        t.Keys.Select(k => new KeyValuePair<string, object?>(k, t[k])).ToList();

    // stash (simplified: saves changes in tracked files)

    private sealed class StashEntry
    {
        public string Base = "";
        public string Branch = "";
        public JsMap<string> Index = new();
        public JsMap<string> Work = new();
        public string Message = "";
    }

    private static List<StashEntry> ReadStash(Repo r)
    {
        var text = ReadText(r.G, Gpath(r, "stash.json"));
        try
        {
            if (string.IsNullOrEmpty(text)) return new List<StashEntry>();
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return new List<StashEntry>();
            var list = new List<StashEntry>();
            foreach (var e in doc.RootElement.EnumerateArray())
            {
                string Str(string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";
                JsonElement Prop(string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) ? v : default;
                list.Add(new StashEntry { Base = Str("base"), Branch = Str("branch"), Index = TreeFromJson(Prop("index")), Work = TreeFromJson(Prop("work")), Message = Str("message") });
            }
            return list;
        }
        catch (JsonException)
        {
            return new List<StashEntry>();
        }
    }

    private static void WriteStash(Repo r, List<StashEntry> list)
    {
        if (list.Count == 0)
        {
            RemoveFile(r.G, Gpath(r, "stash.json"));
            return;
        }
        var json = list.Select(e => (object)new List<KeyValuePair<string, object?>>
        {
            new("base", e.Base),
            new("branch", e.Branch),
            new("index", JsonTree(e.Index)),
            new("work", JsonTree(e.Work)),
            new("message", e.Message),
        }).ToList();
        WriteText(r.G, Gpath(r, "stash.json"), JsonStringify(json) + "\n");
    }

    private static readonly Regex StashRefRe = new("^(?:stash@\\{)?([0-9]+)\\}?\\z", RO);

    private static int CmdStash(G g, List<string> args)
    {
        bool hasSub = args.Count > 0 && args[0] != "" && !args[0].StartsWith('-');
        var sub = hasSub ? args[0] : "push";
        var o = ParseArgs(hasSub ? args.Skip(1).ToList() : args, new[] { "m|message=", "u|include-untracked", "q|quiet" }, "stash");
        var r = NeedRepo(g);
        NeedWork(r);
        var head = ReadHead(r);
        var list = ReadStash(r);
        var where = head.Branch ?? "(no branch)";
        int PickIndex()
        {
            var @ref = o.Operands.Count > 0 ? o.Operands[0] : "stash@{0}";
            var m = StashRefRe.Match(@ref);
            double n = m.Success ? Js.Number(m.Groups[1].Value) : -1;
            if (!(n >= 0 && n < list.Count)) throw Fail($"error: {@ref} is not a valid reference");
            return (int)n;
        }
        switch (sub)
        {
            case "push":
            case "save":
            {
                if (string.IsNullOrEmpty(head.Hash)) throw Fatal("You do not have the initial commit yet");
                var s = ComputeStatus(r);
                if (s.Staged.Count == 0 && s.Unstaged.Count == 0)
                {
                    g.Out("No local changes to save\n");
                    return 0;
                }
                var work = new JsMap<string>();
                foreach (var p in s.Index.Entries.Keys)
                {
                    var w = s.Work.Get(p);
                    if (w is not null) work[p] = WriteObj(r, "blob", w.Content);
                }
                var c = ReadCommit(r, head.Hash);
                var message = !string.IsNullOrEmpty(o.Get("message")) ? $"On {where}: {o.Get("message")}" : $"WIP on {where}: {Short(c.Hash)} {Subject(c)}";
                list.Insert(0, new StashEntry { Base = head.Hash, Branch = where, Index = s.Index.Entries.Copy(), Work = work, Message = message });
                WriteStash(r, list);
                SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, head.Hash), "checkout", true);
                g.Out($"Saved working directory and index state {message}\n");
                return 0;
            }
            case "list":
                for (int i = 0; i < list.Count; i++) g.Out($"stash@{{{i}}}: {list[i].Message}\n");
                return 0;
            case "show":
            {
                var e = list[PickIndex()];
                PrintPatch(r, TreeChanges(CommitTree(r, e.Base), e.Work), "stat");
                return 0;
            }
            case "drop":
            {
                int n = PickIndex();
                g.Out($"Dropped stash@{{{n}}} ({list[n].Message})\n");
                list.RemoveAt(n);
                WriteStash(r, list);
                return 0;
            }
            case "clear":
                WriteStash(r, new List<StashEntry>());
                return 0;
            case "pop":
            case "apply":
            {
                if (list.Count == 0) throw Fail("No stash entries found.");
                int n = PickIndex();
                var e = list[n];
                var work = ScanWork(r);
                var idx = ReadIndex(r);
                var headTree = CommitTree(r, head.Hash);
                var baseTree = CommitTree(r, e.Base);
                var conflicts = new List<string>();
                foreach (var p in Union(e.Work.Keys, baseTree.Keys))
                {
                    if (e.Work[p] == baseTree[p]) continue;
                    var cur = work.Get(p)?.Hash;
                    if (cur != headTree[p] && cur != e.Work[p]) conflicts.Add(p);
                }
                if (conflicts.Count > 0)
                {
                    throw Fail($"error: Your local changes to the following files would be overwritten by merge:\n{string.Concat(conflicts.Select(p => $"\t{Show(r, p)}\n"))}Please commit your changes or stash them before you merge.\nAborting");
                }
                foreach (var p in Union(e.Work.Keys, baseTree.Keys))
                {
                    if (e.Work[p] == baseTree[p]) continue;
                    if (e.Work[p] is null)
                    {
                        RemoveWorkFile(r, p);
                        continue;
                    }
                    (string Text, bool Conflict)? cur = headTree[p] != baseTree[p] && !string.IsNullOrEmpty(headTree[p]) && !string.IsNullOrEmpty(baseTree[p])
                        ? Merge3(ReadBlob(r, baseTree[p]!), ReadBlob(r, headTree[p]!), ReadBlob(r, e.Work[p]!), "Updated upstream", "Stashed changes")
                        : null;
                    if (cur?.Conflict == true) g.Out($"CONFLICT (content): Merge conflict in {p}\n");
                    WriteWorkFile(r, p, cur is not null ? cur.Value.Text : ReadBlob(r, e.Work[p]!));
                    if (!idx.Entries.Has(p) && !string.IsNullOrEmpty(e.Index[p])) idx.Entries[p] = e.Index[p];
                }
                WriteIndex(r, idx);
                PrintLongStatus(r, ComputeStatus(r));
                if (sub == "pop")
                {
                    list.RemoveAt(n);
                    WriteStash(r, list);
                    g.Out($"Dropped stash@{{{n}}} ({e.Message})\n");
                }
                return 0;
            }
            default:
                throw Fail($"error: unknown subcommand: {sub}", 129);
        }
    }
}
