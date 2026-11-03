using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: a pipeline (a | b | c), optionally negated with !.

public sealed partial class PipelineNode : Node
{
    [JsonIgnore] public override string Type => "pipeline";
    public List<Node> Commands { get; set; } = new();
    public bool Negate { get; set; }
}
