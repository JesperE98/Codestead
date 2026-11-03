namespace Codestead.Shell.Commands;

/// <summary>A summary of a repository (see <see cref="GitCmd.GitRepoState"/>).</summary>
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
