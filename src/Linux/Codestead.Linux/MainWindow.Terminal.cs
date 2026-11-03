using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.Terminal;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

// Moving between chapters, the terminal (running commands, checking tasks), and changing distribution or language.
public sealed partial class MainWindow
{
    private void Navigate(string id)
    {
        state.Chapter = id;
        justCompleted = new();
        SaveState();
        UseShellFor(Chapter);
        FillPickers();
        RenderAll();
    }

    /// <summary>Switches the terminal to the chapter's distribution (Ubuntu outside the distro main chapter).</summary>
    private void UseShellFor(Chapter chapter)
    {
        var id = ChaptersLib.DistroFor(chapter, state.Distro);
        if (id == shell.Distro.Id) return;
        SaveShell();
        shell = LoadShell(id);
        terminal.Shell = shell;
        FillPickers();
    }

    private void OnResult(ExecResult result)
    {
        SaveShell();
        terminalTitle.Text = $"{shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";
        var newly = ProgressLib.EvaluateTasks(Chapter, shell, result, state.Progress);
        // Every finished command line counts as an attempt for the tasks that are not done yet.
        bool solutionUnlocked = false;
        if (!result.Pending && !result.Incomplete && result.Line.Trim() != "")
        {
            foreach (var task in Chapter.Tasks)
            {
                var key = TaskKeyOf(Chapter, task);
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
        if (!result.Pending && !result.Incomplete && result.Line.Trim() != "")
        {
            var solved = newly.Select(k => new SolvedTask(k, state.HintSeen.Contains(k) || state.Game.SolutionSeen.Contains(k))).ToList();
            ev = LinuxGame.Rules.OnCommand(state.Game, Snapshot(), CommandInfo.Analyze(result.Line, result.Output, result.ExitCode), Chapter.Id, solved, DateTime.Now);
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

    private void ChangeDistro(string id)
    {
        if (id == state.Distro) return;
        SaveShell();
        state.Distro = id;
        SaveState();
        UseShellFor(Chapter);
        FillPickers();
        RenderAll();
    }

    private void ChangeLanguage(string code)
    {
        if (code == Lang || !LanguagesLib.IsLang(code)) return;
        state.Lang = code;
        SaveState();
        // The exercise files, folders and the user get names and texts in the new language (see World.cs).
        WorldMigration.Translate(shell, code);
        SaveShell();
        ApplyLanguage();
    }

    private void ConfirmResetTerminal()
    {
        overlay.Confirm(T("reset.terminal.title"), T("reset.terminal.confirm", ("distro", Distro.Name)), T("reset.terminal.button"), T("dialog.cancel"), true, () =>
        {
            storage.Remove($"shell.{Distro.Id}");
            shell = ShellType.Create(Distro.Id, Lang);
            shell.Lang = Lang;
            terminal.Shell = shell;
            RenderAll();
            overlay.Toast(T("toast.terminalReset"));
        });
    }
}
