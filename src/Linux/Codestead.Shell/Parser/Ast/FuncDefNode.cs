using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: a function definition, name() { ...; }.

public sealed partial class FuncDefNode : Node
{
    [JsonIgnore] public override string Type => "funcdef";
    public string Name { get; set; } = "";
    public Node Body { get; set; } = null!;
}
