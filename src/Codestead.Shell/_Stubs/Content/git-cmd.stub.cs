// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/commands/git.ts.
// Delete when the real GitCmd has been ported (see docs/PORTING.md).
namespace Codestead.Shell.Commands;

public partial class RepoState
{
    public string? Branch { get; set; }
    public string? Head { get; set; }
    public OrderedDictionary<string, string> Branches { get; set; } = Js.Obj<string>();
    /// <summary>The files in the HEAD commit.</summary>
    public List<string> Files { get; set; } = new();
    /// <summary>Number of commits reachable from HEAD.</summary>
    public int Commits { get; set; }
}

public static partial class GitCmd
{
    public static RepoState? GitRepoState(Shell sh, string dir) => throw new NotImplementedException();
    public static bool GitIsAncestor(Shell sh, string dir, string a, string b) => throw new NotImplementedException();
    public static string? GitGlobalConfig(Shell sh, string home, string key) => throw new NotImplementedException();
}
