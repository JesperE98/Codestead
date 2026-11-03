namespace Codestead.Shell.Commands;

// git init.

public static partial class GitCmd
{
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
}
