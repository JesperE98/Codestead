using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: a list of commands separated by ; & or newline.

public sealed partial class ListNode : Node
{
    [JsonIgnore] public override string Type => "list";
    public List<ListItem> Items { get; set; } = new();
}
