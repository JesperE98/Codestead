using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: the base class of every command node (with its JSON type discriminator).

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(SimpleNode), "simple")]
[JsonDerivedType(typeof(PipelineNode), "pipeline")]
[JsonDerivedType(typeof(AndOrNode), "andor")]
[JsonDerivedType(typeof(ListNode), "list")]
[JsonDerivedType(typeof(IfNode), "if")]
[JsonDerivedType(typeof(ForNode), "for")]
[JsonDerivedType(typeof(CForNode), "cfor")]
[JsonDerivedType(typeof(WhileNode), "while")]
[JsonDerivedType(typeof(CaseNode), "case")]
[JsonDerivedType(typeof(GroupNode), "group")]
[JsonDerivedType(typeof(ArithNode), "arith")]
[JsonDerivedType(typeof(FuncDefNode), "funcdef")]
public abstract partial class Node
{
    /// <summary>The TypeScript discriminator: "simple", "pipeline", "andor", "list", "if", ...</summary>
    [JsonIgnore] public abstract string Type { get; }
}
