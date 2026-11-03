using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using Codestead.Shell;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.UI.Controls;

/// <summary>
/// The simulated terminal: shows output with ANSI colours and an input line with the prompt.
/// Supports history (↑/↓), Tab completion, Ctrl+C (cancel), Ctrl+L (clear) and hidden password input.
/// </summary>
public sealed class TerminalView : UserControl
{
    private const int MaxEntries = 400;

    private readonly ScrollViewer scroll;
    private readonly StackPanel entries;
    private readonly SelectableTextBlock promptBlock;
    private readonly TextBox input;
    private ShellType? shell;
    private int? historyIndex;
    private string draft = "";

    /// <summary>Fired after every executed command line.</summary>
    public event Action<ExecResult>? CommandExecuted;

    private static IBrush TermText => new SolidColorBrush(Color.Parse("#e6edf3"));
    private static readonly FontFamily Mono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");

    public TerminalView()
    {
        FlowDirection = FlowDirection.LeftToRight;
        entries = new StackPanel { Spacing = 0 };
        promptBlock = new SelectableTextBlock
        {
            FontFamily = Mono,
            FontSize = 14,
            Foreground = TermText,
            VerticalAlignment = VerticalAlignment.Center,
        };
        input = new TextBox
        {
            FontFamily = Mono,
            FontSize = 14,
            Foreground = TermText,
            CaretBrush = TermText,
            Background = Brushes.Transparent,
            BorderThickness = new Thickness(0),
            Padding = new Thickness(0),
            MinHeight = 0,
            VerticalAlignment = VerticalAlignment.Center,
            AcceptsReturn = false,
            AcceptsTab = false,
        };
        input.Classes.Add("terminal-input");
        // The Fluent theme gives TextBox a background and border on focus/hover; the terminal input should look like plain text.
        input.Resources["TextControlBackgroundFocused"] = Brushes.Transparent;
        input.Resources["TextControlBackgroundPointerOver"] = Brushes.Transparent;
        input.Resources["TextControlBorderBrushFocused"] = Brushes.Transparent;
        input.Resources["TextControlBorderBrushPointerOver"] = Brushes.Transparent;
        input.Resources["TextControlForegroundFocused"] = TermText;
        input.Resources["TextControlForegroundPointerOver"] = TermText;
        input.AddHandler(KeyDownEvent, OnKeyDown, RoutingStrategies.Tunnel);

        var inputLine = new DockPanel { LastChildFill = true };
        DockPanel.SetDock(promptBlock, Dock.Left);
        inputLine.Children.Add(promptBlock);
        inputLine.Children.Add(input);

        var content = new StackPanel { Margin = new Thickness(14, 10, 14, 14) };
        content.Children.Add(entries);
        content.Children.Add(inputLine);

        scroll = new ScrollViewer
        {
            Content = content,
            HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Auto,
        };
        Content = new Border { Background = new SolidColorBrush(Color.Parse("#0f1318")), Child = scroll };
        PointerReleased += (_, _) =>
        {
            // Clicking the terminal focuses the input – unless the user is selecting text.
            if (TopLevel.GetTopLevel(this)?.FocusManager?.GetFocusedElement() is SelectableTextBlock stb && !string.IsNullOrEmpty(stb.SelectedText)) return;
            input.Focus();
        };
    }

    /// <summary>Label for screen readers.</summary>
    public string InputLabel
    {
        get => AutomationProperties.GetName(input) ?? "";
        set => AutomationProperties.SetName(input, value);
    }

    /// <summary>The shell this terminal runs. Setting it clears the screen and shows the welcome text.</summary>
    public ShellType? Shell
    {
        get => shell;
        set
        {
            shell = value;
            entries.Children.Clear();
            historyIndex = null;
            input.Text = "";
            if (shell is not null) AddOutput(null, null, shell.Welcome());
            UpdatePrompt();
        }
    }

    /// <summary>Puts text on the command line (e.g. after clicking a command in the lesson).</summary>
    public void Inject(string text)
    {
        input.Text = text;
        input.CaretIndex = text.Length;
        input.Focus();
    }

    public void FocusInput() => input.Focus();

