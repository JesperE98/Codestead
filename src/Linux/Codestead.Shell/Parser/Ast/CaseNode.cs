using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Syntax tree: case WORD in ... esac.

public sealed partial class CaseNode : CompoundNode
{
    [JsonIgnore] public override string Type => "case";
    public Word Word { get; set; } = null!;
    public List<CaseItem> Items { get; set; } = new();
}
