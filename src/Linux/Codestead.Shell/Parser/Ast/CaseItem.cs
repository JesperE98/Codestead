namespace Codestead.Shell;

// Syntax tree: one pattern) body ;; branch of a case.

public sealed partial class CaseItem
{
    public List<Word> Patterns { get; set; } = new();
    public Node? Body { get; set; }
}
