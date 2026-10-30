namespace Codestead.Shell.Commands;

// Port of src/shell/commands/git.ts (part 3: the local subcommands init … tag).

public static partial class GitCmd
{
    // ---------- Subcommands ----------

    // init

    private const string DefaultBranchHint =
        "Using 'main' as the name for the initial branch. Older versions of git\n" +
        "use 'master' instead. To choose the initial branch name to use in all\n" +
        "of your new repositories, which will suppress this warning, call:\n" +
        "\n" +
        "\tgit config --global init.defaultBranch <name>\n" +
        "\n" +
        "Names commonly chosen are 'main', 'master', 'trunk' and 'development'.\n" +
        "The just-created branch can be renamed via this command:\n" +
        "\n" +
        "\tgit branch -m <name>\n" +
        "\n" +
        "Disable this message with \"git config set advice.defaultBranchName false\"";

    private const string Exclude =
        "# git ls-files --others --exclude-from=.git/info/exclude\n" +
        "# Lines that start with '#' are comments.\n" +
        "# For a project mostly in C, the following would be a good set of\n" +
        "# exclude patterns (uncomment them if you want to use them):\n" +
        "# *.[oa]\n" +
        "# *~\n";

    /// <summary>Creates a new repository. Existed is true if it was already there.</summary>
    private static (string GitDir, bool Existed) InitRepo(G g, string dir, bool bare, string branch)
    {
        var gitDir = bare ? dir : Join(dir, ".git");
        Mkdirp(g, dir);
        if (LooksLikeGitDir(g, gitDir)) return (gitDir, true);
        Mkdirp(g, gitDir);
        foreach (var d in new[] { "objects/info", "objects/pack", "refs/heads", "refs/tags", "hooks", "info" }) Mkdirp(g, $"{gitDir}/{d}");
        WriteText(g, $"{gitDir}/HEAD", $"ref: refs/heads/{branch}\n");
        WriteText(
            g,
            $"{gitDir}/config",
            $"[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = {(bare ? "true" : "false")}\n{(bare ? "" : "\tlogallrefupdates = true\n")}");
        WriteText(g, $"{gitDir}/description", "Unnamed repository; edit this file 'description' to name the repository.\n");
        WriteText(g, $"{gitDir}/info/exclude", Exclude);
        return (gitDir, false);
    }

