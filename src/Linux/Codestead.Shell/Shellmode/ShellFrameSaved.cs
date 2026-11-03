namespace Codestead.Shell;

// Shell stack: the parent shell's state, restored on exit.

/// <summary>The parent shell's state, restored on exit.</summary>
public partial class ShellFrameSaved
{
    public string Cwd { get; set; } = "";
    public OrderedDictionary<string, string> Env { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, string> Aliases { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, Node> Functions { get; set; } = Js.Obj<Node>();
}
