namespace Codestead.Shell.Commands;

// git cat-file.

public static partial class GitCmd
{
    private static int CmdCatFile(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "p", "t", "s", "e" }, "cat-file");
        var r = NeedRepo(g);
        var rev = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(rev)) throw Fail("usage: git cat-file <type> <object>\n   or: git cat-file (-e | -p) <object>\n   or: git cat-file (-t | -s) <object>", 129);
        string? h;
        int colon = rev.IndexOf(':');
        if (colon >= 0)
        {
            var revPart = rev.Slice(0, colon);
            h = RevTree(r, revPart != "" ? revPart : "HEAD")?[rev.Slice(colon + 1)];
        }
        else h = ResolveRev(r, rev);
        if (o.Has("e")) return !string.IsNullOrEmpty(h) && ReadObj(r, h) is not null ? 0 : 1;
        var obj = !string.IsNullOrEmpty(h) ? ReadObj(r, h) : null;
        if (obj is null) throw Fatal($"Not a valid object name {rev}");
        if (o.Has("t")) g.Out(obj.Type + "\n");
        else if (o.Has("s")) g.Out(Js.Utf8Length(obj.Data) + "\n");
        else g.Out(obj.Data);
        return 0;
    }
}
