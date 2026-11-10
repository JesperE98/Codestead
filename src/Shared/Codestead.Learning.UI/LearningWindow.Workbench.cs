using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Common;
using Codestead.Learning.Game;
using Codestead.UI;
using Codestead.UI.App;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using static Codestead.UI.App.UiParts;

namespace Codestead.Learning.UI;

// Moving between chapters, the tool's workbench (running commands, checking tasks), and changing variant or language.
public partial class LearningWindow
{
    /// <summary>Shows another chapter.</summary>
    public void Navigate(string id)
    {
        state.Chapter = id;
        justCompleted = new();
        SaveState();
        tool.ChapterShown(Chapter.Id);
        FillPickers();
        RenderAll();
    }

    private void OnResult(SandboxRun result)
    {
        // The "try it" questions in the text are answered in the terminal (this may unlock the tasks).
        foreach (var view in checkpointViews.ToList()) view.CommandRan(result);
        // Locked tasks are not checked: the text comes first, even though the terminal is already there.
        bool tasksOpen = Chapter.Kind == ChapterKinds.Lesson && IsUnlocked(Chapter);
        var newly = tasksOpen ? tool.Evaluate(Chapter.Id, result, state.Progress).ToList() : new List<string>();
        // Every finished command line counts as an attempt for the tasks that are not done yet.
        bool solutionUnlocked = false;
        if (tasksOpen && result.Finished && result.Line.Trim() != "")
        {
            foreach (var key in TaskKeys(Chapter))
            {
                if (state.Progress.ContainsKey(key) || newly.Contains(key)) continue;
                int n = (state.Attempts.TryGetValue(key, out var a) ? a : 0) + 1;
                if (n > AttemptsBeforeSolution) continue;
                state.Attempts[key] = n;
                if (n == AttemptsBeforeSolution) solutionUnlocked = true;
            }
        }
        foreach (var k in newly) state.Progress[k] = true;
        // The game counts every finished command line (statistics, hidden achievements) and the solved tasks.
        GameEvents? ev = null;
        if (result.Finished && result.Line.Trim() != "")
        {
            var solved = newly.Select(k => new SolvedTask(k, state.HintSeen.Contains(k) || state.Game.SolutionSeen.Contains(k))).ToList();
            ev = tool.Rules.OnCommand(state.Game, Snapshot(), tool.Analyze(result), Chapter.Id, solved, DateTime.Now);
        }
        if (newly.Count == 0)
        {
            if (solutionUnlocked || ev?.Changed == true) SaveState();
            if (solutionUnlocked) RenderTasks();
            if (ev is not null) Present(ev);
            return;
        }
        SaveState();
        justCompleted = newly;
        RenderProgress();
        RenderSidebar();
        RenderTasks();
        freshTimer?.Dispose();
        freshTimer = DispatcherTimer.RunOnce(() =>
        {
            justCompleted = new();
            RenderTasks();
        }, TimeSpan.FromSeconds(2));
        if (ev is not null) Present(ev);
    }

    /// <summary>Chooses another variant (Codestead Linux: distribution).</summary>
    public void ChangeVariant(string id)
    {
        if (id == state.Variant) return;
        tool.Save();
        state.Variant = id;
        SaveState();
        tool.VariantChosen(id);
        tool.ChapterShown(Chapter.Id);
        FillPickers();
        RenderAll();
    }

    private void ChangeLanguage(string code)
    {
        if (code == Lang || !Languages.IsOffered(code)) return;
        state.Lang = code;
        SaveState();
        tool.LanguageChanged(code);
        ApplyLanguage();
    }
}
