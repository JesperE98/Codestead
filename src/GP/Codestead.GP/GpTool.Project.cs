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

// "Your project": the learner writes, builds and runs the chapter's program in their own IDE. The app watches the
// folder (ProjectWatcher); once the program was built after the last change and run after that build, the code is
// checked in the background with the course's task checks (ProjectChecker), and the result goes to the window as a
// finished "build" – the window ticks the tasks, counts XP and achievements as it always has.
public sealed partial class GpTool
{
    private readonly ProjectPanel panel = new();
    private ProjectFolders? folders;
    private ProjectWatcher? watcher;
    private string chapter = "";
    private string watchedApi = "";
    private string? folder;
    private WatchStatus status = WatchStatus.None;
    private CheckReport? report;
    private CancellationTokenSource? checkCancel;
    private string checkingFingerprint = "";
    private int generation;
    private int selectedTask = -1;

    /// <summary>Raised on the UI thread after a check has been handed to the window (the smoke test waits for it).</summary>
    internal event Action<CheckReport>? Checked;

    public GpTool()
    {
        InitIdePicker();
        GpAchievements.ProjectFolderChosen = () => Window is not null && Folders.Any;
        panel.ChooseRequested += () => _ = ChooseFolder();
        panel.UseSuggestionRequested += UseSuggestion;
        panel.CopyRequested += () => CopyStartFiles(GpCourse.StartProject(chapter, watchedApi));
        panel.CopyOldRequested += CopyOldCode;
        panel.OpenRequested += () => _ = OpenFolder();
        panel.RanRequested += RanByHand;
        panel.TaskSelected += i =>
        {
            selectedTask = i;
            RenderPanel();
        };
        panel.Picture.EnlargeRequested += c => Window.Overlay.ShowDialog(c, () => { }, ExpectedPicture.Large + 48);
    }

    public override Control Workbench => panel;

    private ProjectFolders Folders => folders ??= new ProjectFolders(Window.Storage);

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

    public override void FocusWorkbench() => watcher?.Refresh();

    /// <summary>Nothing runs inside the app any more: the learner runs the program in the IDE.</summary>
    public override void Run(string command) { }

    // ---------- Following the chapter ----------

    /// <summary>Watches the chapter's folder for the chosen API (summaries and exams keep the last one).</summary>
    public override void ChapterShown(string chapterId)
    {
        if (!GpCourse.Chapter(chapterId).IsLesson) return;
        if (chapterId == chapter && Api == watchedApi) return;
        chapter = chapterId;
        watchedApi = Api;
        selectedTask = -1;
        Watch(Folders.Get(watchedApi, chapter));
    }

    private void Watch(string? path)
    {
        generation++;
        watcher?.Dispose();
        watcher = null;
        checkCancel?.Cancel();
        checkingFingerprint = "";
        report = null;
        status = WatchStatus.None;
        folder = path;
        if (path is not null && Directory.Exists(path))
        {
            int gen = generation;
            var w = new ProjectWatcher(path);
            w.Changed += s => Dispatcher.UIThread.Post(() =>
            {
                if (gen == generation) StatusChanged(s);
            });
            watcher = w;
        }
        RenderPanel();
    }

    private void StatusChanged(WatchStatus s)
    {
        status = s;
        // New changes while a check runs: that check is about old code.
        if (checkingFingerprint != "" && checkingFingerprint != s.Fingerprint)
        {
            checkCancel?.Cancel();
            checkingFingerprint = "";
        }
        if (s.Ready && checkingFingerprint == "" && report?.Fingerprint != s.Fingerprint) StartCheck(s.Fingerprint);
        RenderPanel();
    }

