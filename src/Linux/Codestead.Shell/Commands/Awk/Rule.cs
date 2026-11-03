namespace Codestead.Shell.Commands;

// awk: a pattern with its action.

public partial class Rule
{
    /// <summary>"BEGIN", "END", an <see cref="Expr"/> or null (every record).</summary>
    public object? Pattern { get; set; }
    public List<Stmt>? Action { get; set; }
}
