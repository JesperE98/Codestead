using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning.Game;
using Codestead.Learning.UI;
using Codestead.Shell;
using Codestead.Shell.Commands;
using Codestead.Terminal;
using Codestead.UI.Controls;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

// The workbench of Codestead Linux: a simulated terminal per distribution, saved between runs.
public sealed partial class LinuxTool
{
    private ShellType? shell;
    private ExecResult? lastResult;
    private readonly TerminalView terminal = new();
    private readonly TextBlock terminalTitle = new() { Foreground = new SolidColorBrush(Color.Parse("#9aa3b0")), FontSize = 12.5, VerticalAlignment = VerticalAlignment.Center };
    private readonly Button terminalReset = new();
    private Control? frame;

    public LinuxTool()
    {
        terminal.CommandExecuted += OnTerminalResult;
    }

    private ShellType Shell => shell ?? throw new InvalidOperationException("No chapter has been shown yet.");

    private Distro Distro => Shell.Distro;

    /// <summary>The terminal with its title bar (three dots, user@host, "Reset").</summary>
    public override Control Workbench => frame ??= BuildFrame();

    private Control BuildFrame()
    {
        terminalReset.Classes.Add("flat");
        terminalReset.Foreground = new SolidColorBrush(Color.Parse("#c9d1d9"));
        terminalReset.FontSize = 12.5;
        terminalReset.Padding = new Thickness(8, 2);
        terminalReset.Click += (_, _) => ConfirmResetTerminal();
        var dots = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6, VerticalAlignment = VerticalAlignment.Center };
        foreach (var c in new[] { "#3d444d", "#3d444d", "#3d444d" }) dots.Children.Add(new Border { Width = 11, Height = 11, CornerRadius = new CornerRadius(6), Background = new SolidColorBrush(Color.Parse(c)) });
        var titleBar = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"), Height = 34 };
        titleBar.Children.Add(dots);
        Grid.SetColumn(terminalTitle, 1);
        terminalTitle.HorizontalAlignment = HorizontalAlignment.Center;
        titleBar.Children.Add(terminalTitle);
        Grid.SetColumn(terminalReset, 2);
        titleBar.Children.Add(terminalReset);
        var terminalDock = new DockPanel();
        var bar = new Border { Background = new SolidColorBrush(Color.Parse("#1b2129")), Padding = new Thickness(12, 0), Child = titleBar };
        DockPanel.SetDock(bar, Dock.Top);
        terminalDock.Children.Add(bar);
        terminalDock.Children.Add(terminal);
        return new Border { CornerRadius = new CornerRadius(10), ClipToBounds = true, Child = terminalDock, FlowDirection = FlowDirection.LeftToRight };
    }

    private void UpdateTitle() => terminalTitle.Text = $"{Shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";

    public override void Inject(string command) => terminal.Inject(command);

    public override void FocusWorkbench() => terminal.FocusInput();

    public override void Run(string command) => OnTerminalResult(Shell.Execute(command));

    private void OnTerminalResult(ExecResult result)
    {
        SaveShell();
        UpdateTitle();
        lastResult = result;
        OnRan(new SandboxRun(result.Line, UtilCmd.StripAnsi(result.Output), result.ExitCode, !result.Pending && !result.Incomplete));
    }

    public override IReadOnlyList<string> Evaluate(string chapterId, SandboxRun run, OrderedDictionary<string, bool> completed) =>
        lastResult is null ? [] : ProgressLib.EvaluateTasks(ChapterOf(chapterId), Shell, lastResult, completed);

    public override CommandFacts? Analyze(SandboxRun run) => CommandInfo.Analyze(run.Line, run.Output, run.ExitCode);

    public override ISandbox Sandbox(string chapterId) => new ShellSandbox(DistroOf(ChapterOf(chapterId)).Id, Lang);

    // ---------- Events from the window ----------

    /// <summary>Switches the terminal to the chapter's distribution (Ubuntu outside the distro main chapter).</summary>
    public override void ChapterShown(string chapterId)
    {
        var id = ChaptersLib.DistroFor(ChapterOf(chapterId), Window.ChosenVariant ?? ChaptersLib.DefaultDistro);
        if (shell is not null && id == shell.Distro.Id) return;
        if (shell is not null) SaveShell();
        shell = LoadShell(id);
        terminal.Shell = shell;
    }

    public override void LanguageChanged(string lang)
    {
        // The exercise files, folders and the user get names and texts in the new language (see World.cs).
        WorldMigration.Translate(Shell, lang);
        SaveShell();
    }

    public override void TextsApplied()
    {
        Shell.Lang = Lang;
        terminal.InputLabel = Window.T("terminal.input");
        terminalReset.Content = "↺  " + Window.T("terminal.reset");
        ToolTip.SetTip(terminalReset, Window.T("terminal.resetTitle"));
    }

    public override void Rendered() => UpdateTitle();

    public override void Save() => SaveShell();

    public override IEnumerable<ResetAction> Resets() =>
    [
        new ResetAction(Window.T("reset.terminal.title"), Window.T("reset.terminal.desc", ("distro", Distro.Name)), Window.T("reset.terminal.button"), ConfirmResetTerminal),
    ];

    private ShellType LoadShell(string distroId)
    {
        var sh = ShellType.RestoreJson(Window.Storage.LoadText($"shell.{distroId}")) ?? ShellType.Create(distroId, Lang);
        sh.Lang = Lang;
        // A terminal saved in another language: its exercise files and user follow the current language.
        WorldMigration.Translate(sh, Lang);
        return sh;
    }

    private void SaveShell()
    {
        if (shell is not null) Window.Storage.SaveText($"shell.{shell.Distro.Id}", shell.SnapshotJson());
    }

    private void ConfirmResetTerminal()
    {
        Window.Overlay.Confirm(Window.T("reset.terminal.title"), Window.T("reset.terminal.confirm", ("distro", Distro.Name)), Window.T("reset.terminal.button"), Window.T("dialog.cancel"), true, () =>
        {
            Window.Storage.Remove($"shell.{Distro.Id}");
            shell = ShellType.Create(Distro.Id, Lang);
            shell.Lang = Lang;
            terminal.Shell = shell;
            Window.Refresh();
            Window.Toast(Window.T("toast.terminalReset"));
        });
    }
}