    private static int CmdInit(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "q|quiet", "bare", "b|initial-branch=" }, "init");
        if (o.Operands.Count > 1) throw Fail("usage: git init [-q | --quiet] [--bare] [-b <branch-name> | --initial-branch=<branch-name>] [<directory>]", 129);
        var dir = VfsLib.ResolvePath(g.Cwd, o.Operands.Count > 0 ? o.Operands[0] : ".");
        var configured = GetConfig(g, null, "init.defaultBranch");
        var branch = o.Get("initial-branch") ?? configured ?? "main";
        CheckBranchName(g, branch);
        var (gitDir, existed) = InitRepo(g, dir, o.Has("bare"), branch);
        if (!existed && !o.Has("initial-branch") && string.IsNullOrEmpty(configured) && ConfigBool(GetConfig(g, null, "advice.defaultBranchName"), true))
        {
            g.Hint(DefaultBranchHint);
        }
        if (!o.Has("quiet")) g.Out($"{(existed ? "Reinitialized existing" : "Initialized empty")} Git repository in {gitDir}/\n");
        return 0;
    }

    // config

    private static int CmdConfig(G g, List<string> args)
    {
        // The new syntax (git 2.46+): git config list|get|set|unset ...
        string? action = null;
        if (args.Count > 0 && args[0] is "list" or "get" or "set" or "unset")
        {
            action = args[0];
            args = args.Skip(1).ToList();
        }
        var o = ParseArgs(args, new[] { "global", "local", "system", "l|list", "get", "get-all", "unset", "unset-all", "show-origin", "e|edit", "add", "all" }, "config");
        string? scope = o.Has("global") ? "global" : o.Has("system") ? "system" : o.Has("local") ? "local" : null;
        if (o.Has("edit"))
        {
            g.Note("git.configEditUnsupported");
            return 1;
        }
        if (o.Has("list")) action = "list";
        else if (o.Has("get") || o.Has("get-all")) action = "get";
        else if (o.Has("unset") || o.Has("unset-all")) action = "unset";
        action ??= o.Operands.Count >= 2 ? "set" : o.Operands.Count == 1 ? "get" : null;
        if (action is null)
            throw Fail("usage: git config [<options>]\n\n    git config list [<file-option>] [<display-option>] [--includes]\n    git config get [<file-option>] [<display-option>] [--includes] [--all] <name>\n    git config set [<file-option>] [--type=<type>] [--all] [--value=<value>] [--fixed-value] <name> <value>\n    git config unset [<file-option>] [--all] [--value=<value>] [--fixed-value] <name>", 129);
        var r = Discover(g, g.Cwd);
        string PathFor(string s) => s == "global" ? GlobalConfigPath(g) : s == "system" ? "/etc/gitconfig" : r is not null ? Gpath(r, "config") : throw Fatal("not in a git directory");
        if (action == "list")
        {
            List<ConfigEntry> entries;
            if (scope is not null)
            {
                var path = PathFor(scope);
                entries = ParseConfig(ReadText(g, path) ?? "").Select(e =>
                {
                    e.Path = path;
                    return e;
                }).ToList();
            }
            else entries = ConfigAll(g, r);
            if (scope is not null && ReadText(g, PathFor(scope)) is null) throw Fatal($"unable to read config file '{PathFor(scope)}': No such file or directory");
            foreach (var e in entries) g.Out($"{(o.Has("show-origin") ? $"file:{e.Path}\t" : "")}{e.Key}={e.Value}\n");
            return 0;
        }
        var key = o.Operands.Count > 0 ? o.Operands[0] : null;
        var parts = SplitKey(key ?? "");
        if (parts is null)
        {
            if (!string.IsNullOrEmpty(key) && !key.Contains('.')) throw Fail($"error: key does not contain a section: {key}", 2);
            throw Fail($"error: invalid key: {key ?? ""}", 1);
        }
        if (action == "get")
        {
            var nk = NormKey(parts);
            var entries = (scope is not null ? ParseConfig(ReadText(g, PathFor(scope)) ?? "") : ConfigAll(g, r)).Where(e => e.Key == nk).ToList();
            if (entries.Count == 0) return 1;
            foreach (var e in o.Has("get-all") || o.Has("all") ? entries : JsSlice(entries, -1)) g.Out(e.Value + "\n");
            return 0;
        }
        var cfgPath = PathFor(scope ?? "local");
        if (action == "unset")
        {
            var text = ReadText(g, cfgPath) ?? "";
            if (!ParseConfig(text).Any(e => e.Key == NormKey(parts))) return 5;
            WriteText(g, cfgPath, SetConfigText(text, parts, null));
            return 0;
        }
        var value = o.Operands.Count > 1 ? o.Operands[1] : null;
        if (value is null) throw Fail("error: wrong number of arguments, should be 2", 129);
        SetConfig(g, cfgPath, key!, value);
        return 0;
    }

    // status

    private static int CmdStatus(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "s|short", "b|branch", "porcelain", "long", "u|untracked-files=", "z" }, "status");
        var r = NeedRepo(g);
        NeedWork(r);
        bool all = o.Get("untracked-files") == "all";
        var s = ComputeStatus(r, all);
        if (o.Get("untracked-files") == "no") s.Untracked = new List<string>();
        if (o.Has("porcelain")) PrintShortStatus(r, s, o.Has("branch"), false);
        else if (o.Has("short") && !o.Has("long")) PrintShortStatus(r, s, o.Has("branch"), true);
        else PrintLongStatus(r, s);
        return 0;
    }

    // add

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

    // commit

    private static readonly Regex TrailingWsAnyRe = new("\\s+\\z", RO);

    private static string CleanMessage(string msg)
    {
        var lines = msg.Split('\n').Where(l => !l.StartsWith('#')).Select(l => TrailingWsAnyRe.Replace(l, "", 1)).ToList();
        while (lines.Count > 0 && lines[0] == "") lines.RemoveAt(0);
        while (lines.Count > 0 && lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        var res = new List<string>();
        foreach (var l in lines)
            if (!(l == "" && res.Count > 0 && res[^1] == "")) res.Add(l);
        return res.Count > 0 ? string.Join("\n", res) + "\n" : "";
    }

    private static int CmdCommit(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "m|message=", "a|all", "amend", "allow-empty", "q|quiet", "no-edit", "v|verbose", "F|file=", "e|edit" }, "commit");
        var r = NeedRepo(g);
        NeedWork(r);
        var id = Identity(g, r)!;
        var head = ReadHead(r);
        var idx = ReadIndex(r);
        var mergeHead = ReadText(g, Gpath(r, "MERGE_HEAD"))?.Trim();
        if (idx.Unmerged.Count > 0)
        {
            throw Fail(
                "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
                128);
        }
        if (o.Has("amend") && string.IsNullOrEmpty(head.Hash)) throw Fatal("You have nothing to amend.");
        if (o.Has("amend") && !string.IsNullOrEmpty(mergeHead)) throw Fatal("You are in the middle of a merge -- cannot amend.");
        var paths = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (o.Has("all") || paths.Count > 0)
        {
            if (o.Has("all") && paths.Count > 0) throw Fatal("paths with -a does not make sense.");
            if (!string.IsNullOrEmpty(mergeHead) && paths.Count > 0) throw Fatal("cannot do a partial commit during a merge.");
            var work = ScanWork(r);
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            var used = new HashSet<Spec>();
            foreach (var p in idx.Entries.Keys)
            {
                var hit = specs.Where(s => SpecMatch(s, p)).ToList();
                if (specs.Count > 0 && hit.Count == 0) continue;
                foreach (var s in hit) used.Add(s);
                var w = work.Get(p);
                if (w is not null)
                {
                    WriteObj(r, "blob", w.Content);
                    idx.Entries[p] = w.Hash;
                }
                else idx.Entries.Delete(p);
            }
            foreach (var s in specs)
                if (!used.Contains(s)) throw Fail($"error: pathspec '{s.Raw}' did not match any file(s) known to git");
        }
        string? message;
        var ms = o.GetAll("message");
        if (ms is not null) message = string.Join("\n\n", ms);
        else if (o.Get("file") is not null)
        {
            var f = o.Get("file")!;
            message = f == "-" ? (g.Ctx.Stdin ?? "") : (ReadText(g, VfsLib.ResolvePath(g.Cwd, f)) ?? throw Fatal($"could not read log file '{f}': No such file or directory"));
        }
        else if (o.Has("amend")) message = ReadCommit(r, head.Hash!).Message;
        else if (!string.IsNullOrEmpty(mergeHead))
        {
            message = ReadText(g, Gpath(r, "MERGE_MSG")) ?? $"Merge commit '{mergeHead}'\n";
            g.Note("git.mergeMsgUsed");
        }
        else
        {
            g.Note("git.commitNoEditor");
            g.Err("Aborting commit due to empty commit message.\n");
            return 1;
        }
        message = CleanMessage(message);
        if (message == "")
        {
            g.Err("Aborting commit due to empty commit message.\n");
            return 1;
        }
        var parents = o.Has("amend") ? new List<string>(ReadCommit(r, head.Hash!).Parents) : !string.IsNullOrEmpty(head.Hash) ? new List<string> { head.Hash } : new List<string>();
        if (!string.IsNullOrEmpty(mergeHead)) parents.Add(mergeHead);
        var tree = WriteTree(r, idx.Entries);
        var parentTree = parents.Count > 0 && parents[0] != "" ? ReadCommit(r, parents[0]).Tree : WriteTree(r, new JsMap<string>());
        if (tree == (!string.IsNullOrEmpty(head.Hash) ? ReadCommit(r, head.Hash).Tree : "") && !o.Has("allow-empty") && string.IsNullOrEmpty(mergeHead) && !o.Has("amend"))
        {
            WriteIndex(r, idx);
            PrintLongStatus(r, ComputeStatus(r));
            return 1;
        }
        if (string.IsNullOrEmpty(head.Hash) && idx.Entries.Count == 0 && !o.Has("allow-empty"))
        {
            PrintLongStatus(r, ComputeStatus(r));
            return 1;
        }
        WriteIndex(r, idx);
        var author = o.Has("amend") ? ReadCommit(r, head.Hash!).Author : id;
        var h = WriteCommit(r, new Commit { Tree = tree, Parents = parents, Author = author, Committer = id, Message = message });
        var kind = o.Has("amend") ? " (amend)" : !string.IsNullOrEmpty(mergeHead) ? " (merge)" : parents.Count == 0 ? " (initial)" : "";
        MoveHead(r, h, $"commit{kind}: {Subject(message)}");
        RemoveFile(g, Gpath(r, "MERGE_HEAD"));
        RemoveFile(g, Gpath(r, "MERGE_MSG"));
        RemoveFile(g, Gpath(r, "MERGE_MODE"));
        if (o.Has("quiet")) return 0;
        var where = head.Branch ?? "detached HEAD";
        var res = $"[{where}{(parents.Count > 0 ? "" : " (root-commit)")} {Short(h)}] {message.Split('\n')[0]}\n";
        if (o.Has("amend")) res += $" Date: {FmtDate(author)}\n";
        res += StatText(r, TreeChanges(ReadTree(r, parentTree), idx.Entries), true);
        g.Out(res);
        return 0;
    }

    // log

    private sealed record Deco(string Text, string Color);

    private static Dictionary<string, List<Deco>> Decorations(Repo r)
    {
        var map = new Dictionary<string, List<Deco>>(StringComparer.Ordinal);
        void Add(string? h, string text, string color)
        {
            if (string.IsNullOrEmpty(h)) return;
            if (!map.TryGetValue(h, out var list)) map[h] = list = new List<Deco>();
            list.Add(new Deco(text, color));
        }
        var head = ReadHead(r);
        if (!string.IsNullOrEmpty(head.Branch)) Add(head.Hash, $"HEAD -> {head.Branch}", "head");
        else Add(head.Hash, "HEAD", Col.BoldCyan);
        foreach (var b in ListRefs(r, "refs/heads/"))
            if (b != head.Branch) Add(ReadRef(r, $"refs/heads/{b}"), b, Col.BoldGreen);
        foreach (var b in ListRefs(r, "refs/remotes/")) Add(ReadRef(r, $"refs/remotes/{b}"), b, Col.BoldRed);
        foreach (var t in ListRefs(r, "refs/tags/"))
        {
            var h = ReadRef(r, $"refs/tags/{t}");
            Add(!string.IsNullOrEmpty(h) ? Peel(r, h) : null, $"tag: {t}", Col.BoldYellow);
        }
        return map;
    }

    private static string Decorate(G g, Dictionary<string, List<Deco>>? map, string h)
    {
        List<Deco>? list = null;
        map?.TryGetValue(h, out list);
        if (list is null || list.Count == 0) return "";
        var parts = list.Select(d =>
        {
            if (d.Color == "head")
            {
                var segs = d.Text.Split(" -> ");
                var b = segs.Length > 1 ? segs[1] : "";
                return $"{g.C(Col.BoldCyan, "HEAD")}{g.C(Col.Yellow, " -> ")}{g.C(Col.BoldGreen, b)}";
            }
            return g.C(d.Color, d.Text);
        });
        return $" {g.C(Col.Yellow, "(")}{string.Join(g.C(Col.Yellow, ", "), parts)}{g.C(Col.Yellow, ")")}";
    }

    /// <summary>
    /// Commits reachable from `starts` (but not from `exclude`), newest first and children before parents.
    /// With `topo` (as `git log --graph`), the order no longer depends on the commit times: after a merge
    /// the merged branch is shown before the first parent's line, like git's --topo-order.
    /// </summary>
    private static List<Commit> WalkCommits(Repo r, List<string> starts, List<string>? exclude = null, bool firstParent = false, bool topo = false)
    {
        exclude ??= new List<string>();
        var hidden = new HashSet<string>(StringComparer.Ordinal);
        foreach (var e in exclude)
            foreach (var h in Ancestors(r, e)) hidden.Add(h);
        var all = new OrderedDictionary<string, Commit>(StringComparer.Ordinal);
        var order = new Dictionary<string, int>(StringComparer.Ordinal);
        var queue = new LinkedList<string>(starts);
        List<string> ParentsOf(Commit c) => firstParent ? c.Parents.Take(1).ToList() : c.Parents;
        while (queue.Count > 0)
        {
            var h = queue.First!.Value;
            queue.RemoveFirst();
            if (all.ContainsKey(h) || hidden.Contains(h)) continue;
            var c = ReadCommit(r, h);
            all[h] = c;
            order[h] = order.Count;
            foreach (var p in ParentsOf(c)) queue.AddLast(p);
        }
        var pending = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var c in all.Values)
            foreach (var p in ParentsOf(c))
                if (all.ContainsKey(p)) pending[p] = (pending.TryGetValue(p, out var n) ? n : 0) + 1;
        var ready = all.Keys.Where(h => !pending.TryGetValue(h, out var n) || n == 0).ToList();
        int ByDate(string a, string b)
        {
            var d = all[b].Committer.Time.CompareTo(all[a].Committer.Time);
            return d != 0 ? d : order[a] - order[b];
        }
        var res = new List<Commit>();
        if (topo)
        {
            // A stack: the newest tip on top, and a commit's last parent is taken first.
            ready.StableSort(ByDate);
            ready.Reverse();
        }
        while (ready.Count > 0)
        {
            string h;
            if (topo)
            {
                h = ready[^1];
                ready.RemoveAt(ready.Count - 1);
            }
            else
            {
                ready.StableSort(ByDate);
                h = ready[0];
                ready.RemoveAt(0);
            }
            var c = all[h];
            res.Add(c);
            foreach (var p in ParentsOf(c))
            {
                if (!all.ContainsKey(p)) continue;
                int n = pending[p] - 1;
                pending[p] = n;
                if (n == 0) ready.Add(p);
            }
        }
        return res;
    }

    /// <summary>A JS array that grows when assigned past its end (holes join as "") – used to draw graph rows.</summary>
    private sealed class DrawArr
    {
        private readonly List<string?> items;

        public DrawArr(int width) => items = Enumerable.Repeat<string?>(" ", Math.Max(0, width)).ToList();

        public string this[int i]
        {
            set
            {
                if (i < 0) return; // arr[-1] = x sets a property, not an element
                while (items.Count <= i) items.Add(null);
                items[i] = value;
            }
        }

        public string Join() => string.Concat(items.Select(x => x ?? ""));
    }

    private static string Draw(int width, Action<DrawArr> set)
    {
        var arr = new DrawArr(width);
        set(arr);
        return TrailingWsAnyRe.Replace(arr.Join(), "", 1);
    }

    /// <summary>Draws a simple graph (like `git log --graph`) to the left of every commit.</summary>
    private static List<string> GraphLines(List<Commit> commits, Func<Commit, List<string>> render)
    {
        var inSet = new HashSet<string>(commits.Select(c => c.Hash), StringComparer.Ordinal);
        var cols = new List<string>();
        var res = new List<string>();
        foreach (var c in commits)
        {
            int idx = cols.IndexOf(c.Hash);
            if (idx < 0)
            {
                cols.Add(c.Hash);
                idx = cols.Count - 1;
            }
            var parents = c.Parents.Where(inSet.Contains).ToList();
            var next = new List<string>(cols);
            next.RemoveAt(idx);
            if (parents.Count > 0) next.Insert(idx, parents[0]);
            var extra = parents.Skip(1).Where(p => !next.Contains(p)).ToList();
            next.InsertRange(Math.Min(idx + 1, next.Count), extra);
            int width = Math.Max(cols.Count, next.Count) * 2;
            var row = string.Join(" ", cols.Select((_, i) => i == idx ? "*" : "|"));
            var prefixes = new List<string>();
            if (parents.Count > 1)
            {
                if (extra.Count > 0)
                {
                    var colsCount = cols.Count;
                    prefixes.Add(Draw(next.Count * 2, arr =>
                    {
                        for (int k = 0; k <= idx; k++) arr[2 * k] = "|";
                        arr[2 * idx + 1] = "\\";
                        for (int k = idx + 1; k < colsCount; k++) arr[2 * k + 1] = "\\";
                    }));
                }
                else
                {
                    int q = next.IndexOf(parents[1]);
                    var nextCount = next.Count;
                    prefixes.Add(Draw(next.Count * 2, arr =>
                    {
                        for (int k = 0; k < nextCount; k++) arr[2 * k] = "|";
                        if (q < idx) arr[2 * idx - 1] = "/";
                        else arr[2 * idx + 1] = "\\";
                    }));
                }
            }
            else if (parents.Count == 0 && idx < cols.Count - 1)
            {
                var colsCount = cols.Count;
                prefixes.Add(Draw(cols.Count * 2, arr =>
                {
                    for (int k = 0; k < idx; k++) arr[2 * k] = "|";
                    for (int k = idx + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
                }));
            }
            cols = next;
            var bars = string.Join(" ", cols.Select(_ => "|"));
            var body = render(c);
            res.Add(row.PadRight(width) + body[0]);
            var rest = body.Skip(1).ToList();
            for (int i = 0; i < Math.Max(rest.Count, prefixes.Count); i++)
            {
                var pre = i < prefixes.Count ? prefixes[i] : bars;
                var line = i < rest.Count ? rest[i] : "";
                res.Add(line != "" ? pre.PadRight(width) + line : pre);
            }
            // Two columns waiting for the same commit are joined.
            for (int j = 0; j < cols.Count; j++)
            {
                int i = cols.IndexOf(cols[j]);
                if (i == j) continue;
                var jj = j;
                var colsCount = cols.Count;
                res.Add(Draw(cols.Count * 2, arr =>
                {
                    for (int k = 0; k < jj; k++) arr[2 * k] = "|";
                    arr[2 * jj - 1] = "/";
                    for (int k = jj + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
                }));
                cols.RemoveAt(j);
                j--;
            }
        }
        return res;
    }

    private static List<string> CommitHeader(Repo r, Commit c, Dictionary<string, List<Deco>>? deco)
    {
        var g = r.G;
        var lines = new List<string> { $"{g.C(Col.Yellow, $"commit {c.Hash}")}{Decorate(g, deco, c.Hash)}" };
        if (c.Parents.Count > 1) lines.Add($"Merge: {string.Join(" ", c.Parents.Select(Short))}");
        lines.Add($"Author: {c.Author.Name} <{c.Author.Email}>");
        lines.Add($"Date:   {FmtDate(c.Author)}");
        lines.Add("");
        var msg = c.Message.EndsWith('\n') ? c.Message[..^1] : c.Message;
        foreach (var l in msg.Split('\n')) lines.Add(l != "" ? $"    {l}" : "");
        return lines;
    }

    private static readonly Regex RangeSepRe = new("\\.{2,3}", RO);

    /// <summary>Splits the arguments into revisions and paths, like real git.</summary>
    private static (List<string> Revs, List<string> Paths) RevsAndPaths(Repo r, Parsed o)
    {
        var revs = new List<string>();
        var paths = new List<string>(o.Paths ?? new List<string>());
        foreach (var a in o.Operands)
        {
            var range = a.Contains("..") ? RangeSepRe.Split(a).ToList() : new List<string> { a };
            bool isRev = range.All(x => x == "" || ResolveRev(r, x) is not null);
            if (isRev && paths.Count == 0) revs.Add(a);
            else if (r.Root is not null && ExistsAt(r.G, VfsLib.ResolvePath(r.G.Cwd, a))) paths.Add(a);
            else if (r.Root is not null && o.Paths is null && ReadIndex(r).Entries.Keys.Any(p => SpecMatch(ToSpec(r, a), p))) paths.Add(a);
            else
                throw Fail(
                    $"fatal: ambiguous argument '{a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'",
                    128);
        }
        return (revs, paths);
    }

    private static int SliceEnd(double limit) =>
        double.IsNaN(limit) ? 0 : limit >= int.MaxValue ? int.MaxValue : limit <= int.MinValue ? int.MinValue : (int)Math.Truncate(limit);

    private static readonly Regex LimitArgRe = new("^-([0-9]+)\\z", RO);

    private static int CmdLog(G g, List<string> args)
    {
        double limit = double.PositiveInfinity;
        args = args.Where(a =>
        {
            var m = LimitArgRe.Match(a);
            if (m.Success) limit = Js.Number(m.Groups[1].Value);
            return !m.Success;
        }).ToList();
        var o = ParseArgs(
            args,
            new[] { "oneline", "n|max-count=", "graph", "all", "decorate", "p|patch", "stat", "reverse", "first-parent", "name-only", "name-status", "pretty=", "format=", "abbrev-commit" },
            "log");
        if (!string.IsNullOrEmpty(o.Get("max-count"))) limit = Js.Number(o.Get("max-count"));
        var r = NeedRepo(g);
        var (revs, paths) = RevsAndPaths(r, o);
        var head = ReadHead(r);
        var starts = new List<string>();
        var exclude = new List<string>();
        foreach (var rev in revs)
        {
            if (rev.Contains(".."))
            {
                var ab = RangeSepRe.Split(rev);
                var a = ab[0];
                var b = ab.Length > 1 ? ab[1] : "";
                exclude.Add(NeedCommit(r, a != "" ? a : "HEAD"));
                starts.Add(NeedCommit(r, b != "" ? b : "HEAD"));
            }
            else if (rev.StartsWith('^')) exclude.Add(NeedCommit(r, rev.Slice(1)));
            else starts.Add(NeedCommit(r, rev));
        }
        if (o.Has("all"))
        {
            if (!string.IsNullOrEmpty(head.Hash)) starts.Add(head.Hash);
            foreach (var prefix in new[] { "refs/heads/", "refs/remotes/", "refs/tags/" })
                foreach (var n in ListRefs(r, prefix))
                {
                    var h = ReadRef(r, prefix + n);
                    if (!string.IsNullOrEmpty(h) && ReadObj(r, Peel(r, h))?.Type == "commit") starts.Add(Peel(r, h));
                }
        }
        if (starts.Count == 0 && !o.Has("all"))
        {
            if (string.IsNullOrEmpty(head.Hash)) throw Fatal(!string.IsNullOrEmpty(head.Branch) ? $"your current branch '{head.Branch}' does not have any commits yet" : "bad default revision 'HEAD'");
            starts.Add(head.Hash);
        }
        var commits = WalkCommits(r, Union(starts), exclude, o.Has("first-parent"), o.Has("graph"));
        if (paths.Count > 0)
        {
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            bool Touches(Commit c) => TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree), p => specs.Any(s => SpecMatch(s, p))).Count > 0;
            commits = commits.Where(Touches).ToList();
        }
        commits = JsSlice(commits, 0, SliceEnd(limit));
        if (o.Has("reverse")) commits.Reverse();
        var pretty = o.Get("pretty") ?? o.Get("format");
        bool oneline = o.Has("oneline") || pretty == "oneline";
        var deco = o.Has("no-decorate") ? null : o.Has("decorate") || g.Tty ? Decorations(r) : null;
        List<string> Render(Commit c)
        {
            List<string> lines;
            if (oneline) lines = new List<string> { $"{g.C(Col.Yellow, o.Has("oneline") || o.Has("abbrev-commit") ? Short(c.Hash) : c.Hash)}{Decorate(g, deco, c.Hash)} {Subject(c)}" };
            else if (pretty == "short") lines = new List<string> { $"{g.C(Col.Yellow, $"commit {c.Hash}")}{Decorate(g, deco, c.Hash)}", $"Author: {c.Author.Name} <{c.Author.Email}>", "", $"    {Subject(c)}" };
            else lines = CommitHeader(r, c, deco);
            var mode = o.Has("patch") ? "patch" : o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : null;
            if (mode is not null && c.Parents.Count < 2)
            {
                var text = new StringBuilder();
                var saved = g.Out;
                g.Out = s => text.Append(s);
                try
                {
                    PrintPatch(r, TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree)), mode);
                }
                finally
                {
                    g.Out = saved;
                }
                var t = text.ToString();
                if (t != "")
                {
                    if (!oneline) lines.Add("");
                    lines.AddRange((t.EndsWith('\n') ? t[..^1] : t).Split('\n'));
                }
            }
            return lines;
        }
        var blocks = new List<string>();
        if (o.Has("graph"))
        {
            bool sep = !oneline;
            blocks.AddRange(GraphLines(commits, c =>
            {
                var lines = Render(c);
                if (sep && !ReferenceEquals(c, commits[^1])) lines.Add("");
                return lines;
            }));
        }
        else
        {
            for (int i = 0; i < commits.Count; i++)
            {
                blocks.AddRange(Render(commits[i]));
                if (!oneline && i < commits.Count - 1) blocks.Add("");
            }
        }
        if (blocks.Count > 0) g.Out(string.Join("\n", blocks) + "\n");
        return 0;
    }

    // diff

    private static int CmdDiff(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "staged", "cached", "stat", "name-only", "name-status", "exit-code", "quiet", "no-index" }, "diff");
        var r = NeedRepo(g);
        var (revs, paths) = RevsAndPaths(r, o);
        var specs = paths.Select(p => ToSpec(r, p)).ToList();
        bool Filter(string p) => specs.Count == 0 || specs.Any(s => SpecMatch(s, p));
        bool staged = o.Has("staged") || o.Has("cached");
        JsMap<string> A;
        JsMap<string> B;
        JsMap<string> WorktreeTree(JsMap<string> @base)
        {
            var work = ScanWork(r);
            var t = new JsMap<string>();
            foreach (var p in @base.Keys)
            {
                var w = work.Get(p);
                if (w is not null) t[p] = w.Hash;
            }
            return t;
        }
        var range = revs.FirstOrDefault(x => x.Contains(".."));
        if (range is not null || revs.Count == 2)
        {
            var ab = range is not null ? RangeSepRe.Split(range) : revs.ToArray();
            var a = ab[0];
            var b = ab.Length > 1 ? ab[1] : "";
            A = CommitTree(r, NeedCommit(r, a != "" ? a : "HEAD"));
            B = CommitTree(r, NeedCommit(r, b != "" ? b : "HEAD"));
        }
        else if (revs.Count == 1)
        {
            A = RevTree(r, revs[0]) ?? throw Fatal($"bad revision '{revs[0]}'");
            var idx = ReadIndex(r);
            B = staged ? idx.Entries : WorktreeTree(A.Merge(idx.Entries));
        }
        else if (staged)
        {
            A = CommitTree(r, ReadHead(r).Hash);
            B = ReadIndex(r).Entries;
        }
        else
        {
            NeedWork(r);
            var idx = ReadIndex(r);
            A = idx.Entries.Copy();
            foreach (var p in idx.Unmerged.Keys) A.Delete(p);
            B = WorktreeTree(A);
            var unmerged = idx.Unmerged.Keys.Where(Filter).ToList();
            if (unmerged.Count > 0 && !o.Has("quiet"))
            {
                // Show the conflicted files against "our" version (real git shows a combined diff).
                foreach (var p in unmerged)
                {
                    var ours = idx.Unmerged[p]!.Ours;
                    var w = ScanWork(r).Get(p);
                    g.Out($"{g.C(Col.Bold, $"diff --cc {p}")}\n");
                    if (!string.IsNullOrEmpty(ours) && w is not null)
                    {
                        var lines = HunkLines(g, ReadBlob(r, ours), w.Content);
                        if (lines.Count > 0) g.Out($"{g.C(Col.Bold, $"--- a/{p}")}\n{g.C(Col.Bold, $"+++ b/{p}")}\n{string.Join("\n", lines)}\n");
                    }
                }
            }
        }
        var changes = TreeChanges(A, B, Filter);
        if (!o.Has("quiet")) PrintPatch(r, changes, o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : "patch");
        return (o.Has("exit-code") || o.Has("quiet")) && changes.Count > 0 ? 1 : 0;
    }

    // restore / checkout of files

    private sealed class RestoreOpts
    {
        public bool Staged;
        public bool Worktree;
        public string? Source;
        public bool Ours;
        public bool Theirs;
        public bool CheckoutStyle;
    }

    private static int RestorePaths(Repo r, List<string> pathspecs, RestoreOpts opts)
    {
        var g = r.G;
        var specs = pathspecs.Select(p => ToSpec(r, p)).ToList();
        var idx = ReadIndex(r);
        var head = ReadHead(r);
        JsMap<string>? source = null;
        if (!string.IsNullOrEmpty(opts.Source)) source = RevTree(r, opts.Source) ?? throw Fatal($"could not resolve {opts.Source}");
        else if (opts.Staged) source = CommitTree(r, head.Hash);
        var work = ScanWork(r);
        var known = Union(idx.Entries.Keys, idx.Unmerged.Keys, source?.Keys ?? new List<string>());
        int count = 0;
        foreach (var spec in specs)
        {
            var hits = known.Where(p => SpecMatch(spec, p)).ToList();
            if (hits.Count == 0) throw Fail($"error: pathspec '{spec.Raw}' did not match any file(s) known to git");
            foreach (var p in SortedOrdinal(hits))
            {
                var u = idx.Unmerged[p];
                if (opts.Worktree)
                {
                    if (u is not null && string.IsNullOrEmpty(opts.Source))
                    {
                        var side = opts.Ours ? u.Ours : opts.Theirs ? u.Theirs : null;
                        if (!opts.Ours && !opts.Theirs) throw Fail($"error: path '{Show(r, p)}' is unmerged");
                        if (string.IsNullOrEmpty(side)) throw Fail($"error: path '{Show(r, p)}' does not have {(opts.Ours ? "our" : "their")} version");
                        WriteWorkFile(r, p, ReadBlob(r, side));
                        count++;
                        continue;
                    }
                    var want = source is not null ? source[p] : idx.Entries[p];
                    if (want is null)
                    {
                        if (source is not null && idx.Entries.Has(p) && work.Files.ContainsKey(p))
                        {
                            RemoveWorkFile(r, p);
                            count++;
                        }
                    }
                    else if (work.Get(p)?.Hash != want)
                    {
                        WriteWorkFile(r, p, ReadBlob(r, want));
                        count++;
                    }
                    else count++;
                }
                if (opts.Staged)
                {
                    var want = source![p];
                    if (want is null) idx.Entries.Delete(p);
                    else idx.Entries[p] = want;
                    idx.Unmerged.Delete(p);
                }
            }
        }
        WriteIndex(r, idx);
        if (opts.CheckoutStyle) g.Err($"Updated {count} path{(count == 1 ? "" : "s")} from {(!string.IsNullOrEmpty(opts.Source) ? "the tree" : "the index")}\n");
        return 0;
    }

    private static int CmdRestore(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "S|staged", "W|worktree", "s|source=", "ours", "theirs", "q|quiet" }, "restore");
        var r = NeedRepo(g);
        NeedWork(r);
        var paths = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (paths.Count == 0) throw Fatal("you must specify path(s) to restore");
        bool staged = o.Has("staged");
        bool worktree = o.Has("worktree") || !staged;
        return RestorePaths(r, paths, new RestoreOpts { Staged = staged, Worktree = worktree, Source = o.Get("source"), Ours = o.Has("ours"), Theirs = o.Has("theirs") });
    }

    // rm / mv

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

    // branch

    private static int CmdBranch(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "d|delete", "D", "m|move", "M", "l|list", "a|all", "r|remotes", "v|verbose", "show-current", "f|force", "u|set-upstream-to=", "unset-upstream", "c|copy" }, "branch");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        if (o.Has("show-current"))
        {
            if (!string.IsNullOrEmpty(head.Branch)) g.Out(head.Branch + "\n");
            return 0;
        }
        if (o.Has("delete") || o.Has("D"))
        {
            if (o.Operands.Count == 0) throw Fatal("branch name required");
            bool force = o.Has("D") || o.Has("force");
            int code = 0;
            foreach (var b in o.Operands)
            {
                var @ref = o.Has("remotes") ? $"refs/remotes/{b}" : $"refs/heads/{b}";
                var h = ReadRef(r, @ref);
                if (string.IsNullOrEmpty(h))
                {
                    g.Err($"error: {(o.Has("remotes") ? "remote-tracking " : "")}branch '{b}' not found\n");
                    code = 1;
                    continue;
                }
                if (b == head.Branch && !o.Has("remotes"))
                {
                    g.Err($"error: cannot delete branch '{b}' used by worktree at '{r.Root ?? r.GitDir}'\n");
                    code = 1;
                    continue;
                }
                if (!force && !o.Has("remotes"))
                {
                    var up = UpstreamOf(r, b);
                    var upHash = up is not null ? ReadRef(r, up.Ref) : null;
                    var @base = upHash ?? head.Hash;
                    if (string.IsNullOrEmpty(@base) || !IsAncestor(r, h, @base))
                    {
                        g.Err($"error: the branch '{b}' is not fully merged\n");
                        g.Hint($"If you are sure you want to delete it, run 'git branch -D {b}'\nDisable this message with \"git config set advice.forceDeleteBranch false\"");
                        code = 1;
                        continue;
                    }
                }
                DeleteRef(r, @ref);
                if (!o.Has("remotes"))
                {
                    var cfg = Gpath(r, "config");
                    var text = ReadText(g, cfg) ?? "";
                    text = SetConfigText(text, new KeyParts { Section = "branch", Sub = b, Name = "remote" }, null);
                    text = SetConfigText(text, new KeyParts { Section = "branch", Sub = b, Name = "merge" }, null);
                    var re = new Regex($"\\[branch \"{Regex.Escape(b)}\"\\]\\n(?=\\[|\\z)", RO);
                    WriteText(g, cfg, re.Replace(text, "", 1));
                }
                g.Out($"Deleted {(o.Has("remotes") ? "remote-tracking branch" : "branch")} {b} (was {Short(h)}).\n");
            }
            return code;
        }
        if (o.Has("move") || o.Has("M"))
        {
            string? a, b;
            if (o.Operands.Count == 1)
            {
                a = head.Branch ?? throw Fatal("cannot rename the current branch while not on any");
                b = o.Operands[0];
            }
            else
            {
                a = o.Operands.Count > 0 ? o.Operands[0] : null;
                b = o.Operands.Count > 1 ? o.Operands[1] : null;
            }
            if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) throw Fatal("branch name required");
            CheckBranchName(g, b);
            var h = ReadRef(r, $"refs/heads/{a}");
            bool isCurrent = a == head.Branch;
            if (string.IsNullOrEmpty(h) && !isCurrent) throw Fatal($"no branch named '{a}'");
            if (BranchExists(r, b) && !o.Has("M") && a != b) throw Fatal($"a branch named '{b}' already exists");
            if (!string.IsNullOrEmpty(h))
            {
                DeleteRef(r, $"refs/heads/{a}");
                WriteRef(r, $"refs/heads/{b}", h);
            }
            if (isCurrent) SetHeadBranch(r, b);
            return 0;
        }
        if (o.Has("set-upstream-to"))
        {
            var up = o.Get("set-upstream-to")!;
            var b = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? head.Branch ?? throw Fatal("could not set upstream of HEAD to " + up + " when it does not point to any branch.");
            var m = UpstreamRe.Match(up);
            if (!m.Success || string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{up}"))) throw Fatal($"the requested upstream branch '{up}' does not exist");
            SetConfig(g, Gpath(r, "config"), $"branch.{b}.remote", m.Groups[1].Value);
            SetConfig(g, Gpath(r, "config"), $"branch.{b}.merge", $"refs/heads/{m.Groups[2].Value}");
            g.Out($"branch '{b}' set up to track '{up}'.\n");
            return 0;
        }
        if (o.Has("unset-upstream"))
        {
            var b = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? head.Branch!;
            var cfg = Gpath(r, "config");
            var text = ReadText(g, cfg) ?? "";
            text = SetConfigText(text, new KeyParts { Section = "branch", Sub = b, Name = "remote" }, null);
            text = SetConfigText(text, new KeyParts { Section = "branch", Sub = b, Name = "merge" }, null);
            WriteText(g, cfg, text);
            return 0;
        }
        if (o.Operands.Count > 0 && !o.Has("list"))
        {
            var name = o.Operands[0];
            var start = o.Operands.Count > 1 ? o.Operands[1] : null;
            CheckBranchName(g, name);
            if (BranchExists(r, name) && !o.Has("force")) throw Fatal($"a branch named '{name}' already exists");
            if (name == head.Branch && o.Has("force")) throw Fatal($"cannot force update the branch '{name}' used by worktree at '{r.Root}'");
            if (string.IsNullOrEmpty(start) && string.IsNullOrEmpty(head.Hash)) throw Fatal($"not a valid object name: '{head.Branch ?? "HEAD"}'");
            var h = !string.IsNullOrEmpty(start) ? NeedCommit(r, start) : head.Hash!;
            WriteRef(r, $"refs/heads/{name}", h);
            if (!string.IsNullOrEmpty(start) && !string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{start}")) && UpstreamRe.IsMatch(start))
            {
                var segs = start.Split('/');
                SetConfig(g, Gpath(r, "config"), $"branch.{name}.remote", segs[0]);
                SetConfig(g, Gpath(r, "config"), $"branch.{name}.merge", $"refs/heads/{string.Join("/", segs.Skip(1))}");
                g.Out($"branch '{name}' set up to track '{start}'.\n");
            }
            return 0;
        }
        // List branches.
        var rows = new List<(string Name, bool Current, bool Remote, string Hash)>();
        if (!o.Has("remotes"))
        {
            if (string.IsNullOrEmpty(head.Branch) && !string.IsNullOrEmpty(head.Hash)) rows.Add(($"(HEAD detached at {Short(head.Hash)})", true, false, head.Hash));
            foreach (var b in ListRefs(r, "refs/heads/")) rows.Add((b, b == head.Branch, false, ReadRef(r, $"refs/heads/{b}")!));
        }
        if (o.Has("all") || o.Has("remotes"))
        {
            foreach (var b in ListRefs(r, "refs/remotes/"))
            {
                var raw = (ReadText(g, Gpath(r, $"refs/remotes/{b}")) ?? "").Trim();
                var name = (o.Has("all") ? "remotes/" : "") + b + (raw.StartsWith("ref: refs/remotes/", StringComparison.Ordinal) ? $" -> {raw.Slice("ref: refs/remotes/".Length)}" : "");
                rows.Add((name, false, true, ReadRef(r, $"refs/remotes/{b}") ?? ""));
            }
        }
        int nameW = Math.Max(0, rows.Count > 0 ? rows.Max(x => x.Name.Length) : 0);
        foreach (var row in rows)
        {
            var color = row.Current ? Col.Green : row.Remote ? Col.Red : "";
            var line = $"{(row.Current ? "* " : "  ")}{(color != "" ? g.C(color, row.Name) : row.Name)}";
            if (o.Has("verbose") && !string.IsNullOrEmpty(row.Hash))
            {
                line += " ".Repeat(nameW - row.Name.Length) + $" {g.C(Col.Yellow, Short(row.Hash))} ";
                if (!row.Remote && !row.Name.StartsWith('('))
                {
                    var up = UpstreamOf(r, row.Name);
                    if (up is not null && o.GetAll("verbose")!.Count > 1) line += $"[{g.C(Col.Blue, up.Name)}] ";
                }
                line += Subject(ReadCommit(r, row.Hash));
            }
            g.Out(line + "\n");
        }
        return 0;
    }

    private static readonly Regex UpstreamRe = new("^([^/]+)/(.+)\\z", RO);

    // switch / checkout

    private static void DetachedAdvice(G g, Repo r, string h, string rev)
    {
        if (ConfigBool(GetConfig(g, r, "advice.detachedHead"), true))
        {
            g.Err(
                $"Note: switching to '{rev}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nTurn off this advice by setting config variable advice.detachedHead to false\n\n");
        }
        g.Err($"HEAD is now at {Short(h)} {Subject(ReadCommit(r, h))}\n");
    }

    private sealed class SwitchTarget
    {
        public string? Branch;
        public string? Create;
        public string? Detach;
        public bool Force;
        public string? StartRev;
        public string? Track;
    }

    /// <summary>Switches branch (or to a detached commit) and updates the work tree.</summary>
    private static int DoSwitch(Repo r, SwitchTarget target)
    {
        var g = r.G;
        var head = ReadHead(r);
        var fromName = head.Branch ?? head.Hash ?? "HEAD";
        string? newHash;
        if (!string.IsNullOrEmpty(target.Create))
        {
            newHash = !string.IsNullOrEmpty(target.StartRev) ? NeedCommit(r, target.StartRev) : head.Hash;
        }
        else if (!string.IsNullOrEmpty(target.Branch))
        {
            newHash = ReadRef(r, $"refs/heads/{target.Branch}");
        }
        else newHash = target.Detach;
        if (!string.IsNullOrEmpty(target.Branch) && target.Branch == head.Branch && string.IsNullOrEmpty(target.Create))
        {
            g.Err($"Already on '{target.Branch}'\n");
            if (!string.IsNullOrEmpty(head.Hash)) g.Err(TrackingText(r, head.Branch!, head.Hash));
            return 0;
        }
        if (!string.IsNullOrEmpty(newHash) && newHash != head.Hash) SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, newHash), "checkout", target.Force);
        else if (target.Force && !string.IsNullOrEmpty(newHash)) SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, newHash), "checkout", true);
        if (!string.IsNullOrEmpty(target.Create))
        {
            if (!string.IsNullOrEmpty(newHash)) WriteRef(r, $"refs/heads/{target.Create}", newHash);
            SetHeadBranch(r, target.Create);
            if (!string.IsNullOrEmpty(target.Track))
            {
                var segs = target.Track.Split('/');
                SetConfig(g, Gpath(r, "config"), $"branch.{target.Create}.remote", segs[0]);
                SetConfig(g, Gpath(r, "config"), $"branch.{target.Create}.merge", $"refs/heads/{string.Join("/", segs.Skip(1))}");
                g.Out($"branch '{target.Create}' set up to track '{target.Track}'.\n");
            }
        }
        else if (!string.IsNullOrEmpty(target.Branch)) SetHeadBranch(r, target.Branch);
        else SetHeadDetached(r, newHash!);
        var toName = target.Create ?? target.Branch ?? newHash!;
        if (!string.IsNullOrEmpty(newHash)) Reflog(r, head.Hash, newHash, $"checkout: moving from {fromName} to {toName}");
        // Local changes that are carried along are shown like in real git.
        if (r.Root is not null)
        {
            var s = ComputeStatus(r);
            var changed = new Dictionary<string, char>(StringComparer.Ordinal);
            foreach (var ch in s.Staged) changed[ch.Path] = ch.Status == 'R' ? 'A' : ch.Status;
            foreach (var ch in s.Unstaged) changed[ch.Path] = ch.Status;
            foreach (var p in SortedOrdinal(changed.Keys)) g.Out($"{changed[p]}\t{Show(r, p)}\n");
        }
        if (!string.IsNullOrEmpty(target.Detach))
        {
            DetachedAdvice(g, r, newHash!, target.StartRev ?? Short(newHash!));
            return 0;
        }
        if (string.IsNullOrEmpty(head.Branch) && !string.IsNullOrEmpty(head.Hash) && string.IsNullOrEmpty(target.Create))
            g.Err($"Previous HEAD position was {Short(head.Hash)} {Subject(ReadCommit(r, head.Hash))}\n");
        g.Err(!string.IsNullOrEmpty(target.Create) ? $"Switched to a new branch '{target.Create}'\n" : $"Switched to branch '{target.Branch}'\n");
        var nb = target.Create ?? target.Branch!;
        var h = ReadRef(r, $"refs/heads/{nb}");
        if (!string.IsNullOrEmpty(h)) g.Out(TrackingText(r, nb, h));
        return 0;
    }

    /// <summary>If only origin/&lt;name&gt; exists, git creates a local branch that tracks it.</summary>
    private static string? RemoteGuess(Repo r, string name)
    {
        var hits = ListRefs(r, "refs/remotes/").Where(x => string.Join("/", x.Split('/').Skip(1)) == name).ToList();
        return hits.Count == 1 ? hits[0] : null;
    }

    private static int CmdSwitch(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "c|create=", "C|force-create=", "d|detach", "f|force|discard-changes", "t|track", "q|quiet" }, "switch");
        var r = NeedRepo(g);
        NeedWork(r);
        if (ExistsAt(g, Gpath(r, "MERGE_HEAD")) && !o.Has("force")) throw Fatal("cannot switch branch while merging\nConsider \"git merge --quit\" or \"git worktree add\".");
        var create = o.Get("create") ?? o.Get("force-create");
        if (!string.IsNullOrEmpty(create))
        {
            CheckBranchName(g, create);
            if (BranchExists(r, create) && !o.Has("force-create")) throw Fatal($"a branch named '{create}' already exists");
            var start = o.Operands.Count > 0 ? o.Operands[0] : null;
            var track = !string.IsNullOrEmpty(start) && !string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{start}")) ? start : null;
            return DoSwitch(r, new SwitchTarget { Create = create, StartRev = start, Force = o.Has("force"), Track = track });
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(name)) throw Fatal("missing branch or commit argument");
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("invalid reference: @{-1}");
        if (o.Has("detach")) return DoSwitch(r, new SwitchTarget { Detach = NeedCommit(r, name), StartRev = name, Force = o.Has("force") });
        if (BranchExists(r, name)) return DoSwitch(r, new SwitchTarget { Branch = name, Force = o.Has("force") });
        if (Hash40Re.IsMatch(name) && ResolveCommit(r, name) is not null) return DoSwitch(r, new SwitchTarget { Detach = name, StartRev = Short(name), Force = o.Has("force") });
        var remote = RemoteGuess(r, name);
        if (remote is not null) return DoSwitch(r, new SwitchTarget { Create = name, StartRev = remote, Track = remote, Force = o.Has("force") });
        if (ResolveCommit(r, name) is not null)
        {
            g.Err($"fatal: a branch is expected, got {(!string.IsNullOrEmpty(ReadRef(r, $"refs/tags/{name}")) ? "tag" : "commit")} '{name}'\n");
            g.Hint("If you want to detach HEAD at the commit, try again with the --detach option.");
            return 128;
        }
        throw Fatal($"invalid reference: {name}");
    }

    private static int CmdCheckout(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "b=", "B=", "f|force", "q|quiet", "detach", "ours", "theirs", "t|track" }, "checkout");
        var r = NeedRepo(g);
        NeedWork(r);
        var create = o.Get("b") ?? o.Get("B");
        if (!string.IsNullOrEmpty(create))
        {
            CheckBranchName(g, create);
            if (BranchExists(r, create) && !o.Has("B")) throw Fatal($"a branch named '{create}' already exists");
            var start = o.Operands.Count > 0 ? o.Operands[0] : null;
            var track = !string.IsNullOrEmpty(start) && !string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{start}")) ? start : null;
            return DoSwitch(r, new SwitchTarget { Create = create, StartRev = start, Force = o.Has("force"), Track = track });
        }
        if (o.Paths is not null || o.Has("ours") || o.Has("theirs"))
        {
            var source = o.Operands.Count > 0 ? o.Operands[0] : null;
            var paths = o.Paths ?? o.Operands;
            if (o.Paths is not null && o.Operands.Count > 1) throw Fatal("only one reference expected");
            if (paths.Count == 0) throw Fatal("you must specify path(s) to restore");
            return RestorePaths(r, paths, new RestoreOpts
            {
                Worktree = true,
                Staged = !string.IsNullOrEmpty(source) && o.Paths is not null,
                Source = o.Paths is not null ? source : null,
                Ours = o.Has("ours"),
                Theirs = o.Has("theirs"),
                CheckoutStyle = true,
            });
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(name)) return 0;
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("invalid reference: @{-1}");
        if (o.Operands.Count == 1)
        {
            if (ExistsAt(g, Gpath(r, "MERGE_HEAD")) && !o.Has("force") && (BranchExists(r, name) || ResolveCommit(r, name) is not null))
            {
                throw Fail("error: you need to resolve your current index first");
            }
            if (BranchExists(r, name) && !o.Has("detach")) return DoSwitch(r, new SwitchTarget { Branch = name, Force = o.Has("force") });
            var h = ResolveCommit(r, name);
            if (h is not null) return DoSwitch(r, new SwitchTarget { Detach = h, StartRev = name, Force = o.Has("force") });
            var remote = RemoteGuess(r, name);
            if (remote is not null) return DoSwitch(r, new SwitchTarget { Create = name, StartRev = remote, Track = remote, Force = o.Has("force") });
        }
        // Otherwise they are files: bring back the version from the index.
        bool isRev = o.Operands.Count > 1 && ResolveCommit(r, o.Operands[0]) is not null;
        var files = isRev ? o.Operands.Skip(1).ToList() : o.Operands;
        return RestorePaths(r, files, new RestoreOpts { Worktree = true, Staged = isRev, Source = isRev ? o.Operands[0] : null, CheckoutStyle = true });
    }

    // merge

    private sealed class MergeOpts
    {
        public bool NoFf;
        public bool FfOnly;
        public string? Message;
        public string ReflogName = "";
    }

    private static int MergeInto(Repo r, string theirs, string label, MergeOpts opts)
    {
        var g = r.G;
        var head = ReadHead(r);
        if (string.IsNullOrEmpty(head.Hash))
        {
            // Empty branch: the "merge" just points at the other commit.
            SwitchTree(r, new JsMap<string>(), CommitTree(r, theirs), "merge");
            MoveHead(r, theirs, $"merge {opts.ReflogName}: Fast-forward");
            return 0;
        }
        if (head.Hash == theirs || IsAncestor(r, theirs, head.Hash))
        {
            g.Out("Already up to date.\n");
            return 0;
        }
        var @base = MergeBase(r, head.Hash, theirs);
        var ourTree = CommitTree(r, head.Hash);
        var theirTree = CommitTree(r, theirs);
        if (@base == head.Hash && !opts.NoFf)
        {
            SwitchTree(r, ourTree, theirTree, "merge");
            MoveHead(r, theirs, $"merge {opts.ReflogName}: Fast-forward");
            g.Out($"Updating {Short(head.Hash)}..{Short(theirs)}\nFast-forward\n{StatText(r, TreeChanges(ourTree, theirTree), false)}");
            return 0;
        }
        if (opts.FfOnly)
        {
            g.Hint("Diverging branches can't be fast-forwarded, you need to either:\n\n\tgit merge --no-ff\n\nor:\n\n\tgit rebase\n\nDisable this message with \"git config set advice.diverging false\"");
            throw Fatal("Not possible to fast-forward, aborting.");
        }
        var baseTree = CommitTree(r, @base);
        var result = new JsMap<string>();
        var unmerged = new JsMap<Unmerged>();
        var conflictFiles = new JsMap<string>();
        var messages = new List<string>();
        var paths = SortedOrdinal(Union(baseTree.Keys, ourTree.Keys, theirTree.Keys));
        foreach (var p in paths)
        {
            var b = baseTree[p];
            var o = ourTree[p];
            var t = theirTree[p];
            if (o == t || t == b)
            {
                if (!string.IsNullOrEmpty(o)) result[p] = o;
                continue;
            }
            if (o == b)
            {
                if (!string.IsNullOrEmpty(t)) result[p] = t;
                continue;
            }
            // Both sides changed the file.
            if (string.IsNullOrEmpty(o) || string.IsNullOrEmpty(t))
            {
                var deletedIn = string.IsNullOrEmpty(o) ? "HEAD" : label;
                var modifiedIn = string.IsNullOrEmpty(o) ? label : "HEAD";
                messages.Add($"CONFLICT (modify/delete): {p} deleted in {deletedIn} and modified in {modifiedIn}.  Version {modifiedIn} of {p} left in tree.");
                unmerged[p] = new Unmerged { Base = b, Ours = o, Theirs = t };
                conflictFiles[p] = ReadBlob(r, (o ?? t)!);
                if (!string.IsNullOrEmpty(o)) result[p] = o;
                continue;
            }
            messages.Add($"Auto-merging {p}");
            var m = Merge3(!string.IsNullOrEmpty(b) ? ReadBlob(r, b) : "", ReadBlob(r, o), ReadBlob(r, t), "HEAD", label);
            if (m.Conflict)
            {
                messages.Add($"CONFLICT ({(!string.IsNullOrEmpty(b) ? "content" : "add/add")}): Merge conflict in {p}");
                unmerged[p] = new Unmerged { Base = b, Ours = o, Theirs = t };
                conflictFiles[p] = m.Text;
                result[p] = o;
            }
            else result[p] = WriteObj(r, "blob", m.Text);
        }
        // Check local changes before anything is written.
        var idx = SwitchTree(r, ourTree, result, "merge", false, unmerged.Keys);
        foreach (var p in conflictFiles.Keys) WriteWorkFile(r, p, conflictFiles[p]!);
        foreach (var p in unmerged.Keys)
        {
            idx.Unmerged[p] = unmerged[p];
            if (string.IsNullOrEmpty(unmerged[p]!.Ours)) idx.Entries.Delete(p);
        }
        WriteIndex(r, idx);
        var into = !string.IsNullOrEmpty(head.Branch) && head.Branch is not ("main" or "master") ? $" into {head.Branch}" : "";
        var message = !string.IsNullOrEmpty(opts.Message)
            ? CleanMessage(opts.Message)
            : $"Merge {(label.StartsWith("origin/", StringComparison.Ordinal) || label.Contains('/') ? "remote-tracking branch" : "branch")} '{label}'{into}\n";
        if (messages.Count > 0) g.Out(string.Concat(messages.Select(m => m + "\n")));
        if (unmerged.Count > 0)
        {
            WriteText(g, Gpath(r, "MERGE_HEAD"), theirs + "\n");
            WriteText(g, Gpath(r, "MERGE_MODE"), opts.NoFf ? "no-ff" : "");
            WriteText(g, Gpath(r, "MERGE_MSG"), $"{message}\n# Conflicts:\n{string.Concat(unmerged.Keys.Select(p => $"#\t{p}\n"))}");
            g.Out("Automatic merge failed; fix conflicts and then commit the result.\n");
            return 1;
        }
        var id = Identity(g, r)!;
        var h = WriteCommit(r, new Commit { Tree = WriteTree(r, result), Parents = new List<string> { head.Hash, theirs }, Author = id, Committer = id, Message = message });
        MoveHead(r, h, $"merge {opts.ReflogName}: Merge made by the 'ort' strategy.");
        g.Out($"Merge made by the 'ort' strategy.\n{StatText(r, TreeChanges(ourTree, result), false)}");
        return 0;
    }

    private static int CmdMerge(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "no-ff", "ff", "ff-only", "m|message=", "abort", "continue", "no-edit", "e|edit", "q|quiet", "squash" }, "merge");
        var r = NeedRepo(g);
        NeedWork(r);
        var mergeHead = ReadText(g, Gpath(r, "MERGE_HEAD"));
        if (o.Has("abort"))
        {
            if (string.IsNullOrEmpty(mergeHead)) throw Fatal("There is no merge to abort (MERGE_HEAD missing).");
            var head = ReadHead(r);
            var idx = ReadIndex(r);
            var t = CommitTree(r, head.Hash);
            foreach (var p in Union(idx.Entries.Keys, idx.Unmerged.Keys))
            {
                if (!t.Has(p)) RemoveWorkFile(r, p);
            }
            foreach (var p in t.Keys) WriteWorkFile(r, p, ReadBlob(r, t[p]!));
            WriteIndex(r, new Index { Entries = t.Copy(), Unmerged = new JsMap<Unmerged>() });
            foreach (var f in new[] { "MERGE_HEAD", "MERGE_MSG", "MERGE_MODE" }) RemoveFile(g, Gpath(r, f));
            return 0;
        }
        if (o.Has("continue"))
        {
            if (string.IsNullOrEmpty(mergeHead)) throw Fatal("There is no merge in progress (MERGE_HEAD missing).");
            return CmdCommit(g, new List<string>());
        }
        if (!string.IsNullOrEmpty(mergeHead)) throw Fatal("You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.");
        if (o.Has("squash"))
        {
            g.Note("git.mergeSquashUnsupported");
            return 1;
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        var hd = ReadHead(r);
        if (string.IsNullOrEmpty(name))
        {
            var up = !string.IsNullOrEmpty(hd.Branch) ? UpstreamOf(r, hd.Branch) : null;
            if (up is null) throw Fatal("No remote for the current branch.");
            name = up.Name;
        }
        if (o.Operands.Count > 1)
        {
            g.Note("git.octopusUnsupported");
            return 1;
        }
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("No previous branch.");
        var theirs = ResolveCommit(r, name) ?? throw Fatal($"{name} - not something we can merge");
        var msgs = o.GetAll("message");
        return MergeInto(r, theirs, name, new MergeOpts
        {
            NoFf = o.Has("no-ff") || GetConfig(g, r, "merge.ff") == "false",
            FfOnly = o.Has("ff-only") || GetConfig(g, r, "merge.ff") == "only",
            Message = msgs is not null ? string.Join("\n\n", msgs) : null,
            ReflogName = name,
        });
    }

    // reset

    private static int CmdReset(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "soft", "mixed", "hard", "q|quiet", "keep", "merge" }, "reset");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        var rev = "HEAD";
        var ops = new List<string>(o.Operands);
        if (ops.Count > 0 && ResolveCommit(r, ops[0]) is not null && (o.Paths is not null || ops.Count == 1 || !ExistsAt(g, VfsLib.ResolvePath(g.Cwd, ops[0]))))
        {
            rev = ops[0];
            ops.RemoveAt(0);
        }
        var paths = ops.Concat(o.Paths ?? new List<string>()).ToList();
        if (paths.Count > 0)
        {
            if (o.Has("hard") || o.Has("soft")) throw Fatal($"Cannot do {(o.Has("hard") ? "hard" : "soft")} reset with paths.");
            NeedWork(r);
            var t = rev == "HEAD" && string.IsNullOrEmpty(head.Hash) ? new JsMap<string>() : (RevTree(r, rev) ?? throw Fatal($"Failed to resolve '{rev}' as a valid revision."));
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            var idx = ReadIndex(r);
            foreach (var p in Union(idx.Entries.Keys, t.Keys))
            {
                if (!specs.Any(s => SpecMatch(s, p))) continue;
                if (!string.IsNullOrEmpty(t[p])) idx.Entries[p] = t[p];
                else idx.Entries.Delete(p);
                idx.Unmerged.Delete(p);
            }
            WriteIndex(r, idx);
            PrintUnstaged(r, o.Has("quiet"));
            return 0;
        }
        var target = rev == "HEAD" && string.IsNullOrEmpty(head.Hash)
            ? null
            : (ResolveCommit(r, rev) ?? throw Fatal($"ambiguous argument '{rev}': unknown revision or path not in the working tree."));
        var tree = CommitTree(r, target);
        if (o.Has("hard"))
        {
            NeedWork(r);
            SwitchTree(r, CommitTree(r, head.Hash), tree, "checkout", true);
        }
        else if (!o.Has("soft"))
        {
            WriteIndex(r, new Index { Entries = tree.Copy(), Unmerged = new JsMap<Unmerged>() });
        }
        foreach (var f in new[] { "MERGE_HEAD", "MERGE_MSG", "MERGE_MODE" }) RemoveFile(g, Gpath(r, f));
        if (!string.IsNullOrEmpty(target) && target != head.Hash) MoveHead(r, target, $"reset: moving to {rev}");
        if (o.Has("hard"))
        {
            if (!string.IsNullOrEmpty(target) && !o.Has("quiet")) g.Out($"HEAD is now at {Short(target)} {Subject(ReadCommit(r, target))}\n");
        }
        else if (!o.Has("soft") && r.Root is not null) PrintUnstaged(r, o.Has("quiet"));
        return 0;
    }

    private static void PrintUnstaged(Repo r, bool quiet)
    {
        if (quiet) return;
        var s = ComputeStatus(r);
        if (s.Unstaged.Count == 0) return;
        r.G.Out($"Unstaged changes after reset:\n{string.Concat(s.Unstaged.Select(c => $"{c.Status}\t{c.Path}\n"))}");
    }

    // show

    private static readonly Regex TagBodyRe = new("\ntag (.*)\ntagger (.*)\n\n([\\s\\S]*)\\z", RO);

    private static int CmdShow(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "stat", "name-only", "name-status", "oneline", "s|no-patch", "pretty=", "format=" }, "show");
        var r = NeedRepo(g);
        var targets = o.Operands.Count > 0 ? o.Operands : new List<string> { "HEAD" };
        var deco = g.Tty ? Decorations(r) : null;
        for (int n = 0; n < targets.Count; n++)
        {
            var rev = targets[n];
            if (n != 0) g.Out("\n");
            int colon = rev.IndexOf(':');
            if (colon >= 0)
            {
                var revPart = rev.Slice(0, colon);
                var t = RevTree(r, revPart != "" ? revPart : "HEAD") ?? throw Fatal($"invalid object name '{revPart}'.");
                var p = rev.Slice(colon + 1);
                if (p.StartsWith("./", StringComparison.Ordinal) && r.Root is not null) p = ToSpec(r, p).Rel;
                var hh = t[p];
                if (string.IsNullOrEmpty(hh))
                {
                    var dir = t.Keys.Where(x => x.StartsWith(p != "" ? p + "/" : "", StringComparison.Ordinal)).ToList();
                    if (dir.Count == 0) throw Fatal($"path '{p}' does not exist in '{(revPart != "" ? revPart : "HEAD")}'");
                    var names = Union(dir.Select(x =>
                    {
                        var rest = x.Slice(p != "" ? p.Length + 1 : 0);
                        return rest.Split('/')[0] + (rest.Contains('/') ? "/" : "");
                    }));
                    g.Out($"tree {rev}\n\n{string.Join("\n", names)}\n");
                    continue;
                }
                g.Out(ReadBlob(r, hh));
                continue;
            }
            var h = ResolveRev(r, rev);
            if (h is null)
            {
                if (rev == "HEAD") throw Fatal($"your current branch '{ReadHead(r).Branch}' does not have any commits yet");
                throw Fail($"fatal: ambiguous argument '{rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'", 128);
            }
            var obj = ReadObj(r, h)!;
            if (obj.Type == "blob")
            {
                g.Out(obj.Data);
                continue;
            }
            if (obj.Type == "tree")
            {
                g.Out($"tree {rev}\n\n{string.Join("\n", ReadTree(r, h).Keys)}\n");
                continue;
            }
            var ch = h;
            if (obj.Type == "tag")
            {
                var tag = TagBodyRe.Match(obj.Data);
                if (tag.Success)
                {
                    var t = ParseIdent(tag.Groups[2].Value);
                    g.Out($"{g.C(Col.Yellow, $"tag {tag.Groups[1].Value}")}\nTagger: {t.Name} <{t.Email}>\nDate:   {FmtDate(t)}\n\n{tag.Groups[3].Value}\n");
                }
                ch = Peel(r, h);
            }
            var c = ReadCommit(r, ch);
            if (o.Has("oneline")) g.Out($"{g.C(Col.Yellow, Short(c.Hash))}{Decorate(g, deco, c.Hash)} {Subject(c)}\n");
            else g.Out(string.Join("\n", CommitHeader(r, c, deco)) + "\n");
            if (o.Has("no-patch") || c.Parents.Count > 1) continue;
            var changes = TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree));
            if (changes.Count > 0 && !o.Has("oneline")) g.Out("\n");
            PrintPatch(r, changes, o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : "patch");
        }
        return 0;
    }

    // tag

    private static int CmdTag(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "a|annotate", "m|message=", "d|delete", "l|list", "f|force", "n" }, "tag");
        var r = NeedRepo(g);
        if (o.Has("delete"))
        {
            foreach (var t in o.Operands)
            {
                var h = ReadRef(r, $"refs/tags/{t}");
                if (string.IsNullOrEmpty(h)) throw Fail($"error: tag '{t}' not found.");
                DeleteRef(r, $"refs/tags/{t}");
                g.Out($"Deleted tag '{t}' (was {Short(h)})\n");
            }
            return 0;
        }
        if (o.Operands.Count == 0 || o.Has("list"))
        {
            foreach (var t in ListRefs(r, "refs/tags/")) g.Out(t + "\n");
            return 0;
        }
        var name = o.Operands[0];
        var rev = o.Operands.Count > 1 ? o.Operands[1] : null;
        if (!ValidBranchName(name)) throw Fatal($"'{name}' is not a valid tag name.");
        if (!string.IsNullOrEmpty(ReadRef(r, $"refs/tags/{name}")) && !o.Has("force")) throw Fatal($"tag '{name}' already exists");
        var target = NeedCommit(r, rev ?? "HEAD");
        if (o.Has("annotate") || o.Has("message"))
        {
            var msgs = o.GetAll("message");
            var msg = msgs is not null ? string.Join("\n\n", msgs) : null;
            if (string.IsNullOrEmpty(msg))
            {
                g.Note("git.tagNoEditor");
                return 1;
            }
            var id = Identity(g, r)!;
            var h = WriteObj(r, "tag", $"object {target}\ntype commit\ntag {name}\ntagger {FmtIdent(id)}\n\n{CleanMessage(msg)}");
            WriteRef(r, $"refs/tags/{name}", h);
        }
        else WriteRef(r, $"refs/tags/{name}", target);
        return 0;
    }
}
