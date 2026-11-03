using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: commands joined with && and ||.

public sealed partial class AndOrNode : Node
{
    [JsonIgnore] public override string Type => "andor";
    public Node First { get; set; } = null!;
    public List<AndOrItem> Rest { get; set; } = new();
}
