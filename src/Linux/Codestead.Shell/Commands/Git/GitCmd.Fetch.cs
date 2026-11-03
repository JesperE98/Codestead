namespace Codestead.Shell.Commands;

// git fetch.

public static partial class GitCmd
{
    private static int CmdFetch(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "all", "q|quiet", "prune", "p" }, "fetch");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        var remote = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? (!string.IsNullOrEmpty(head.Branch) ? GetConfig(g, r, $"branch.{head.Branch}.remote") : null) ?? "origin";
        if (string.IsNullOrEmpty(RemoteUrl(r, remote)) && o.Operands.Count == 0)
        {
            // No remotes at all: real git says nothing.
            return 0;
        }
        return FetchRemote(r, remote, o.Has("quiet"));
    }
}
