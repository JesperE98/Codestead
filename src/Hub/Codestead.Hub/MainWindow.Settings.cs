using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Hub.Core;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;

namespace Codestead.Hub;

// The theme and the settings dialog.
public sealed partial class MainWindow
{
    private void ApplyTheme() => ThemeSwitcher.Apply(state.Theme);

    private void OpenSettings()
    {
        var panel = new StackPanel { Spacing = 10 };
        panel.Children.Add(SettingsSections.Title(T("settings.title")));
        panel.Children.Add(SettingsSections.Heading(T("settings.language")));
        panel.Children.Add(SettingsSections.Languages(Lang, code =>
        {
            state.Lang = code;
            storage.Save("state", state);
            Render();
            OpenSettings();
        }, minWidth: 110));

        panel.Children.Add(SettingsSections.Heading(T("settings.theme")));
        panel.Children.Add(SettingsSections.Theme(state.Theme, T("theme.system"), T("theme.light"), T("theme.dark"), v =>
        {
            state.Theme = v;
            storage.Save("state", state);
            ApplyTheme();
            OpenSettings();
        }));

        panel.Children.Add(SettingsSections.Heading(T("settings.folder")));
        var folder = new SelectableTextBlock { Text = store.Root, FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, monospace"), FontSize = 13, TextWrapping = TextWrapping.Wrap, FlowDirection = FlowDirection.LeftToRight };
        panel.Children.Add(folder);

        panel.Children.Add(SettingsSections.Close(T("dialog.close"), overlay.CloseDialog));
        panel.Children.Add(SettingsSections.Version(HubInfo.Meta));
        overlay.ShowDialog(panel, overlay.CloseDialog, 600);
    }
}
