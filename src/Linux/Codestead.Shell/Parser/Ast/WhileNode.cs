using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: while/until loops.

public sealed partial class WhileNode : CompoundNode
{
    [JsonIgnore] public override string Type => "while";
    public bool Until { get; set; }
    public Node Cond { get; set; } = null!;
    public Node Body { get; set; } = null!;
}
