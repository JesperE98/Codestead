namespace Codestead.GP.Course;

/// <summary>A source in references/&lt;chapter&gt;.json: title, URL, publisher and the API it is for (null: every API).</summary>
public sealed class ApiReference
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Publisher { get; set; } = "";
    public string? Api { get; set; }
}
