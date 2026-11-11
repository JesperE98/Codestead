using System.Text.Json;
using Avalonia.Controls;
using Codestead.GP.Course;
using Codestead.GP.Course.Checks;
using Codestead.GP.Course.Game;
using Codestead.GP.Gpu;
using Codestead.GP.Workbench;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Learning.UI;
using Codestead.UI.Controls;

namespace Codestead.GP;

// The workbench: the chapter's project for the chosen API in an editor, "Build & run" with the simulated GPU, and
// the tasks checked after every build. Each (API, chapter) has its own project, saved between runs.
public sealed partial class GpTool
{
    private readonly ProjectView view = new();
    private GpuProject project = new();
    private string projectKey = "";
    private string projectChapter = "";
    private CheckContext? last;

    public GpTool()
    {
        view.BuildRequested += Build;
        view.ResetRequested += ConfirmReset;
        view.Edited += () => SaveProject();
        view.EnlargeRequested += panel => Window.Overlay.ShowDialog(panel, () => { }, 700);
    }

    public override Control Workbench => view;

    /// <summary>The text of the solution button of a task that needs no code: pressing it builds.</summary>
    private string BuildCommand => "▶ " + Window.T("project.build");

    /// <summary>Puts a solution into the code: applies the task's edit if the old code is there, else inserts at the cursor.</summary>
    public override void Inject(string command)
    {
        if (command == BuildCommand)
        {
            Build();
            return;
        }
        view.CommitEdits(project);
        var edit = GpCourse.Tasks(projectChapter, Api).SelectMany(t => t.Edits).FirstOrDefault(e => e.Replace == command);
        if (edit is not null)
        {
            switch (Edits.StateOf(project, edit))
            {
                case EditState.Done:
                    view.Show(project, edit.File, Edits.Normalize(edit.Replace));
                    return;
                case EditState.Applicable:
                    var at = Edits.Apply(project, edit)!.Value;
                    view.Show(project, edit.File, null, at);
                    SaveProject();
                    return;
            }
        }
        view.InsertAtCaret(command);
        view.CommitEdits(project);
        SaveProject();
    }

    public override void FocusWorkbench() => view.FocusEditor();

    /// <summary>The smoke test "types" a solution and runs it: the edit was applied by Inject, so build.</summary>
    public override void Run(string command) => Build();

    private void Build()
    {
        view.CommitEdits(project);
        SaveProject();
        var result = Simulator.Build(project, Api);
        last = new CheckContext(Api, project.Clone(), result);
        view.ShowResult(result, Window.T, Window.Lang);
        var output = string.Join("\n", result.Diagnostics.Select(d => d.ToString()));
        analyzed = BuildFacts.From(last);
        OnRan(new SandboxRun("build", output, result.Succeeded ? 0 : 1, true));
    }

    private BuildFacts? analyzed;

    public override IReadOnlyList<string> Evaluate(string chapterId, SandboxRun run, OrderedDictionary<string, bool> completed)
    {
        if (last is null || chapterId != projectChapter) return [];
        var newly = new List<string>();
        foreach (var task in GpCourse.Tasks(chapterId, Api))
        {
            var key = GpCourse.TaskKey(chapterId, task.Id, Api);
            if (completed.ContainsKey(key)) continue;
            if (TaskChecks.For(chapterId, task.Id) is { } check && SafeCheck(check, last)) newly.Add(key);
        }
        return newly;
    }

    private static bool SafeCheck(TaskCheck check, CheckContext c)
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

    public override CommandFacts? Analyze(SandboxRun run) => analyzed;

    public override ISandbox Sandbox(string chapterId) => new NoSandbox();

    // ---------- Events from the window ----------

    /// <summary>Opens the chapter's project for the chosen API (summaries and exams keep the last one).</summary>
    public override void ChapterShown(string chapterId)
    {
        if (!GpCourse.Chapter(chapterId).IsLesson) return;
        var key = $"project.{Api}.{chapterId}";
        if (key == projectKey) return;
        if (projectKey != "")
        {
            view.CommitEdits(project);
            SaveProject();
        }
        projectKey = key;
        projectChapter = chapterId;
        var start = GpCourse.StartProject(chapterId, Api);
        project = Load(key) ?? start;
        // Saved projects keep only the code: the images come from the chapter.
        foreach (var (name, bytes) in start.Assets) project.Assets[name] = bytes;
        last = null;
        view.Open(project, Apis.Get(Api));
    }

    public override void TextsApplied() => view.ApplyTexts(Window.T);

    public override void Rendered() => view.ApplyTexts(Window.T);

    public override void Save()
    {
        view.CommitEdits(project);
        SaveProject();
    }

    public override IEnumerable<ResetAction> Resets() =>
    [
        new ResetAction(Window.T("reset.project.title"), Window.T("reset.project.desc", ("api", Apis.Get(Api).Name)), Window.T("reset.project.button"), ConfirmReset),
    ];

    private GpuProject? Load(string key)
    {
        try
        {
            var json = Window.Storage.LoadText(key);
            if (json is null) return null;
            var files = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            return files is { Count: > 0 } ? new GpuProject(files) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private void SaveProject()
    {
        if (projectKey == "") return;
        Window.Storage.SaveText(projectKey, JsonSerializer.Serialize(project.Files.ToDictionary(kv => kv.Key, kv => kv.Value)));
    }

    private void ConfirmReset()
    {
        Window.Overlay.Confirm(Window.T("reset.project.title"), Window.T("reset.project.confirm"), Window.T("reset.project.button"), Window.T("dialog.cancel"), true, () =>
        {
            Window.Storage.Remove(projectKey);
            project = GpCourse.StartProject(projectChapter, Api);
            last = null;
            view.Open(project, Apis.Get(Api));
            Window.Refresh();
            Window.Toast(Window.T("toast.projectReset"));
        });
    }

    /// <summary>
    /// The smoke test: every chapter's starting project is in the installed app in every API, and the first lesson of
    /// every part builds and runs in the simulator. (Every task of every chapter is simulated by the TaskTests before a
    /// release; simulating all of them here took longer than the installation test allows.)
    /// </summary>
    public override string SmokeTest()
    {
        int projects = 0, builds = 0;
        foreach (var chapter in GpCourse.Chapters.Where(c => c.IsLesson))
            foreach (var api in Apis.All)
            {
                if (GpCourse.StartProject(chapter.Id, api.Id).Files.Count == 0)
                    throw new InvalidOperationException($"The {api.Id} project of {chapter.Id} is missing.");
                projects++;
            }
        foreach (var part in GpCourse.Parts)
        {
            if (GpCourse.LessonsIn(part).FirstOrDefault() is not { } first) continue;
            foreach (var api in Apis.All)
            {
                var result = Simulator.Build(GpCourse.StartProject(first.Id, api.Id), api.Id);
                if (result.Scene is { ShowsFrames: true } scene) Gpu.Raster.Rasterizer.Render(scene, 64);
                builds++;
            }
        }
        return $"{projects} projects, {builds} simulated builds";
    }
}