    private void StartCheck(string fingerprint)
    {
        if (folder is null) return;
        checkCancel?.Cancel();
        var cancel = checkCancel = new CancellationTokenSource();
        checkingFingerprint = fingerprint;
        int gen = generation;
        string f = folder, c = chapter, api = watchedApi;
        Task.Run(() => ProjectChecker.Check(f, c, api, fingerprint, cancel.Token), cancel.Token).ContinueWith(done =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                if (gen != generation || cancel.IsCancellationRequested || done.Status != System.Threading.Tasks.TaskStatus.RanToCompletion) return;
                checkingFingerprint = "";
                report = done.Result;
                Hand(report);
                RenderPanel();
                Checked?.Invoke(report);
            });
        }, TaskScheduler.Default);
    }

    /// <summary>Hands a check to the window as a finished build: it ticks the passing tasks (if they are unlocked).</summary>
    private void Hand(CheckReport r)
    {
        var errors = r.Messages.Where(m => m.IsError).Select(m => Window.T(m.Key, Args(m))).ToList();
        OnRan(new SandboxRun("build", string.Join("\n", errors), errors.Count == 0 ? 0 : 1, true));
    }

    /// <summary>A check made while the tasks were locked counts once they are unlocked (if the code is still the same).</summary>
    public override void TasksUnlocked(string chapterId)
    {
        if (chapterId == chapter && report is { } r && r.ChapterId == chapter && r.Api == Api && r.Fingerprint == status.Fingerprint) Hand(r);
        RenderPanel();
    }

    public override IReadOnlyList<string> Evaluate(string chapterId, SandboxRun run, OrderedDictionary<string, bool> completed)
    {
        if (report is not { } r || r.ChapterId != chapterId || r.Api != Api) return [];
        return r.PassedKeys.Where(k => !completed.ContainsKey(k)).ToList();
    }

    public override CommandFacts? Analyze(SandboxRun run) => report?.Facts;

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
        bool checking = checkingFingerprint != "";
        bool current = report is { } r0 && r0.Fingerprint == status.Fingerprint;
        int selected = Selected(rows);
        bool missing = folder is not null && !Directory.Exists(folder);
        // Until the text is done the tasks are locked: say what unlocks them (the panel has no "read first" card above it).
        var questions = Window.CheckpointProgress(chapter);
        string? lockNote = unlocked || rows.Count == 0 ? null
            : questions.Total > 0 ? Window.T("yourProject.lockedQuestions", ("done", questions.Done), ("total", questions.Total))
            : Window.T("yourProject.lockedRead");
        var model = new PanelModel(chapter, watchedApi, Apis.Get(watchedApi).FullName, folder, missing,
            folder is null ? Folders.Suggestion(watchedApi, chapter) : null, HasOldCode(), status, checking, StatusLine(checking, current), WhereProgram(checking), rows, selected,
            lockNote, questions);
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
        if (rows.Count > 0) panel.Picture.Show(chapter, watchedApi, selected, Window.T);
    }

    /// <summary>The task whose expected result the panel shows: the one clicked, else the first not done.</summary>
    private int Selected(List<TaskRow> rows) => selectedTask >= 0 && selectedTask < rows.Count ? selectedTask
        : rows.FindIndex(r => r.State != TaskState.Done) is var first && first >= 0 ? first : Math.Max(0, rows.Count - 1);

    /// <summary>Every task's state: done, locked, waiting for a folder, a build or a run, being checked, or not yet.</summary>
    private List<TaskRow> Rows()
    {
        var tasks = GpCourse.Tasks(chapter, watchedApi);
        bool unlocked = Window.IsChapterUnlocked(chapter);
        bool checking = checkingFingerprint != "";
        bool current = report is { } r0 && r0.Fingerprint == status.Fingerprint;
        var general = report?.Messages.Select(m => Window.T(m.Key, Args(m))).Take(3).ToList() ?? [];
        var rows = new List<TaskRow>();
        for (int i = 0; i < tasks.Count; i++)
        {
            var key = GpCourse.TaskKey(chapter, tasks[i].Id, watchedApi);
            var result = report?.Tasks.FirstOrDefault(x => x.Key == key);
            var messages = new List<string>();
            TaskState state;
            if (Window.IsTaskDone(key)) state = TaskState.Done;
            else if (!unlocked) state = TaskState.Locked;
            else if (folder is null) state = TaskState.NeedsFolder;
            else if (checking) state = TaskState.Checking;
            else if (current && result is { Passed: false })
            {
                state = TaskState.NotYet;
                messages.AddRange(general.Count > 0 ? general : [Window.T("yourProject.notYetHelp")]);
            }
            else if (!status.Built && !(status.NoExecutable && status.RanByHand)) state = TaskState.WaitingForBuild;
            else if (!status.Ran) state = TaskState.WaitingForRun;
            else state = TaskState.Checking;
            rows.Add(new TaskRow(i, Title(CourseText.TaskText(chapter, tasks[i].Id, Window.Lang, watchedApi)), state, messages));
        }
        return rows;
    }

    /// <summary>While the app waits for a build: where the chosen IDE puts the program (detection looks everywhere).</summary>
    private string? WhereProgram(bool checking) =>
        !checking && !status.Built && !(status.NoExecutable && status.RanByHand) ? Window.T("yourProject.where." + Ide) : null;

    private string StatusLine(bool checking, bool current)
    {
        if (checking) return Window.T("yourProject.stateChecking");
        if (status.NoExecutable && !status.Ran) return Window.T("yourProject.stateNoExecutable");
        if (!status.Built && !(status.NoExecutable && status.RanByHand)) return Window.T("yourProject.stateBuild");
        if (!status.Ran) return Window.T("yourProject.stateRun");
        return current ? Window.T("yourProject.stateChecked") : Window.T("yourProject.stateChecking");
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
