using Codestead.GP.Course;
using Codestead.GP.Course.Checks;
using Codestead.GP.Gpu;

namespace Codestead.GP.Tests;

/// <summary>
/// Every task of every chapter in every API: starting from the chapter's project and applying the tasks' solutions
/// in order, each task is solved by its own solution – and not before. The end result is the chapter's solution/.
/// </summary>
public class TaskTests
{
    public static TheoryData<string, string> ChaptersAndApis()
    {
        var data = new TheoryData<string, string>();
        foreach (var api in Apis.All)
            foreach (var chapter in GpCourse.Chapters.Where(c => c.IsLesson))
                if (Directory.Exists(Path.Combine(Repo.Content, "projects", api.Id, chapter.Id))) data.Add(api.Id, chapter.Id);
        return data;
    }

    private static string Report(CheckContext c) =>
        string.Join("\n", c.Build.Diagnostics) + "\n" + string.Join("\n", c.Scene?.Notes.Select(n => $"note {n.Key} {string.Join(", ", n.Args.Select(a => a.Key + "=" + a.Value))}") ?? [])
        + (c.Frame is { } f ? $"\nframe errors: {string.Join("; ", f.Errors)}\ncentre: {string.Join(",", f.AtRelative(0.5, 0.55).Select(v => Math.Round(v, 2)))}" : "\n(no frame)");

    [Theory(DisplayName = "varje uppgift löses av sin lösning, och inte före")]
    [MemberData(nameof(ChaptersAndApis))]
    public void EachTaskIsSolvedByItsSolution(string api, string chapter)
    {
        var project = GpCourse.StartProject(chapter, api);
        var tasks = GpCourse.Tasks(chapter, api);
        var start = new CheckContext(api, project.Clone(), Simulator.Build(project, api));
        Assert.True(start.Built, $"{api}/{chapter}: the start project does not build:\n{Report(start)}");
        foreach (var task in tasks)
        {
            var check = TaskChecks.For(chapter, task.Id);
            Assert.True(check is not null, $"{api}/{chapter}: no check for task '{task.Id}'");
            if (task.Edits.Count > 0)
            {
                var before = new CheckContext(api, project.Clone(), Simulator.Build(project, api));
                Assert.False(check!(before), $"{api}/{chapter}/{task.Id}: already solved before its solution is applied");
            }
            foreach (var edit in task.Edits)
                Assert.True(Edits.Apply(project, edit) is not null, $"{api}/{chapter}/{task.Id}: the edit's 'find' text is not in {edit.File}:\n{edit.Find}");
            var after = new CheckContext(api, project.Clone(), Simulator.Build(project, api));
            Assert.True(check!(after), $"{api}/{chapter}/{task.Id}: not solved by its solution\n{Report(after)}");
        }
        // The end result is the chapter's solution/.
        var solutionDir = Path.Combine(Repo.Content, "projects", api, chapter, "solution");
        foreach (var file in Directory.GetFiles(solutionDir, "*", SearchOption.AllDirectories))
        {
            var name = Path.GetRelativePath(solutionDir, file).Replace('\\', '/');
            if (GpCourse.IsAsset(name))
            {
                Assert.True(project.Assets.TryGetValue(name, out var bytes) && bytes.SequenceEqual(File.ReadAllBytes(file)), $"{api}/{chapter}: the image {name} differs from start/");
                continue;
            }
            Assert.True(project.Files.TryGetValue(name, out var text), $"{api}/{chapter}: {name} is missing");
            Assert.Equal(File.ReadAllText(file).Replace("\r\n", "\n"), text);
        }
    }

    [Theory(DisplayName = "lösningen bygger och körs utan anmärkningar")]
    [MemberData(nameof(ChaptersAndApis))]
    public void SolutionRunsCleanly(string api, string chapter)
    {
        var project = GpCourse.StartProject(chapter, api);
        foreach (var edit in GpCourse.Tasks(chapter, api).SelectMany(t => t.Edits)) Edits.Apply(project, edit);
        var c = new CheckContext(api, project, Simulator.Build(project, api));
        Assert.True(c.Built, Report(c));
        // Before Hello Window there is no render loop yet: the window closing at once is expected there.
        var bad = c.Scene!.Notes.Where(n => n.Level != Gpu.Scene.NoteLevel.Info && !(chapter == "creating-a-window" && n.Key == "noLoop")).ToList();
        Assert.True(bad.Count == 0, $"{api}/{chapter}:\n{Report(c)}");
        if (c.Frame is { } f) Assert.True(f.Errors.Count == 0, string.Join("\n", f.Errors));
    }
}
