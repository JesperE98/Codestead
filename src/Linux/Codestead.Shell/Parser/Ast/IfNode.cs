using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: if/elif/else/fi.

public sealed partial class IfNode : CompoundNode
{
    [JsonIgnore] public override string Type => "if";
    public List<IfClause> Clauses { get; set; } = new();
    public Node? ElseBody { get; set; }
}