    private void UpdatePrompt()
    {
        promptBlock.Inlines?.Clear();
        promptBlock.Inlines ??= new InlineCollection();
        if (shell is null) return;
        foreach (var run in Ansi.ToInlines(shell.Prompt(), TermText)) promptBlock.Inlines.Add(run);
        // Passwords (e.g. for passwd and su) are not shown while typing – just like a real terminal.
        SetSecret(shell.PendingQuestion?.Secret == true);
    }

    private void SetSecret(bool secret)
    {
        IBrush brush = secret ? Brushes.Transparent : TermText;
        input.Foreground = brush;
        input.Resources["TextControlForegroundFocused"] = brush;
        input.Resources["TextControlForegroundPointerOver"] = brush;
    }

    private void AddOutput(string? prompt, string? typed, string output)
    {
        if (prompt is not null)
        {
            var line = new SelectableTextBlock { FontFamily = Mono, FontSize = 14, Foreground = TermText, TextWrapping = TextWrapping.Wrap };
            line.Inlines = new InlineCollection();
            foreach (var r in Ansi.ToInlines(prompt, TermText)) line.Inlines.Add(r);
            line.Inlines.Add(new Run(typed ?? "") { Foreground = TermText });
            entries.Children.Add(line);
        }
        if (output != "")
        {
            var block = new SelectableTextBlock { FontFamily = Mono, FontSize = 14, Foreground = TermText, TextWrapping = TextWrapping.Wrap };
            block.Inlines = new InlineCollection();
            var text = output.EndsWith('\n') ? output[..^1] : output;
            foreach (var r in Ansi.ToInlines(text, TermText)) block.Inlines.Add(r);
            entries.Children.Add(block);
        }
        while (entries.Children.Count > MaxEntries) entries.Children.RemoveAt(0);
        Dispatcher.UIThread.Post(() => scroll.ScrollToEnd(), DispatcherPriority.Background);
    }

    private void Run()
    {
        if (shell is null) return;
        var line = input.Text ?? "";
        var shownPrompt = shell.Prompt();
        bool secret = shell.PendingQuestion?.Secret == true;
        var result = shell.Execute(line);
        historyIndex = null;
        input.Text = "";
        if (result.Clear) entries.Children.Clear();
        else AddOutput(shownPrompt, secret ? "" : line, result.Output);
        UpdatePrompt();
        CommandExecuted?.Invoke(result);
    }

    private void BrowseHistory(int dir)
    {
        if (shell is null) return;
        var h = shell.History;
        if (h.Count == 0) return;
        if (historyIndex is null)
        {
            if (dir == 1) return;
            draft = input.Text ?? "";
            historyIndex = h.Count;
        }
        int next = historyIndex.Value + dir;
        if (next < 0) return;
        if (next >= h.Count)
        {
            historyIndex = null;
            input.Text = draft;
        }
        else
        {
            historyIndex = next;
            input.Text = h[next];
        }
        input.CaretIndex = input.Text?.Length ?? 0;
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (shell is null) return;
        bool ctrl = e.KeyModifiers.HasFlag(KeyModifiers.Control);
        switch (e.Key)
        {
            case Key.Enter:
                e.Handled = true;
                Run();
                break;
            case Key.Up when shell.PendingQuestion is null:
                e.Handled = true;
                BrowseHistory(-1);
                break;
            case Key.Down when shell.PendingQuestion is null:
                e.Handled = true;
                BrowseHistory(1);
                break;
            case Key.Tab:
            {
                e.Handled = true;
                if (shell.PendingQuestion is not null) break;
                var prompt = shell.Prompt();
                var before = input.Text ?? "";
                var (line, options) = shell.Complete(before);
                input.Text = line;
                input.CaretIndex = line.Length;
                if (options.Count > 0) AddOutput(prompt, before, string.Join("  ", options) + "\n");
                break;
            }
            case Key.C when ctrl:
            {
                // Let Ctrl+C copy when text is selected.
                if (!string.IsNullOrEmpty(input.SelectedText)) return;
                e.Handled = true;
                var prompt = shell.Prompt();
                bool secret = shell.PendingQuestion?.Secret == true;
                shell.Cancel();
                AddOutput(prompt, (secret ? "" : input.Text ?? "") + "^C", "");
                input.Text = "";
                historyIndex = null;
                UpdatePrompt();
                break;
            }
            case Key.L when ctrl:
                e.Handled = true;
                entries.Children.Clear();
                break;
        }
    }
}
