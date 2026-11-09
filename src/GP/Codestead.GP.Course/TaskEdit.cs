namespace Codestead.GP.Course;

/// <summary>One edit of a task's solution: in <see cref="File"/>, <see cref="Find"/> becomes <see cref="Replace"/>.</summary>
public sealed record TaskEdit(string File, string Find, string Replace);
