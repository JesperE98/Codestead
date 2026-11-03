namespace Codestead.Learning;

/// <summary>
/// What the learning engine needs to know about a course: its parts in order, the lessons of each part and which
/// parts end with an exam. A tool builds it from its own chapter definitions.
/// </summary>
public sealed record CourseOutline(IReadOnlyList<OutlinePart> Parts)
{
    /// <summary>Every lesson id, in course order.</summary>
    public IReadOnlyList<string> Lessons { get; } = Parts.SelectMany(p => p.Lessons).ToList();

    public IReadOnlyList<string> LessonsIn(string part) => Parts.FirstOrDefault(p => p.Id == part)?.Lessons ?? [];

    /// <summary>The number of exams in the course.</summary>
    public int ExamCount => Parts.Count(p => p.HasExam);
}
