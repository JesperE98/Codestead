using Codestead.GP.Course.Checks;
using Codestead.GP.Course.Game;
using Codestead.GP.Gpu;
using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// Checks the learner's code with the course's own task checks: the folder is read into a project, the simulated
/// GPU builds and runs it once, and every task's check of the chapter looks at the result in order – as the
/// TaskTests do with the course's solutions. Runs on a background thread; it can be cancelled between tasks.
/// </summary>
public static class ProjectChecker
{
    public static CheckReport Check(string folder, string chapterId, string api, string fingerprint, CancellationToken cancel = default)
    {
        var read = ProjectReader.Read(folder, chapterId, api);
        cancel.ThrowIfCancellationRequested();
        return Check(read, chapterId, api, fingerprint, cancel);
    }

    public static CheckReport Check(ProjectRead read, string chapterId, string api, string fingerprint, CancellationToken cancel = default)
    {
        var messages = new List<CheckMessage>();
        if (read.Missing.Count > 0)
            messages.Add(new CheckMessage("ide.missing", new Dictionary<string, string> { ["files"] = string.Join(", ", read.Missing) }, true));
        var tasks = GpCourse.Tasks(chapterId, api);
        if (read.Project.Files.Count == 0)
            return new CheckReport(chapterId, api, fingerprint, tasks.Select(t => new TaskResult(t.Id, GpCourse.TaskKey(chapterId, t.Id, api), false)).ToList(), messages, null);
        var context = new CheckContext(api, read.Project, Simulator.Build(read.Project, api));
        cancel.ThrowIfCancellationRequested();
        if (context.Build.Diagnostics.FirstOrDefault(d => d.IsError) is { } error)
            messages.Add(new CheckMessage("ide.buildFailed", new Dictionary<string, string> { ["file"] = error.File, ["line"] = error.Line.ToString(System.Globalization.CultureInfo.InvariantCulture), ["message"] = error.Message }, true));
        foreach (var note in context.Scene?.Notes.Where(n => n.Level != NoteLevel.Info) ?? [])
            messages.Add(new CheckMessage("sim." + note.Key, note.Args, note.Level == NoteLevel.Error));
        var results = new List<TaskResult>();
        foreach (var task in tasks)
        {
            cancel.ThrowIfCancellationRequested();
            bool passed = TaskChecks.For(chapterId, task.Id) is { } check && Safe(check, context);
            results.Add(new TaskResult(task.Id, GpCourse.TaskKey(chapterId, task.Id, api), passed));
        }
        cancel.ThrowIfCancellationRequested();
        BuildFacts? facts = null;
        try
        {
            facts = BuildFacts.From(context);
        }
        catch (Exception e) when (e is not OutOfMemoryException and not OperationCanceledException)
        {
            // The facts are for the statistics; the checks above count.
        }
        return new CheckReport(chapterId, api, fingerprint, results, messages, facts);
    }

    private static bool Safe(TaskCheck check, CheckContext c)
    {
        try
        {
            return check(c);
        }
        catch (Exception e) when (e is not OutOfMemoryException)
        {
            return false;
        }
    }
}
