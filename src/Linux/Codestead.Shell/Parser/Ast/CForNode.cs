using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: the C-style loop for ((init; cond; step)); do ...; done.

public sealed partial class CForNode : CompoundNode
{
    [JsonIgnore] public override string Type => "cfor";
    public string Init { get; set; } = "";
    public string Cond { get; set; } = "";
    public string Step { get; set; } = "";
    public Node Body { get; set; } = null!;
}
