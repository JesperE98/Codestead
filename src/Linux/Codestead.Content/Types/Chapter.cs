namespace Codestead.Content;

// A chapter (lesson, summary or exam) and its tasks.

public partial class Chapter
{
    public string Id { get; set; } = "";
    public string Part { get; set; } = "";
    /// <summary>Title in Swedish. Other languages are in i18n/&lt;lang&gt;/&lt;id&gt;.json.</summary>
    public string Title { get; set; } = "";
    public List<ChapterTask> Tasks { get; set; } = new();
    /// <summary>
    /// "lesson" (text, checkpoints, tasks and terminal), "summary" (recap of a main chapter, text only)
    /// or "exam" (the test at the end of a main chapter).
    /// </summary>
    public string Kind { get; set; } = ChapterKinds.Lesson;
    /// <summary>
    /// A chapter about one distribution family ("debian", "arch", "redhat") runs on a distribution of
    /// that family; null means any (the student's choice in the distro main chapter, Ubuntu elsewhere).
    /// </summary>
    public string? Family { get; set; }
}
