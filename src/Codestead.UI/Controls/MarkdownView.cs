using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Markdig;
using Markdig.Extensions.Tables;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
using MdBlock = Markdig.Syntax.Block;
using MdInline = Markdig.Syntax.Inlines.Inline;

namespace Codestead.UI.Controls;

/// <summary>
/// Renders chapter markdown as native Avalonia controls: headings, paragraphs, lists, tables,
/// block quotes, code blocks (```sh lines are clickable commands) and distro blocks
/// (<c>&lt;div class="distro-block" data-label="…"&gt;</c> … <c>&lt;/div&gt;</c>).
/// </summary>
public sealed class MarkdownView : UserControl
{
    private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UsePipeTables()
        .UseEmphasisExtras()
        .UseAutoLinks()
        .Build();

    private static readonly FontFamily Mono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");
    private static readonly System.Text.RegularExpressions.Regex DistroOpen =
        new("<div class=\"distro-block\" data-family=\"(\\w+)\" data-label=\"([^\"]*)\">", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    private readonly StackPanel root = new() { Spacing = 0 };

    /// <summary>Fired when a line in a ```sh block is clicked.</summary>
    public event Action<string>? CommandClicked;

    /// <summary>Fired when a link is clicked (the app opens it in the browser).</summary>
    public event Action<string>? LinkClicked;

    /// <summary>Tooltip on clickable command lines.</summary>
    public string CommandHint { get; set; } = "";

    /// <summary>
    /// Optional renderer for custom fenced blocks (e.g. ```quiz). Return null to use the default rendering.
    /// </summary>
    public Func<FencedCodeBlock, Control?>? CustomBlockRenderer { get; set; }

    public double BaseFontSize { get; set; } = 16;

    public MarkdownView()
    {
        Content = root;
    }

    /// <summary>Shows markdown (already preprocessed: placeholders filled in, distro blocks resolved).</summary>
    public void SetMarkdown(string markdown)
    {
        root.Children.Clear();
        var doc = Markdig.Markdown.Parse(markdown, Pipeline);
        var stack = new Stack<Panel>();
        stack.Push(root);
        foreach (var block in doc)
        {
            if (block is HtmlBlock html)
            {
                var text = html.Lines.ToString();
                var open = DistroOpen.Match(text);
                if (open.Success)
                {
                    var (box, inner) = DistroBox(open.Groups[1].Value, open.Groups[2].Value);
                    stack.Peek().Children.Add(box);
                    stack.Push(inner);
                    continue;
                }
                if (text.Trim() == "</div>" && stack.Count > 1)
                {
                    stack.Pop();
                    continue;
                }
                continue; // other raw HTML is not shown
            }
            var control = RenderBlock(block);
            if (control is not null) stack.Peek().Children.Add(control);
        }
    }

    private static readonly Dictionary<string, string> FamilyColors = new()
    {
        ["debian"] = "#c7254e",
        ["arch"] = "#1793d1",
        ["redhat"] = "#3c6eb4",
    };

    private (Control Box, Panel Inner) DistroBox(string family, string label)
    {
        var inner = new StackPanel();
        var badge = new Border
        {
            Background = new SolidColorBrush(Color.Parse(FamilyColors.GetValueOrDefault(family, "#555555"))),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(8, 1),
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 0, 2),
            Child = new TextBlock { Text = label, Foreground = Brushes.White, FontSize = 11.5, FontWeight = FontWeight.Bold },
        };
        var body = new StackPanel();
        body.Children.Add(badge);
        body.Children.Add(inner);
        var box = new Border
        {
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(18, 8, 18, 8),
            Margin = new Thickness(0, 14, 0, 6),
            Child = body,
        };
        box.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));
        box.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSurface"));
        return (box, inner);
    }

    private Control? RenderBlock(MdBlock block)
    {
        switch (block)
        {
            case HeadingBlock h:
            {
                var tb = NewText();
                // Headings get their size from the theme (h1/h2/h3 classes), scaled to the base size.
                tb.FontSize = BaseFontSize * (h.Level <= 1 ? 1.9 : h.Level == 2 ? 1.32 : 1.08);
                tb.LineHeight = tb.FontSize * 1.25;
                tb.FontWeight = h.Level <= 2 ? FontWeight.Bold : FontWeight.SemiBold;
                tb.Margin = h.Level <= 1 ? new Thickness(0, 4, 0, 18) : h.Level == 2 ? new Thickness(0, 30, 0, 8) : new Thickness(0, 20, 0, 6);
                AddInlines(tb.Inlines!, h.Inline);
                return tb;
            }
            case ParagraphBlock p:
            {
                var tb = NewText();
                tb.Margin = new Thickness(0, 6, 0, 8);
                AddInlines(tb.Inlines!, p.Inline);
                return tb;
            }
            case ListBlock list:
                return RenderList(list);
            case FencedCodeBlock fenced:
            {
                var custom = CustomBlockRenderer?.Invoke(fenced);
                if (custom is not null) return custom;
                var info = (fenced.Info ?? "").Trim();
                var code = fenced.Lines.ToString().TrimEnd('\n', '\r');
                return info is "sh" or "bash" or "shell" ? CommandBlock(code) : CodeBlock(code);
            }
            case CodeBlock codeBlock:
                return CodeBlock(codeBlock.Lines.ToString().TrimEnd('\n', '\r'));
            case QuoteBlock quote:
            {
                var inner = new StackPanel();
                foreach (var child in quote)
                {
                    var c = RenderBlock(child);
                    if (c is not null) inner.Children.Add(c);
                }
                var border = new Border
                {
                    BorderThickness = new Thickness(4, 0, 0, 0),
                    CornerRadius = new CornerRadius(4),
                    Padding = new Thickness(14, 6),
                    Margin = new Thickness(0, 12),
                    Child = inner,
                };
                border.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsWarnBorder"));
                border.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarnBg"));
                return border;
            }
            case Table table:
                return RenderTable(table);
            case ThematicBreakBlock:
                return new Separator { Margin = new Thickness(0, 16) };
            case LinkReferenceDefinitionGroup:
                return null;
            case ContainerBlock container:
            {
                var panel = new StackPanel();
                foreach (var child in container)
                {
                    var c = RenderBlock(child);
                    if (c is not null) panel.Children.Add(c);
                }
                return panel;
            }
        }
        return null;
    }

    private SelectableTextBlock NewText() => new()
    {
        TextWrapping = TextWrapping.Wrap,
        FontSize = BaseFontSize,
        LineHeight = BaseFontSize * 1.6,
        Inlines = new InlineCollection(),
    };

    private Control RenderList(ListBlock list)
    {
        var panel = new StackPanel { Margin = new Thickness(0, 4, 0, 8), Spacing = 2 };
        int number = int.TryParse(list.OrderedStart, out var start) ? start : 1;
        foreach (var item in list.OfType<ListItemBlock>())
        {
            var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("28,*") };
            var marker = new TextBlock
            {
                Text = list.IsOrdered ? $"{number++}." : "•",
                FontSize = BaseFontSize,
                LineHeight = BaseFontSize * 1.6,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 0, 8, 0),
            };
            marker.Classes.Add("muted");
            var content = new StackPanel();
            foreach (var child in item)
            {
                var c = child is ParagraphBlock p ? ParagraphTight(p) : RenderBlock(child);
                if (c is not null) content.Children.Add(c);
            }
            Grid.SetColumn(content, 1);
            grid.Children.Add(marker);
            grid.Children.Add(content);
            panel.Children.Add(grid);
        }
        return panel;
    }

    private Control ParagraphTight(ParagraphBlock p)
    {
        var tb = NewText();
        AddInlines(tb.Inlines!, p.Inline);
        return tb;
    }

    private Control RenderTable(Table table)
    {
        var grid = new Grid { Margin = new Thickness(0, 10, 0, 12), HorizontalAlignment = HorizontalAlignment.Left };
        int columns = table.ColumnDefinitions.Count > 0 ? table.ColumnDefinitions.Count : table.OfType<TableRow>().Select(r => r.Count).DefaultIfEmpty(1).Max();
        for (int c = 0; c < columns; c++) grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
        int rowIndex = 0;
        foreach (var row in table.OfType<TableRow>())
        {
            grid.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
            int col = 0;
            foreach (var cell in row.OfType<TableCell>())
            {
                var tb = NewText();
                tb.FontSize = BaseFontSize - 1.5;
                tb.LineHeight = (BaseFontSize - 1.5) * 1.5;
                tb.MaxWidth = 380;
                if (row.IsHeader) tb.FontWeight = FontWeight.SemiBold;
                foreach (var b in cell)
                {
                    if (b is ParagraphBlock p) AddInlines(tb.Inlines!, p.Inline);
                }
                var border = new Border
                {
                    BorderThickness = new Thickness(col == 0 ? 1 : 0, rowIndex == 0 ? 1 : 0, 1, 1),
                    Padding = new Thickness(10, 5),
                    Child = tb,
                };
                border.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));
                if (row.IsHeader) border.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSurface2"));
                Grid.SetRow(border, rowIndex);
                Grid.SetColumn(border, Math.Min(col, columns - 1));
                grid.Children.Add(border);
                col++;
            }
            rowIndex++;
        }
        return new ScrollViewer
        {
            HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled,
            Content = grid,
        };
    }

    private Control CodeBlock(string code)
    {
        var tb = new SelectableTextBlock
        {
            Text = code,
            FontFamily = Mono,
            FontSize = 14,
            LineHeight = 21,
            Foreground = new SolidColorBrush(Color.Parse("#e6edf3")),
        };
        return new Border
        {
            Background = new SolidColorBrush(Color.Parse("#0f1318")),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16, 12),
            Margin = new Thickness(0, 8, 0, 12),
            FlowDirection = FlowDirection.LeftToRight,
            Child = new ScrollViewer
            {
                HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Auto,
                VerticalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled,
                Content = tb,
            },
        };
    }

    /// <summary>A ```sh block: every line is a button that puts the command in the terminal.</summary>
    private Control CommandBlock(string code)
    {
        var lines = new StackPanel();
        foreach (var line in code.Split('\n'))
        {
            var text = line.TrimEnd('\r');
            var content = new TextBlock { FontFamily = Mono, FontSize = 14, Inlines = new InlineCollection() };
            content.Inlines.Add(new Run("$ ") { Foreground = new SolidColorBrush(Color.Parse("#7d8590")) });
            content.Inlines.Add(new Run(text) { Foreground = new SolidColorBrush(Color.Parse("#e6edf3")) });
            var button = new Button { Content = content };
            button.Classes.Add("cmd");
            if (CommandHint != "") ToolTip.SetTip(button, CommandHint);
            button.Click += (_, _) => CommandClicked?.Invoke(text);
            lines.Children.Add(button);
        }
        return new Border
        {
            Background = new SolidColorBrush(Color.Parse("#0f1318")),
            BorderBrush = new SolidColorBrush(Color.Parse("#7ee787")),
            BorderThickness = new Thickness(3, 0, 0, 0),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10, 10),
            Margin = new Thickness(0, 8, 0, 12),
            FlowDirection = FlowDirection.LeftToRight,
            Child = lines,
        };
    }

    private void AddInlines(InlineCollection target, ContainerInline? container)
    {
        if (container is null) return;
        foreach (var inline in container) AddInline(target, inline);
    }

    private void AddInline(InlineCollection target, MdInline inline)
    {
        switch (inline)
        {
            case LiteralInline lit:
                target.Add(new Run(lit.Content.ToString()));
                break;
            case EmphasisInline em:
            {
                Span span = em.DelimiterChar is '~' ? new Span { TextDecorations = TextDecorations.Strikethrough }
                    : em.DelimiterCount >= 2 ? new Bold() : new Italic();
                foreach (var child in em) AddInline(span.Inlines, child);
                target.Add(span);
                break;
            }
            case CodeInline code:
            {
                var run = new Run(code.Content) { FontFamily = Mono, FontSize = BaseFontSize * 0.88 };
                run.Bind(TextElement.BackgroundProperty, this.GetResourceObservable("CsCodeBg"));
                target.Add(run);
                break;
            }
            case LinkInline link when !link.IsImage:
            {
                var text = string.Concat(link.Select(i => i is LiteralInline l ? l.Content.ToString() : i is CodeInline c ? c.Content : ""));
                target.Add(LinkInline(text, link.Url ?? ""));
                break;
            }
            case AutolinkInline auto:
                target.Add(LinkInline(auto.Url, auto.Url));
                break;
            case LineBreakInline br:
                if (br.IsHard) target.Add(new LineBreak());
                else target.Add(new Run(" "));
                break;
            case HtmlEntityInline entity:
                target.Add(new Run(entity.Transcoded.ToString()));
                break;
            case HtmlInline:
                break;
            case ContainerInline c:
                foreach (var child in c) AddInline(target, child);
                break;
        }
    }

    private Avalonia.Controls.Documents.Inline LinkInline(string text, string url)
    {
        var tb = new TextBlock { Text = text, FontSize = BaseFontSize, Cursor = new Cursor(StandardCursorType.Hand), TextDecorations = TextDecorations.Underline };
        tb.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsLink"));
        ToolTip.SetTip(tb, url);
        tb.PointerReleased += (_, _) => LinkClicked?.Invoke(url);
        return new InlineUIContainer(tb) { BaselineAlignment = BaselineAlignment.TextBottom };
    }
}
