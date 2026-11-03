namespace Codestead.Shell.Commands;

// git hash-object.

public static partial class GitCmd
{
    private static int CmdHashObject(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "w", "stdin", "t=" }, "hash-object");
        var r = o.Has("w") ? NeedRepo(g) : null;
        var inputs = o.Has("stdin")
            ? new List<string> { g.Ctx.Stdin ?? "" }
            : o.Operands.Select(f => ReadText(g, VfsLib.ResolvePath(g.Cwd, f)) ?? throw Fatal($"could not open '{f}' for reading: No such file or directory")).ToList();
        foreach (var data in inputs) g.Out((r is not null ? WriteObj(r, "blob", data) : BlobHash(data)) + "\n");
        return 0;
    }
}
