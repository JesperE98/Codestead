namespace Codestead.Shell.Commands;

// git rev-parse.

public static partial class GitCmd
{
    private static int CmdRevParse(G g, List<string> args)
    {
        var r = Discover(g, g.Cwd);
        double shortLen = 0;
        bool abbrev = false;
        foreach (var a in args)
        {
            if (a == "--is-inside-work-tree")
            {
                g.Out(r?.Root is not null ? "true\n" : r is not null ? "false\n" : "");
                if (r is null) throw Fatal("not a git repository (or any of the parent directories): .git");
                continue;
            }
            if (r is null) throw Fatal("not a git repository (or any of the parent directories): .git");
            var repo = r;
            if (a == "--show-toplevel") g.Out((repo.Root ?? throw Fatal("this operation must be run in a work tree")) + "\n");
            else if (a == "--git-dir") g.Out((repo.Root is not null && repo.Root == g.Cwd ? ".git" : repo.GitDir) + "\n");
            else if (a == "--is-bare-repository") g.Out(repo.Root is not null ? "false\n" : "true\n");
            else if (a.StartsWith("--short", StringComparison.Ordinal))
            {
                var parts = a.Split('=');
                shortLen = parts.Length > 1 ? Js.Number(parts[1]) : 7;
            }
            else if (a == "--abbrev-ref") abbrev = true;
            else if (a.StartsWith('-')) continue;
            else
            {
                if (abbrev && (a == "HEAD" || a == "@"))
                {
                    var head = ReadHead(repo);
                    g.Out((head.Branch ?? "HEAD") + "\n");
                    continue;
                }
                var h = ResolveRev(repo, a);
                if (h is null)
                    throw Fail($"{a}\nfatal: ambiguous argument '{a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'", 128);
                g.Out((shortLen != 0 && !double.IsNaN(shortLen) ? h.Slice(0, SliceEnd(shortLen)) : h) + "\n");
            }
        }
        return 0;
    }
}
