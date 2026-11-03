namespace Codestead.Learning;

/// <summary>A main chapter ("part") of a <see cref="CourseOutline"/>: its lesson ids in order, and whether it ends with an exam.</summary>
public sealed record OutlinePart(string Id, IReadOnlyList<string> Lessons, bool HasExam);
