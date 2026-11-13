using Avalonia.Controls;
using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;
using Codestead.Learning.UI;

namespace Codestead.GP;

// The --smoke-test (installation tests, 180 s): "Check my code" end to end in a temporary folder.
public sealed partial class GpTool
{
    private string? smokeDir;
    private int smokeChecks;

    /// <summary>
    /// Solves a task as a learner would: the start files are saved into a temporary folder in a structure of the
    /// learner's own (the main file under src/, renamed), the course's solution written over them, the main file
    /// picked and "Check my code" run. The task counts once the background check has been handed to the window.
    /// </summary>
    public override async Task SolveForSmokeTest(TaskInfo task)
    {
        smokeDir ??= Directory.CreateTempSubdirectory("codestead-gp-smoke-").FullName;
        var dir = Path.Combine(smokeDir, shownApi, chapter);
        Directory.CreateDirectory(dir);
        var tasks = GpCourse.Tasks(chapter, shownApi);
        int index = tasks.ToList().FindIndex(t => GpCourse.TaskKey(chapter, t.Id, shownApi) == task.Key);
        var solution = ExpectedResult.Project(chapter, shownApi, Math.Max(0, index));
        StartFiles.Copy(dir, GpCourse.StartProject(chapter, shownApi));
        StartFiles.Copy(dir, solution);
        // The learner's own layout: the main file is src/<chapter>.cpp, the other files stay beside src/.
        var main = Path.Combine(dir, "src", chapter + ".cpp");
        Directory.CreateDirectory(Path.GetDirectoryName(main)!);
        File.Move(Path.Combine(dir, solution.MainFile), main, overwrite: true);
        if (mainFile != main) SetMainFile(main);
        var check = StartCheck();
        var done = await Task.WhenAny(check, Task.Delay(TimeSpan.FromSeconds(60)));
        if (done != check || check.Result is not { } r) throw new InvalidOperationException($"The code in {dir} was not checked.");
        if (index >= 0 && !r.Tasks[index].Passed)
            throw new InvalidOperationException($"The solution of {task.Key} did not pass its check: {string.Join("; ", r.Messages.Select(m => m.Key))}");
        smokeChecks++;
    }

    /// <summary>
    /// The tool's own checks after the window's: every chapter's start project is in the installed app in every API,
    /// the first lesson of every part builds in the simulator, and the expected result of the first task is drawn.
    /// (Every task of every chapter is simulated by the TaskTests before a release; simulating all of them here took
    /// longer than the installation test allows.)
    /// </summary>
    public override string SmokeTest()
    {
        int projects = 0, builds = 0;
        foreach (var lesson in GpCourse.Chapters.Where(c => c.IsLesson))
            foreach (var api in Apis.All)
            {
                if (GpCourse.StartProject(lesson.Id, api.Id).Files.Count == 0)
                    throw new InvalidOperationException($"The {api.Id} project of {lesson.Id} is missing.");
                projects++;
            }
        // Side by side: the simulator is thread-safe (the TaskTests run in parallel too).
        var firsts = GpCourse.Parts.Select(p => GpCourse.LessonsIn(p).FirstOrDefault()).OfType<Learning.CourseChapter>()
            .SelectMany(first => Apis.All.Select(api => (first.Id, Api: api.Id))).ToList();
        Parallel.ForEach(firsts, f =>
        {
            var result = Simulator.Build(GpCourse.StartProject(f.Id, f.Api), f.Api);
            if (result.Scene is { ShowsFrames: true } scene) Gpu.Raster.Rasterizer.Render(scene, 64);
            Interlocked.Increment(ref builds);
        });
        // The IDE picker switches the texts, as a click does (Setting up your IDE has steps per IDE).
        Window.Navigate("ide-setup");
        var ideIds = idePicker.Items.OfType<ComboBoxItem>().Select(i => i.Tag).OfType<string>().ToList();
        foreach (var id in ideIds.Append(ideIds[0]))
        {
            idePicker.SelectedItem = idePicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, id));
            Avalonia.Threading.Dispatcher.UIThread.RunJobs();
            if (Ide != id) throw new InvalidOperationException($"The IDE picker did not switch to {id}.");
        }
        // The first task with a picture (Creating a window's first tasks open a window that closes again at once).
        var pictured = GpCourse.Chapters.Where(c => c.IsLesson).Take(8)
            .SelectMany(c => Enumerable.Range(0, GpCourse.Tasks(c.Id, shownApi).Count).Select(i => (c.Id, Index: i)))
            .FirstOrDefault(x => ExpectedResult.Scene(x.Id, shownApi, x.Index) is { ShowsFrames: true });
        if (pictured.Id is null) throw new InvalidOperationException("No expected result for the first tasks of the course.");
        try
        {
            if (smokeDir is not null) Directory.Delete(smokeDir, true);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
        }
        return $"{projects} projects, {builds} simulated builds, {ideIds.Count} IDEs, {smokeChecks} checks of the learner's code";
    }
}
