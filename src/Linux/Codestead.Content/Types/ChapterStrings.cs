namespace Codestead.Content;

// The translation of a chapter's title and tasks.

/// <summary>Translation of a chapter: src/content/i18n/&lt;lang&gt;/&lt;chapter-id&gt;.json</summary>
public partial class ChapterStrings
{
    public string? Title { get; set; }
    public OrderedDictionary<string, ChapterTaskStrings>? Tasks { get; set; }
}
