using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: the arithmetic command (( ... )).

public sealed partial class ArithNode : CompoundNode
{
    [JsonIgnore] public override string Type => "arith";
    public string Expr { get; set; } = "";
}
