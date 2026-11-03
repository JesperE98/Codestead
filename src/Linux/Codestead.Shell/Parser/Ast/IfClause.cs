namespace Codestead.Shell;

// Syntax tree: one if/elif condition and its body.

public sealed partial class IfClause
{
    public Node Cond { get; set; } = null!;
    public Node Body { get; set; } = null!;
}
