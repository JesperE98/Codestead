namespace Codestead.Shell;

// Syntax tree: one && or || step of an AndOrNode.

public sealed partial class AndOrItem
{
    /// <summary>"&amp;&amp;" or "||".</summary>
    public string Op { get; set; } = "";
    public Node Node { get; set; } = null!;
}
