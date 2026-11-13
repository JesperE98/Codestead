using Codestead.GP.Course.Game;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// The checks of a chapter's tasks on the learner's code: each task's result, what is wrong with the code as a whole
/// (a compile error, a missing render loop …) and the facts the game counts.
/// </summary>
public sealed record CheckReport(
    string ChapterId,
    string Api,
    IReadOnlyList<TaskResult> Tasks,
    IReadOnlyList<CheckMessage> Messages,
    BuildFacts? Facts)
{
    public IEnumerable<string> PassedKeys => Tasks.Where(t => t.Passed).Select(t => t.Key);
}
