namespace Codestead.Content;

// The translation of one task's text and hint.

/// <summary>One task in <see cref="ChapterStrings"/>: text and hint, each a string or a <see cref="FamilyText"/>.</summary>
public partial class ChapterTaskStrings
{
    public PerDistro<string>? Text { get; set; }
    public PerDistro<string>? Hint { get; set; }
}
