using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using Codestead.GP.Gpu;

namespace Codestead.GP.Workbench;

/// <summary>
/// The workbench of Codestead GP: the project's files as tabs, a code editor, "Build &amp; run", and below them the
/// build output and a preview of the window the program opens (ProjectView.Output.cs).
/// </summary>
public sealed partial class ProjectView : Border
{
    internal static readonly FontFamily Mono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");
    private static readonly IBrush Dark = new SolidColorBrush(Color.Parse("#0f1318"));
    private static readonly IBrush Bar = new SolidColorBrush(Color.Parse("#1b2129"));
    private static readonly IBrush Dim = new SolidColorBrush(Color.Parse("#9aa3b0"));
    private static readonly IBrush Light = new SolidColorBrush(Color.Parse("#e6edf3"));

    private readonly StackPanel tabs = new() { Orientation = Orientation.Horizontal, Spacing = 2, VerticalAlignment = VerticalAlignment.Bottom };
    private readonly TextBox editor = new()
    {
        AcceptsReturn = true,
        AcceptsTab = false,
        TextWrapping = TextWrapping.NoWrap,
        FontFamily = Mono,
        FontSize = 13,
        Background = Dark,
        Foreground = Light,
        CaretBrush = Light,
        SelectionBrush = new SolidColorBrush(Color.Parse("#264f78")),
        SelectionForegroundBrush = Light,
        BorderThickness = new Thickness(0),
        Padding = new Thickness(12, 8),
        CornerRadius = new CornerRadius(0),
    };
    private readonly Avalonia.Controls.Image assetImage = new() { Stretch = Stretch.Uniform, MaxWidth = 512, MaxHeight = 512, Margin = new Thickness(16) };
    private readonly Border assetView = new() { Background = Dark, IsVisible = false };
    private readonly TextBlock status = new() { Foreground = Dim, FontSize = 12, VerticalAlignment = VerticalAlignment.Center };
    private readonly Button build = new() { Padding = new Thickness(12, 3), FontSize = 12.5, VerticalAlignment = VerticalAlignment.Center };
    private readonly Button reset = new() { Padding = new Thickness(8, 2), FontSize = 12.5, Foreground = new SolidColorBrush(Color.Parse("#c9d1d9")), VerticalAlignment = VerticalAlignment.Center };
    private readonly DispatcherTimer saveTimer = new() { Interval = TimeSpan.FromSeconds(1) };

    private GpuProject project = new();
    private string file = "";
    private bool loading;
    private Tr t = (key, _) => key;

    /// <summary>The learner pressed "Build &amp; run" (or Ctrl+Enter).</summary>
    public event Action? BuildRequested;
    /// <summary>The learner pressed "Reset".</summary>
    public event Action? ResetRequested;
    /// <summary>The code changed (raised at most once a second, for saving).</summary>
    public event Action? Edited;

