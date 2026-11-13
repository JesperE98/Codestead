using System.Text.RegularExpressions;
using Avalonia.Controls;
using Avalonia.Input.Platform;
using Avalonia.Threading;
using Codestead.GP.Course;
using Codestead.GP.Course.Game;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;
using Codestead.GP.YourProject;
using Codestead.Learning.Game;
using Codestead.UI.Controls;

namespace Codestead.GP;

// "Your project": the learner writes, builds and runs the chapter's program in their own IDE, organised as they like.
// A task is ticked by hand ("Mark as done"), or by "Check my code": the chapter's main file, which the learner picks,
// and the files around it are checked in the background with the course's task checks (ProjectChecker), and the
// result goes to the window as a finished "build" – the window ticks the tasks, counts XP and achievements as it
// always has.
public sealed partial class GpTool
{
    /// <summary>The window's "command line" for a task ticked by hand (no check, no statistics).</summary>
    private const string MarkDoneLine = "mark-done";

    private readonly ProjectPanel panel = new();
    private MainFiles? mainFiles;
    private string chapter = "";
    private string shownApi = "";
    private string? mainFile;
    private CheckReport? report;
    private DateTime checkedAt;
    private CancellationTokenSource? checkCancel;
    private bool checking;
    private int generation;
    private int selectedTask = -1;
    private string? markedDone;

    /// <summary>Raised on the UI thread after a check has been handed to the window (the smoke test waits for it).</summary>
    internal event Action<CheckReport>? Checked;

    public GpTool()
    {
        InitIdePicker();
        panel.CheckRequested += () => _ = CheckMyCode(false);
        panel.ChangeFileRequested += () => _ = CheckMyCode(true);
        panel.SaveRequested += () => _ = SaveFiles(GpCourse.StartProject(chapter, shownApi));
        panel.SaveOldRequested += SaveOldCode;
        panel.MarkDoneRequested += MarkDone;
        panel.TaskSelected += i =>
        {
            selectedTask = i;
            RenderPanel();
        };
        panel.Picture.EnlargeRequested += c => Window.Overlay.ShowDialog(c, () => { }, ExpectedPicture.Large + 48);
    }

    public override Control Workbench => panel;

    private MainFiles MainFiles => mainFiles ??= new MainFiles(Window.Storage);

    /// <summary>The solution of a task that needs no code: build and run it in the IDE.</summary>
    private string BuildRunSolution => "▶ " + Window.T("yourProject.buildRunSolution");

    /// <summary>A solution or a code block was clicked: the code goes to the clipboard, to paste in the IDE.</summary>
    public override void Inject(string command)
    {
        if (command == BuildRunSolution)
        {
            Window.Toast(Window.T("yourProject.buildRunToast"));
            return;
        }
        _ = CopyToClipboard(command);
    }

    private async Task CopyToClipboard(string text)
    {
        try
        {
            if (TopLevel.GetTopLevel(Window)?.Clipboard is { } clipboard)
            {
                await clipboard.SetTextAsync(text);
                Window.Toast(Window.T("yourProject.copiedCode"));
            }
        }
        catch (Exception e) when (e is not OutOfMemoryException)
        {
            // No clipboard (a headless session): nothing to do.
        }
    }

    public override void FocusWorkbench() { }

    /// <summary>Nothing runs inside the app: the learner runs the program in the IDE.</summary>
    public override void Run(string command) { }

    // ---------- Following the chapter ----------

    /// <summary>Shows the chapter's main file for the chosen API (summaries and exams keep the last one).</summary>
    public override void ChapterShown(string chapterId)
    {
        if (!GpCourse.Chapter(chapterId).IsLesson) return;
        if (chapterId == chapter && Api == shownApi) return;
        chapter = chapterId;
        shownApi = Api;
        selectedTask = -1;
        UseFile(MainFiles.Get(shownApi, chapter, GpCourse.StartProject(chapter, shownApi).MainFile));
    }

    private void UseFile(string? path)
    {
        generation++;
        checkCancel?.Cancel();
        checking = false;
        report = null;
        mainFile = path;
        RenderPanel();
    }

