namespace Codestead.Shell;

// Syntax tree: base class of compound commands, which can have their own redirections.

/// <summary>Compound commands that can have their own redirections.</summary>
public abstract partial class CompoundNode : Node
{
    public List<Redirect> Redirects { get; set; } = new();
}