    public ProjectView()
    {
        CornerRadius = new CornerRadius(10);
        ClipToBounds = true;
        Background = Dark;
        FlowDirection = FlowDirection.LeftToRight;

        build.Classes.Add("primary");
        build.Click += (_, _) => BuildRequested?.Invoke();
        reset.Classes.Add("flat");
        reset.Click += (_, _) => ResetRequested?.Invoke();
        // Keep the dark editor when it has focus or the pointer is over it (the Fluent theme would turn it light).
        foreach (var key in new[] { "TextControlBackground", "TextControlBackgroundPointerOver", "TextControlBackgroundFocused", "TextControlBackgroundDisabled" })
            editor.Resources[key] = Dark;
        foreach (var key in new[] { "TextControlForeground", "TextControlForegroundPointerOver", "TextControlForegroundFocused" })
            editor.Resources[key] = Light;
        foreach (var key in new[] { "TextControlBorderBrush", "TextControlBorderBrushPointerOver", "TextControlBorderBrushFocused" })
            editor.Resources[key] = Brushes.Transparent;
        ScrollViewer.SetHorizontalScrollBarVisibility(editor, ScrollBarVisibility.Auto);
        ScrollViewer.SetVerticalScrollBarVisibility(editor, ScrollBarVisibility.Auto);
        editor.TextChanged += (_, _) =>
        {
            if (loading) return;
            saveTimer.Stop();
            saveTimer.Start();
        };
        editor.PropertyChanged += (_, e) =>
        {
            if (e.Property == TextBox.CaretIndexProperty) UpdateStatus();
        };
        editor.AddHandler(KeyDownEvent, OnEditorKey, Avalonia.Interactivity.RoutingStrategies.Tunnel);
        saveTimer.Tick += (_, _) =>
        {
            saveTimer.Stop();
            Commit();
            Edited?.Invoke();
        };

        var titleBar = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto,Auto"), Height = 38 };
        titleBar.Children.Add(new ScrollViewer { Content = tabs, HorizontalScrollBarVisibility = ScrollBarVisibility.Hidden, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled });
        Grid.SetColumn(reset, 1);
        titleBar.Children.Add(reset);
        Grid.SetColumn(build, 2);
        build.Margin = new Thickness(6, 0, 0, 0);
        titleBar.Children.Add(build);
        var top = new Border { Background = Bar, Padding = new Thickness(8, 0, 8, 0), Child = titleBar };

        var statusBar = new Border { Background = Bar, Padding = new Thickness(12, 3), Child = status };

        var editorDock = new DockPanel();
        DockPanel.SetDock(top, Dock.Top);
        editorDock.Children.Add(top);
        DockPanel.SetDock(statusBar, Dock.Bottom);
        editorDock.Children.Add(statusBar);
        assetView.Child = assetImage;
        var content = new Grid();
        content.Children.Add(editor);
        content.Children.Add(assetView);
        editorDock.Children.Add(content);

        var root = new Grid { RowDefinitions = new RowDefinitions("*,4,190") };
        root.Children.Add(editorDock);
        var splitter = new GridSplitter { ResizeDirection = GridResizeDirection.Rows, Background = Bar };
        Grid.SetRow(splitter, 1);
        root.Children.Add(splitter);
        var bottom = BuildBottom();
        Grid.SetRow(bottom, 2);
        root.Children.Add(bottom);
        Child = root;
    }

