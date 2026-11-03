namespace Codestead.Shell;

// Syntax tree: one command of a ListNode, optionally run in the background (&).

public sealed partial class ListItem
{
    public Node Node { get; set; } = null!;
    public bool Background { get; set; }
}
