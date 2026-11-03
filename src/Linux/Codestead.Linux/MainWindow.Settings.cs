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

// The settings dialog and resetting progress.
public sealed partial class MainWindow
{
    private void ApplyTheme() => ThemeSwitcher.Apply(state.Theme);

    private void ConfirmResetProgress()
    {
        overlay.Confirm(T("reset.progress.title"), T("reset.progress.confirm"), T("reset.progress.button"), T("dialog.cancel"), true, () =>
        {
            state.Progress = Js.Obj<bool>();
            state.Checkpoints = Js.Obj<bool>();
            state.Read = new();
            state.Attempts = Js.Obj<int>();
            state.HintSeen = new();
            state.Exams = Js.Obj<int>();
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

        // Distro
        panel.Children.Add(Text(T("settings.distro"), 15, FontWeight.SemiBold));
        var distros = new WrapPanel();
        foreach (var d in DistrosLib.Distros)
        {
            var b = new Button { Content = d.Name, Margin = new Thickness(0, 0, 8, 8) };
            b.Classes.Add("chip");
            if (d.Id == state.Distro) b.Classes.Add("active");
            var id = d.Id;
            b.Click += (_, _) =>
            {
                ChangeDistro(id);
                OpenSettings();
            };
            distros.Children.Add(b);
        }
        panel.Children.Add(distros);
        panel.Children.Add(Text(T("settings.distroNote"), 12.5, null, "muted"));

        // Danger zone
        var danger = new StackPanel { Spacing = 12 };
        danger.Children.Add(Text(T("settings.reset"), 15, FontWeight.SemiBold));
        danger.Children.Add(ResetRow(T("reset.terminal.title"), T("reset.terminal.desc", ("distro", Distro.Name)), T("reset.terminal.button"), ConfirmResetTerminal));
        danger.Children.Add(ResetRow(T("reset.progress.title"), T("reset.progress.desc"), T("reset.progress.button"), ConfirmResetProgress));
        var dangerBox = new Border { Padding = new Thickness(14), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Margin = new Thickness(0, 8, 0, 0), Child = danger };
        dangerBox.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsDanger"));
        panel.Children.Add(dangerBox);

        panel.Children.Add(SettingsSections.Close(T("dialog.close"), overlay.CloseDialog));
        panel.Children.Add(ChangelogEntries.Value.Count > 0
            ? SettingsSections.Version(ProductInfo.Meta, T("settings.whatsNew"), () => ShowNews(ChangelogEntries.Value.Take(5)))
            : SettingsSections.Version(ProductInfo.Meta));
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

    // ---------- Smoke test (installation tests) ----------
}