    private void OnEditorKey(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && e.KeyModifiers.HasFlag(KeyModifiers.Control))
        {
            e.Handled = true;
            BuildRequested?.Invoke();
            return;
        }
        if (e.Key == Key.Tab && e.KeyModifiers == KeyModifiers.None)
        {
            // Four spaces, like the course's code.
            e.Handled = true;
            InsertAtCaret("    ");
            return;
        }
        if (e.Key == Key.Enter && e.KeyModifiers == KeyModifiers.None)
        {
            // Keep the indentation of the line above.
            e.Handled = true;
            var text = editor.Text ?? "";
            int caret = Math.Min(editor.CaretIndex, text.Length);
            int lineStart = text.LastIndexOf('\n', Math.Max(0, caret - 1)) + 1;
            if (caret == 0) lineStart = 0;
            var indent = new string(text[lineStart..caret].TakeWhile(c => c == ' ' || c == '\t').ToArray());
            if (caret > 0 && text[caret - 1] == '{') indent += "    ";
            InsertAtCaret("\n" + indent);
        }
    }

    /// <summary>Opens a project (the chapter's, for an API) on its first file.</summary>
    public void Open(GpuProject p, ApiInfo api)
    {
        project = p;
        file = p.Files.Keys.FirstOrDefault() ?? "";
        RebuildTabs();
        LoadFile();
        ClearResult(api);
    }

    private void RebuildTabs()
    {
        tabs.Children.Clear();
        foreach (var name in project.Files.Keys.Concat(project.Assets.Keys))
        {
            var tab = new Button
            {
                Content = Path.GetFileName(name),
                FontSize = 12.5,
                FontFamily = Mono,
                Padding = new Thickness(12, 6),
                CornerRadius = new CornerRadius(6, 6, 0, 0),
                Foreground = name == file ? Light : Dim,
                Background = name == file ? Dark : Brushes.Transparent,
                BorderThickness = new Thickness(0),
            };
            ToolTip.SetTip(tab, name);
            var n = name;
            tab.Click += (_, _) =>
            {
                Commit();
                file = n;
                RebuildTabs();
                LoadFile();
            };
            tabs.Children.Add(tab);
        }
    }

    private void LoadFile()
    {
        bool asset = project.Assets.TryGetValue(file, out var bytes);
        editor.IsVisible = !asset;
        assetView.IsVisible = asset;
        if (asset)
        {
            try
            {
                using var stream = new MemoryStream(bytes!);
                assetImage.Source = new Avalonia.Media.Imaging.Bitmap(stream);
            }
            catch (Exception e) when (e is not OutOfMemoryException)
            {
                assetImage.Source = null;
            }
            status.Text = file;
            return;
        }
        loading = true;
        editor.Text = project.Files.TryGetValue(file, out var text) ? text : "";
        editor.CaretIndex = 0;
        loading = false;
        UpdateStatus();
    }

    private void Commit()
    {
        if (file != "" && project.Files.ContainsKey(file)) project.Files[file] = (editor.Text ?? "").Replace("\r\n", "\n");
    }

    /// <summary>Writes what is in the editor into the project (the tool calls this before building or saving).</summary>
    public void CommitEdits(GpuProject p)
    {
        if (ReferenceEquals(p, project)) Commit();
    }

    /// <summary>Shows a file of the project, selecting a range or the first occurrence of some code (whitespace-insensitive).</summary>
    public void Show(GpuProject p, string name, string? normalizedCode, (int Start, int Length)? range = null)
    {
        project = p;
        if (file != name || !ReferenceEquals(p, project))
        {
            file = name;
            RebuildTabs();
        }
        LoadFile();
        if (range is { } r) Select(r.Start, r.Length);
        else if (normalizedCode is not null && FindNormalized(editor.Text ?? "", normalizedCode) is { } found) Select(found.Start, found.Length);
    }

    private static (int Start, int Length)? FindNormalized(string text, string normalized)
    {
        var first = normalized.Split(' ')[0];
        int at = text.IndexOf(first, StringComparison.Ordinal);
        while (at >= 0)
        {
            // Walk forward matching the normalised text.
            int i = at, j = 0;
            while (i < text.Length && j < normalized.Length)
            {
                if (char.IsWhiteSpace(normalized[j]))
                {
                    if (!char.IsWhiteSpace(text[i]) && i > at && !char.IsWhiteSpace(text[i - 1])) break;
                    while (i < text.Length && char.IsWhiteSpace(text[i])) i++;
                    j++;
                    continue;
                }
                if (text[i] != normalized[j]) break;
                i++;
                j++;
            }
            if (j == normalized.Length) return (at, i - at);
            at = text.IndexOf(first, at + 1, StringComparison.Ordinal);
        }
        return null;
    }

    private void Select(int start, int length)
    {
        var len = (editor.Text ?? "").Length;
        start = Math.Clamp(start, 0, len);
        editor.SelectionStart = start;
        editor.SelectionEnd = Math.Clamp(start + length, 0, len);
        editor.CaretIndex = editor.SelectionEnd;
        editor.Focus();
    }

    /// <summary>Goes to a line of a file (from a compiler message).</summary>
    public void GoTo(string name, int line)
    {
        if (!project.Files.ContainsKey(name)) return;
        Commit();
        if (file != name)
        {
            file = name;
            RebuildTabs();
            LoadFile();
        }
        var text = editor.Text ?? "";
        int start = 0;
        for (int l = 1; l < line && start >= 0; l++) start = text.IndexOf('\n', start) + 1;
        if (start < 0) start = 0;
        int end = text.IndexOf('\n', start);
        Select(start, (end < 0 ? text.Length : end) - start);
    }

    public void InsertAtCaret(string text)
    {
        var current = editor.Text ?? "";
        int s = Math.Min(editor.SelectionStart, editor.SelectionEnd), e = Math.Max(editor.SelectionStart, editor.SelectionEnd);
        s = Math.Clamp(s, 0, current.Length);
        e = Math.Clamp(e, 0, current.Length);
        editor.Text = current[..s] + text + current[e..];
        editor.SelectionStart = editor.SelectionEnd = editor.CaretIndex = s + text.Length;
    }

    public void FocusEditor() => editor.Focus();

    private void UpdateStatus()
    {
        if (project.Assets.ContainsKey(file)) return;
        var text = editor.Text ?? "";
        int caret = Math.Min(editor.CaretIndex, text.Length);
        int line = 1, col = 1;
        for (int i = 0; i < caret; i++)
        {
            if (text[i] == '\n')
            {
                line++;
                col = 1;
            }
            else col++;
        }
        status.Text = $"{file}  ·  {t("project.position", ("line", line), ("col", col))}  ·  {t("project.shortcut")}";
    }

    /// <summary>The texts in the learner's language.</summary>
    public void ApplyTexts(Tr tr)
    {
        t = tr;
        build.Content = "▶  " + t("project.build");
        ToolTip.SetTip(build, t("project.buildTitle"));
        reset.Content = "↺  " + t("project.reset");
        ToolTip.SetTip(reset, t("project.resetTitle"));
        UpdateStatus();
        ApplyOutputTexts();
    }
}
