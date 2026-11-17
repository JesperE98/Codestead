using System.Collections.Concurrent;
using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// What a task's result should look like: the course's own solution up to and including the task (the start
/// project with the edits of every task so far), built and run by the simulated GPU. Cached per chapter, API and task.
/// </summary>
public static class ExpectedResult
{
    private static readonly ConcurrentDictionary<string, Lazy<Gpu.Scene.Scene?>> Scenes = new(StringComparer.Ordinal);

    /// <summary>
    /// The project after the tasks up to <paramref name="taskIndex"/> (inclusive) of <see cref="GpCourse.AllTasks"/>: a
    /// step builds on the steps before it, an exercise changes the chapter's finished program on its own.
    /// </summary>
    public static GpuProject Project(string chapterId, string api, int taskIndex)
    {
        var steps = GpCourse.Tasks(chapterId, api);
        if (taskIndex >= steps.Count && GpCourse.Exercises(chapterId, api).ElementAtOrDefault(taskIndex - steps.Count) is { } exercise)
        {
            var solved = GpCourse.SolutionProject(chapterId, api);
            foreach (var edit in exercise.Edits) Edits.Apply(solved, edit);
            return solved;
        }
        var project = GpCourse.StartProject(chapterId, api);
        foreach (var task in steps.Take(taskIndex + 1))
            foreach (var edit in task.Edits) Edits.Apply(project, edit);
        return project;
    }

    /// <summary>The scene of the task's solution (null when it does not build).</summary>
    public static Gpu.Scene.Scene? Scene(string chapterId, string api, int taskIndex) =>
        Scenes.GetOrAdd($"{api}/{chapterId}/{taskIndex}", _ => new Lazy<Gpu.Scene.Scene?>(() =>
        {
            var result = Simulator.Build(Project(chapterId, api, taskIndex), api);
            return result.Succeeded ? result.Scene : null;
        })).Value;
}
