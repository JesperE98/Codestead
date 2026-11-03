namespace Codestead.Shell.Commands;

// git tag.

public static partial class GitCmd
{
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
