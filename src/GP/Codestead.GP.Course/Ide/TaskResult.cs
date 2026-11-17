namespace Codestead.GP.Course.Ide;

/// <summary>
/// A task's check on the learner's code: its id, progress key, whether it passed, and whether it can be checked at all
/// (an exercise without a check is ticked by the learner).
/// </summary>
public sealed record TaskResult(string TaskId, string Key, bool Passed, bool Checkable = true);
