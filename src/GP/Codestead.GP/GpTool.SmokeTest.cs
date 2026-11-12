using System.Diagnostics;
using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;
using Codestead.Learning.UI;

namespace Codestead.GP;

// The --smoke-test (installation tests, 180 s): the "Your project" flow end to end in a temporary folder.
public sealed partial class GpTool
{
    private string? smokeDir;
    private string smokeRun = "";

    /// <summary>
    /// Solves a task as a learner would: the chapter's folder is a temporary one, the start files are copied into
    /// it and the course's solution written over them; the "build" is a real program copied into build/ (a copy of
    /// the system's sleep, or ping on Windows) and run, so the app has to see it running – or, where it cannot,
    /// "I ran it" stands in. The task counts once the background check has been handed to the window.
    /// </summary>
    public override async Task SolveForSmokeTest(TaskInfo task)
    {
        smokeDir ??= Directory.CreateTempSubdirectory("codestead-gp-smoke-").FullName;
        var dir = Path.Combine(smokeDir, watchedApi, chapter);
        Directory.CreateDirectory(dir);
        if (folder != dir) SetFolder(dir);
        // A clean build each time: an earlier program must not count for the new code.
        if (Directory.Exists(Path.Combine(dir, "build"))) Directory.Delete(Path.Combine(dir, "build"), true);
        var tasks = GpCourse.Tasks(chapter, watchedApi);
        int index = tasks.ToList().FindIndex(t => GpCourse.TaskKey(chapter, t.Id, watchedApi) == task.Key);
        StartFiles.Copy(dir, GpCourse.StartProject(chapter, watchedApi));
        StartFiles.Copy(dir, ExpectedResult.Project(chapter, watchedApi, Math.Max(0, index)));
        // The code was written a moment ago; the build comes after it.
        var written = DateTime.UtcNow.AddSeconds(-3);
        foreach (var file in Directory.GetFiles(dir, "*", SearchOption.AllDirectories).Where(ProjectFiles.IsSource)) File.SetLastWriteTimeUtc(file, written);

        var checkedTask = new TaskCompletionSource<CheckReport>(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnChecked(CheckReport r) => checkedTask.TrySetResult(r);
        Checked += OnChecked;
        Process? program = null;
        try
        {
            program = BuildAndRun(dir);
            var watch = Stopwatch.StartNew();
            if (program is null)
            {
                smokeRun = "no program to run here: \"I ran it\"";
                watcher?.MarkRan();
            }
            else
            {
                // The process must be seen; where it is not (a locked-down Windows), "I ran it" stands in, except on Linux.
                var seen = await Task.WhenAny(checkedTask.Task, Task.Delay(TimeSpan.FromSeconds(20)));
                if (seen != checkedTask.Task)
                {
                    if (OperatingSystem.IsLinux()) throw new InvalidOperationException($"The run of {program.StartInfo.FileName} was not seen ({watcher?.Status}).");
                    smokeRun = "run not seen: \"I ran it\"";
                    watcher?.MarkRan();
                }
                else smokeRun = $"run seen after {watch.Elapsed.TotalSeconds:0.0} s";
            }
            var done = await Task.WhenAny(checkedTask.Task, Task.Delay(TimeSpan.FromSeconds(60)));
            if (done != checkedTask.Task) throw new InvalidOperationException($"The project was not checked ({watcher?.Status}).");
        }
        finally
        {
            Checked -= OnChecked;
            try
            {
                if (program is { HasExited: false }) program.Kill();
            }
            catch (InvalidOperationException)
            {
            }
            program?.Dispose();
        }
    }

    /// <summary>"Builds" the program: copies a small system program into build/, newer than the code, and starts it.</summary>
    private static Process? BuildAndRun(string dir)
    {
        string? source;
        string args;
        if (OperatingSystem.IsWindows())
        {
            source = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "PING.EXE");
            args = "-n 30 127.0.0.1";
        }
        else
        {
            source = new[] { "/bin/sleep", "/usr/bin/sleep" }.FirstOrDefault(File.Exists);
            args = "30";
        }
        if (source is null || !File.Exists(source)) return null;
        var build = Path.Combine(dir, "build", OperatingSystem.IsWindows() ? "Debug" : "");
        Directory.CreateDirectory(build);
        var exe = Path.Combine(build, OperatingSystem.IsWindows() ? "smoke-program.exe" : "smoke-program");
        File.Copy(source, exe, overwrite: true);
        File.SetLastWriteTimeUtc(exe, DateTime.UtcNow);
        try
        {
            var p = Process.Start(new ProcessStartInfo(exe, args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true });
            if (p is not null)
            {
                p.OutputDataReceived += (_, _) => { };
                p.ErrorDataReceived += (_, _) => { };
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
            }
            return p;
        }
        catch (Exception e) when (e is System.ComponentModel.Win32Exception or IOException or UnauthorizedAccessException)
        {
            return null;
        }
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
        // The first task with a picture (Creating a window's first tasks open a window that closes again at once).
        var pictured = GpCourse.Chapters.Where(c => c.IsLesson).Take(8)
            .SelectMany(c => Enumerable.Range(0, GpCourse.Tasks(c.Id, watchedApi).Count).Select(i => (c.Id, Index: i)))
            .FirstOrDefault(x => ExpectedResult.Scene(x.Id, watchedApi, x.Index) is { ShowsFrames: true });
        if (pictured.Id is null) throw new InvalidOperationException("No expected result for the first tasks of the course.");
        watcher?.Dispose();
        watcher = null;
        try
        {
            if (smokeDir is not null) Directory.Delete(smokeDir, true);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
        }
        return $"{projects} projects, {builds} simulated builds, {smokeRun}";
    }
}
