using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: for NAME in WORDS; do ...; done.

public sealed partial class ForNode : CompoundNode
{
    [JsonIgnore] public override string Type => "for";
    public string Name { get; set; } = "";
    public List<Word>? Words { get; set; }
    public Node Body { get; set; } = null!;
}
