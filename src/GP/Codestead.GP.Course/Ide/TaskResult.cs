namespace Codestead.GP.Course.Ide;

/// <summary>A task's check on the learner's code: its id, progress key and whether it passed.</summary>
public sealed record TaskResult(string TaskId, string Key, bool Passed);
