using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: a simple command (words and redirections).

public sealed partial class SimpleNode : Node
{
    [JsonIgnore] public override string Type => "simple";
    public List<Word> Words { get; set; } = new();
    public List<Redirect> Redirects { get; set; } = new();
}
