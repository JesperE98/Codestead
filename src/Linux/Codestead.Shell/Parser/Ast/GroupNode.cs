using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: { ...; } and the subshell ( ... ).

public sealed partial class GroupNode : CompoundNode
{
    [JsonIgnore] public override string Type => "group";
    public Node Body { get; set; } = null!;
    public bool Subshell { get; set; }
}
