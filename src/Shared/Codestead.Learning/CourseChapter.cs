namespace Codestead.Learning;

/// <summary>A chapter of a course as the learning window sees it: its id, its part and its kind (<see cref="ChapterKinds"/>).</summary>
public sealed record CourseChapter(string Id, string Part, string Kind)
{
    public bool IsLesson => Kind == ChapterKinds.Lesson;
}
