namespace Codestead.Learning;

// A link to an official source at the end of a chapter.

/// <summary>A link to an official source, shown at the end of a sub-chapter.</summary>
public partial class Reference
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Publisher { get; set; } = "";
}
