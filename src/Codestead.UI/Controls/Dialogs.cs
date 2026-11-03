using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.LogicalTree;
using Avalonia.Threading;

namespace Codestead.UI.Controls;

/// <summary>An overlay layer that shows modal panels (dialogs) and short notices (toasts) on top of the window content.</summary>
public sealed class OverlayHost : Grid
{
    private readonly Panel dialogs = new Grid();
    private readonly StackPanel toasts = new()
    {
        HorizontalAlignment = HorizontalAlignment.Center,
        VerticalAlignment = VerticalAlignment.Bottom,
        Margin = new Thickness(0, 0, 0, 24),
        Spacing = 8,
    };

    public OverlayHost(Control content)
    {
        Children.Add(content);
        Children.Add(dialogs);
        Children.Add(toasts);
        dialogs.IsVisible = false;
    }

    /// <summary>Shows a panel centred on a dimmed background. Escape or a click outside closes it (calls <paramref name="onClose"/>).</summary>
    /// <param name="scroll">
    /// True: the whole panel scrolls when it is taller than the dialog. False: the panel scrolls by itself
    /// (it gets the dialog's height), so that it can keep e.g. its buttons in view.
    /// </param>
    public void ShowDialog(Control panel, Action onClose, double width = 480, bool scroll = true)
    {
        var card = new Border
        {
            Width = width,
            MaxHeight = 640,
            // Some room around the dialog when the window is small.
            Margin = new Thickness(16),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(24, 20),
            BorderThickness = new Thickness(1),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            BoxShadow = BoxShadows.Parse("0 8 32 0 #40000000"),
            Child = scroll ? new ScrollViewer { Content = panel } : panel,
        };
        card.Bind(Border.BackgroundProperty, card.GetResourceObservable("CsSurface"));
        card.Bind(Border.BorderBrushProperty, card.GetResourceObservable("CsBorder"));
        var backdrop = new Border { Background = new SolidColorBrush(Color.Parse("#66000000")) };
        backdrop.PointerPressed += (_, e) =>
        {
            if (e.Source == backdrop) onClose();
        };
        var layer = new Grid();
        layer.Children.Add(backdrop);
        layer.Children.Add(card);
        layer.KeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape)
            {
                e.Handled = true;
                onClose();
            }
        };
        dialogs.Children.Clear();
        dialogs.Children.Add(layer);
        dialogs.IsVisible = true;
        Dispatcher.UIThread.Post(() =>
        {
            // Focus the first focusable control in the dialog so Escape and Tab work at once.
            var first = panel.GetLogicalDescendants().OfType<Button>().FirstOrDefault();
            first?.Focus();
        }, DispatcherPriority.Input);
    }

    public void CloseDialog()
    {
        dialogs.Children.Clear();
        dialogs.IsVisible = false;
    }

    public bool DialogOpen => dialogs.IsVisible;

    /// <summary>A confirmation dialog with a title, a message and two buttons.</summary>
    public void Confirm(string title, string message, string confirmLabel, string cancelLabel, bool danger, Action onConfirm)
    {
        var panel = new StackPanel { Spacing = 12 };
        panel.Children.Add(new TextBlock { Text = title, FontSize = 19, FontWeight = FontWeight.Bold, TextWrapping = TextWrapping.Wrap });
        panel.Children.Add(new TextBlock { Text = message, TextWrapping = TextWrapping.Wrap, LineHeight = 22 });
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        var cancel = new Button { Content = cancelLabel };
        cancel.Classes.Add("secondary");
        cancel.Click += (_, _) => CloseDialog();
        var ok = new Button { Content = confirmLabel };
        ok.Classes.Add(danger ? "danger" : "primary");
        ok.Click += (_, _) =>
        {
            CloseDialog();
            onConfirm();
        };
        buttons.Children.Add(cancel);
        buttons.Children.Add(ok);
        panel.Children.Add(buttons);
        ShowDialog(panel, CloseDialog, 440);
    }

    /// <summary>A short notice at the bottom of the window that disappears by itself.</summary>
    public void Toast(string text, double seconds = 3.5)
    {
        var toast = new Border
        {
            Background = new SolidColorBrush(Color.Parse("#1c2026")),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16, 10),
            Child = new TextBlock { Text = text, Foreground = Brushes.White, FontWeight = FontWeight.SemiBold },
        };
        toasts.Children.Add(toast);
        DispatcherTimer.RunOnce(() => toasts.Children.Remove(toast), TimeSpan.FromSeconds(seconds));
    }
}
