namespace Codestead.GP.Course;

/// <summary>A task of a chapter for one API: its id and the edits that solve it (from the chapter's edits.txt).</summary>
public sealed record CourseTask(string Id, IReadOnlyList<TaskEdit> Edits);
