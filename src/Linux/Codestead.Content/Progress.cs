using Codestead.Shell.Commands;

namespace Codestead.Content;

// Port of src/content/progress.ts – evaluates tasks after each command and keeps track of progress.
// TS: Completed = Record<string, true> → OrderedDictionary<string, bool> (a key counts when its value is true).

public static partial class ProgressLib
{
    private static bool IsDone(OrderedDictionary<string, bool> completed, string key) =>
        completed.TryGetValue(key, out var v) && v;

    /// <summary>Returns the keys of the tasks in the chapter that were just completed.</summary>
    public static List<string> EvaluateTasks(Chapter chapter, Shell.Shell sh, ExecResult result, OrderedDictionary<string, bool> completed)
    {
        if (result.Pending || result.Incomplete) return new();
        var distro = sh.Distro;
        var ctx = new CheckContext
        {
            Sh = sh,
            Distro = distro,
            Line = result.Line.Trim(),
            Output = UtilCmd.StripAnsi(result.Output),
            ExitCode = result.ExitCode,
        };
        var done = new List<string>();
        foreach (var task in chapter.Tasks)
        {
            var key = ChaptersLib.TaskKey(chapter.Id, task.Id, task.PerFamily, distro.Family);
            if (IsDone(completed, key)) continue;
            try
            {
                if (task.Check(ctx)) done.Add(key);
            }
            catch
            {
                // A check that crashes counts as "not done".
            }
        }
        return done;
    }

    public static (int Done, int Total) ChapterProgress(Chapter chapter, OrderedDictionary<string, bool> completed, Distro distro)
    {
        var total = chapter.Tasks.Count;
        var done = chapter.Tasks.Count(t => IsDone(completed, ChaptersLib.TaskKey(chapter.Id, t.Id, t.PerFamily, distro.Family)));
        return (done, total);
    }

    public static (int Done, int Total) TotalProgress(OrderedDictionary<string, bool> completed, Distro distro)
    {
        int done = 0, total = 0;
        foreach (var ch in ChaptersLib.Chapters)
        {
            var p = ChapterProgress(ch, completed, distro);
            done += p.Done;
            total += p.Total;
        }
        return (done, total);
    }
}
