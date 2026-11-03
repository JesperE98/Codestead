namespace Codestead.Shell.Commands;

// git branch.

public static partial class GitCmd
{
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
}
