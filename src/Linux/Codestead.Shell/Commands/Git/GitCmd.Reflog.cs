namespace Codestead.Shell.Commands;

// git reflog.

public static partial class GitCmd
{
    private static int CmdReflog(G g, List<string> args)
    {
        var r = NeedRepo(g);
        var sub = args.Count > 0 ? args[0] : null;
        if (!string.IsNullOrEmpty(sub) && sub != "show")
        {
            g.Note("git.reflogShowOnly");
            return 1;
        }
        var log = ReadReflog(r);
        log.Reverse();
        if (log.Count == 0)
        {
            var head = ReadHead(r);
            if (string.IsNullOrEmpty(head.Hash)) throw Fatal($"your current branch '{head.Branch}' does not have any commits yet");
        }
        var deco = g.Tty ? Decorations(r) : null;
        for (int i = 0; i < log.Count; i++)
        {
            var e = log[i];
            g.Out($"{g.C(Col.Yellow, Short(e.To))}{(i == 0 ? Decorate(g, deco, e.To) : "")} HEAD@{{{i}}}: {e.Msg}\n");
        }
        return 0;
    }
}
