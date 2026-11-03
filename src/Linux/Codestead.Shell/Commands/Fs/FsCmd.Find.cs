namespace Codestead.Shell.Commands;

// The find command: searches for files in a directory tree.

public static partial class FsCmd
{
    private static readonly CommandDef Find = new()
    {
        Name = "find",
        Summary = "Söker efter filer i en katalogstruktur",
        Man = """
NAMN
       find - sök efter filer i en katalogstruktur

SYNOPSIS
       find [SÖKVÄG...] [UTTRYCK]

UTTRYCK
       -name MÖNSTER     filnamnet matchar MÖNSTER (t.ex. "*.txt")
       -iname MÖNSTER    som -name men skiftlägesokänsligt
       -type f|d|l       bara filer (f), kataloger (d) eller symboliska
                         länkar (l)
       -maxdepth N       gå högst N nivåer ner
       -mindepth N       visa inget på nivåer grundare än N

EXEMPEL
       find ~ -name "*.txt"
       find /etc -maxdepth 1 -type d

TIPS
       Sätt mönstret inom citattecken, annars expanderar skalet * innan
       find ens får se det.
""",
        Run = RunFind,
    };

    private static int RunFind(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var args = ctx.Args.ToList();
        string? Shift()
        {
            if (args.Count == 0) return null;
            var first = args[0];
            args.RemoveAt(0);
            return first;
        }
        var paths = new List<string>();
        while (args.Count > 0 && !args[0].StartsWith('-')) paths.Add(Shift()!);
        if (paths.Count == 0) paths.Add(".");
        var tests = new List<Func<string, FsNode, bool>>();
        double maxDepth = double.PositiveInfinity;
        double minDepth = 0;
        while (args.Count > 0)
        {
            var a = Shift()!;
            var v = Shift();
            if (v is null && a != "-print")
            {
                ctx.Err($"find: missing argument to `{a}'\n");
                return 1;
            }
            switch (a)
            {
                case "-name":
                case "-iname":
                {
                    var re = ParserLib.GlobToRegex(v!);
                    var rx = a == "-iname" ? new Regex(re.ToString(), re.Options | RegexOptions.IgnoreCase) : re;
                    tests.Add((name, _) => rx.IsMatch(name));
                    break;
                }
                case "-type":
                    if (v != "f" && v != "d" && v != "l")
                    {
                        ctx.Err($"find: Unknown argument to -type: {v}\n");
                        return 1;
                    }
                    tests.Add((_, node) => v == "f" ? node.Type == "file" : v == "l" ? node.Type == "link" : node.Type == "dir");
                    break;
                case "-maxdepth":
                    maxDepth = Js.Number(v);
                    break;
                case "-mindepth":
                    minDepth = Js.Number(v);
                    break;
                case "-print":
                    if (v is not null) args.Insert(0, v);
                    break;
                default:
                    ctx.Err($"find: unknown predicate `{a}'\n");
                    return 1;
            }
        }
        int code = 0;
        void Walk(string display, FsNode node, int depth)
        {
            var name = VfsLib.Basename(display);
            if (depth >= minDepth && tests.All(t => t(name, node))) ctx.Out(display + "\n");
            if (node.Type != "dir" || depth >= maxDepth) return;
            if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
            {
                ctx.Err($"find: '{display}': Permission denied\n");
                code = 1;
                return;
            }
            foreach (var child in node.Children!.Keys.ToList().SortJs())
            {
                Walk(display.EndsWith('/') ? display + child : $"{display}/{child}", node.Children[child], depth + 1);
            }
        }
        foreach (var p in paths)
        {
            try
            {
                Walk(p, sh.Vfs.Lookup(sh.Resolve(p), user), 0);
            }
            catch (FsError e)
            {
                ctx.Err($"find: '{p}': {e.Message}\n");
                code = 1;
            }
        }
        return code;
    }
}
