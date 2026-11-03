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

// The settings dialog and resetting progress.
public partial class LearningWindow
{
    private void ApplyTheme() => ThemeSwitcher.Apply(state.Theme);

    private void ConfirmResetProgress()
    {
        overlay.Confirm(T("reset.progress.title"), T("reset.progress.confirm"), T("reset.progress.button"), T("dialog.cancel"), true, () =>
        {
            state.Progress = new(StringComparer.Ordinal);
            state.Checkpoints = new(StringComparer.Ordinal);
            state.Read = new();
            state.Attempts = new(StringComparer.Ordinal);
            state.HintSeen = new();
            state.Exams = new(StringComparer.Ordinal);
            ResetGame();
            SaveState();
            RenderAll();
            overlay.Toast(T("toast.progressReset"));
        });
    }

    private void OpenSettings()
    {
        var panel = new StackPanel { Spacing = 10 };
        panel.Children.Add(SettingsSections.Title(T("settings.title")));

        // Language
        panel.Children.Add(SettingsSections.Heading(T("settings.language")));
        panel.Children.Add(SettingsSections.Languages(Lang, code =>
        {
            ChangeLanguage(code);
            OpenSettings();
        }));
        if (Lang != "sv" && Lang != "en") panel.Children.Add(Text(T("settings.languageNote"), 12.5, null, "muted"));

        // Theme
        panel.Children.Add(SettingsSections.Heading(T("settings.theme")));
        panel.Children.Add(SettingsSections.Theme(state.Theme, T("theme.system"), T("theme.light"), T("theme.dark"), v =>
        {
            state.Theme = v;
            SaveState();
            ApplyTheme();
            OpenSettings();
        }));

        // Variant (Codestead Linux: the distribution)
        if (tool.AllVariants is { Count: > 0 } variants)
        {
            panel.Children.Add(Text(T("settings.distro"), 15, FontWeight.SemiBold));
            var chips = new WrapPanel();
            foreach (var v in variants)
            {
                var b = new Button { Content = v.Name, Margin = new Thickness(0, 0, 8, 8) };
                b.Classes.Add("chip");
                if (v.Id == state.Variant) b.Classes.Add("active");
                var id = v.Id;
                b.Click += (_, _) =>
                {
                    ChangeVariant(id);
                    OpenSettings();
                };
                chips.Children.Add(b);
            }
            panel.Children.Add(chips);
            panel.Children.Add(Text(T("settings.distroNote"), 12.5, null, "muted"));
        }

        // Danger zone
        var danger = new StackPanel { Spacing = 12 };
        danger.Children.Add(Text(T("settings.reset"), 15, FontWeight.SemiBold));
        foreach (var reset in tool.Resets()) danger.Children.Add(ResetRow(reset.Title, reset.Description, reset.Button, reset.Run));
        danger.Children.Add(ResetRow(T("reset.progress.title"), T("reset.progress.desc"), T("reset.progress.button"), ConfirmResetProgress));
        var dangerBox = new Border { Padding = new Thickness(14), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Margin = new Thickness(0, 8, 0, 0), Child = danger };
        dangerBox.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsDanger"));
        panel.Children.Add(dangerBox);

        panel.Children.Add(SettingsSections.Close(T("dialog.close"), overlay.CloseDialog));
        panel.Children.Add(tool.Changelog.Count > 0
            ? SettingsSections.Version(tool.Product, T("settings.whatsNew"), () => ShowNews(tool.Changelog.Take(5)))
            : SettingsSections.Version(tool.Product));
        overlay.ShowDialog(panel, overlay.CloseDialog, 640);
    }

    private static Control ResetRow(string title, string description, string button, Action onClick)
    {
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var text = new StackPanel { Spacing = 2, Margin = new Thickness(0, 0, 12, 0) };
        text.Children.Add(Text(title, 14, FontWeight.SemiBold));
        text.Children.Add(Text(description, 12.5, null, "muted"));
        grid.Children.Add(text);
        var b = new Button { Content = button, VerticalAlignment = VerticalAlignment.Center };
        b.Classes.Add("danger-outline");
        b.Click += (_, _) => onClick();
        Grid.SetColumn(b, 1);
        grid.Children.Add(b);
        return grid;
    }

}