    /// <summary>The chapter's main file (also used by the smoke test).</summary>
    internal void SetMainFile(string path)
    {
        MainFiles.Set(shownApi, chapter, path);
        UseFile(MainFiles.Get(shownApi, chapter, GpCourse.StartProject(chapter, shownApi).MainFile));
        Window.RefreshGame();
    }

    /// <summary>Checks the code around the main file in the background; the result is handed to the window.</summary>
    internal Task<CheckReport?> StartCheck()
    {
        var finished = new TaskCompletionSource<CheckReport?>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (mainFile is null)
        {
            finished.SetResult(null);
            return finished.Task;
        }
        checkCancel?.Cancel();
        var cancel = checkCancel = new CancellationTokenSource();
        checking = true;
        int gen = generation;
        string f = mainFile, c = chapter, api = shownApi;
        RenderPanel();
        Task.Run(() => ProjectChecker.Check(f, c, api, cancel.Token), cancel.Token).ContinueWith(done =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                if (gen != generation || cancel.IsCancellationRequested || done.Status != System.Threading.Tasks.TaskStatus.RanToCompletion)
                {
                    finished.TrySetResult(null);
                    return;
                }
                checking = false;
                report = done.Result;
                checkedAt = DateTime.Now;
                Hand(report);
                RenderPanel();
                Checked?.Invoke(report);
                finished.TrySetResult(report);
            });
        }, TaskScheduler.Default);
        return finished.Task;
    }

    /// <summary>Hands a check to the window as a finished build: it ticks the passing tasks (if they are unlocked).</summary>
    private void Hand(CheckReport r)
    {
        var errors = r.Messages.Where(m => m.IsError).Select(m => Window.T(m.Key, Args(m))).ToList();
        OnRan(new SandboxRun("build", string.Join("\n", errors), errors.Count == 0 ? 0 : 1, true));
    }

    /// <summary>"Mark as done": the learner says the task is solved; the window ticks it like a solved one.</summary>
    private void MarkDone(int index)
    {
        var tasks = GpCourse.Tasks(chapter, shownApi);
        if (index < 0 || index >= tasks.Count || !Window.IsChapterUnlocked(chapter)) return;
        markedDone = GpCourse.TaskKey(chapter, tasks[index].Id, shownApi);
        try
        {
            OnRan(new SandboxRun(MarkDoneLine, "", 0, true));
        }
        finally
        {
            markedDone = null;
        }
        RenderPanel();
    }

    /// <summary>A check made while the tasks were locked counts once they are unlocked.</summary>
    public override void TasksUnlocked(string chapterId)
    {
        if (chapterId == chapter && report is { } r && r.ChapterId == chapter && r.Api == Api) Hand(r);
        RenderPanel();
    }

    public override IReadOnlyList<string> Evaluate(string chapterId, SandboxRun run, OrderedDictionary<string, bool> completed)
    {
        if (run.Line == MarkDoneLine) return markedDone is { } key && !completed.ContainsKey(key) ? [key] : [];
        if (report is not { } r || r.ChapterId != chapterId || r.Api != Api) return [];
        return r.PassedKeys.Where(k => !completed.ContainsKey(k)).ToList();
    }

    /// <summary>A check counts for the statistics and achievements; a task ticked by hand does not.</summary>
    public override CommandFacts? Analyze(SandboxRun run) => run.Line == MarkDoneLine ? null : report?.Facts;

    public override ISandbox Sandbox(string chapterId) => new NoSandbox();

    public override void Rendered() => RenderPanel();

    /// <summary>The tasks live in the "Your project" panel, each with its state under it.</summary>
    public override bool HostsTasks => true;

    public override Avalonia.Controls.Control? TaskStatus(Codestead.Learning.UI.TaskInfo task, int index)
    {
        var rows = Rows();
        if (index < 0 || index >= rows.Count) return null;
        return panel.StatusLine(rows[index], index == Selected(rows), Window.T);
    }

    // ---------- The panel ----------

    private static (string, object)[] Args(CheckMessage m) => m.Args.Select(a => (a.Key, (object)a.Value)).ToArray();

    private void RenderPanel()
    {
        if (chapter == "" || Window is null) return;
        var rows = Rows();
        bool unlocked = Window.IsChapterUnlocked(chapter);
        int selected = Selected(rows);
        // Until the text is done the tasks are locked: say what unlocks them (the panel has no "read first" card above it).
        var questions = Window.CheckpointProgress(chapter);
        string? lockNote = unlocked || rows.Count == 0 ? null
            : questions.Total > 0 ? Window.T("yourProject.lockedQuestions", ("done", questions.Done), ("total", questions.Total))
            : Window.T("yourProject.lockedRead");
        string? summary = null;
        var messages = new List<string>();
        bool allPassed = false;
        if (report is { } r && r.ChapterId == chapter && r.Api == shownApi)
        {
            summary = Window.T("yourProject.checked", ("time", checkedAt.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture)),
                ("passed", r.Tasks.Count(x => x.Passed)), ("total", r.Tasks.Count));
            messages.AddRange(r.Messages.Select(m => Window.T(m.Key, Args(m))).Take(3));
            allPassed = r.Tasks.Count > 0 && r.Tasks.All(x => x.Passed);
        }
        var model = new PanelModel(chapter, shownApi, Apis.Get(shownApi).FullName, mainFile, mainFile is not null && !File.Exists(mainFile),
            HasOldCode(), checking, summary, messages, allPassed, rows, selected, lockNote, questions);
        // The window's task list (text, hints, solutions) sits in the panel once the tasks are unlocked; each task's
        // state comes from TaskStatus, so the list is refreshed with the panel.
        if (unlocked && rows.Count > 0)
        {
            Window.TaskList.Margin = new Avalonia.Thickness(0);
            Window.RefreshTasks();
            panel.HostedTasks = Window.TaskList;
        }
        else panel.HostedTasks = null;
        panel.Render(model, Window.T);
        if (rows.Count > 0) panel.Picture.Show(chapter, shownApi, selected, Window.T);
    }

    /// <summary>The task whose expected result the panel shows: the one clicked, else the first not done.</summary>
    private int Selected(List<TaskRow> rows) => selectedTask >= 0 && selectedTask < rows.Count ? selectedTask
        : rows.FindIndex(r => r.State != TaskState.Done) is var first && first >= 0 ? first : Math.Max(0, rows.Count - 1);

    /// <summary>Every task's state: done, locked, being checked, not passed by the last check, or open.</summary>
    private List<TaskRow> Rows()
    {
        var tasks = GpCourse.Tasks(chapter, shownApi);
        bool unlocked = Window.IsChapterUnlocked(chapter);
        var current = report is { } r0 && r0.ChapterId == chapter && r0.Api == shownApi ? r0 : null;
        var rows = new List<TaskRow>();
        for (int i = 0; i < tasks.Count; i++)
        {
            var key = GpCourse.TaskKey(chapter, tasks[i].Id, shownApi);
            var result = current?.Tasks.FirstOrDefault(x => x.Key == key);
            var messages = new List<string>();
            TaskState state;
            if (Window.IsTaskDone(key)) state = TaskState.Done;
            else if (!unlocked) state = TaskState.Locked;
            else if (checking) state = TaskState.Checking;
            else if (result is { Passed: false })
            {
                state = TaskState.NotYet;
                messages.Add(Window.T("yourProject.notYetHelp"));
            }
            else state = TaskState.Open;
            rows.Add(new TaskRow(i, Title(CourseText.TaskText(chapter, tasks[i].Id, Window.Lang, shownApi)), state, messages));
        }
        return rows;
    }

    /// <summary>A task's text as a short plain title: the first sentence, without markdown.</summary>
    private static string Title(string markdown)
    {
        var plain = Regex.Replace(markdown, @"\[([^\]]*)\]\([^)]*\)", "$1").Replace("**", "").Replace("`", "").Replace("\n", " ");
        var end = Regex.Match(plain, @"[.:](?:\s|$)|[。：]");
        if (end.Success && end.Index > 0) plain = plain[..end.Index];
        return plain.Length > 90 ? plain[..87].TrimEnd() + "…" : plain.Trim();
    }
}
