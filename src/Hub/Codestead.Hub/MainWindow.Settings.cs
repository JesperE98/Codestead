using Avalonia.Automation;
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

        // General: the tray, starting at login, updates
        panel.Children.Add(SettingsSections.Heading(T("settings.general")));
        panel.Children.Add(Toggle(T("settings.hideOnToolOpen"), state.HideOnToolOpen, v => state.HideOnToolOpen = v));
        panel.Children.Add(Toggle(T("settings.closeToTray"), state.CloseToTray, v => state.CloseToTray = v));
        if (!TraySupport.Available) panel.Children.Add(Text(T("settings.noTray"), 12.5, null, "muted"));
        if (Autostart.Supported) panel.Children.Add(Toggle(T("settings.startWithComputer"), StartsWithComputer, v => StartsWithComputer = v));
        panel.Children.Add(Toggle(T("settings.autoCheck"), state.AutoCheckUpdates, v => state.AutoCheckUpdates = v));
        panel.Children.Add(Toggle(T("settings.autoInstall"), state.AutoInstallUpdates, v =>
        {
            state.AutoInstallUpdates = v;
            if (v) _ = InstallUpdatesByItself();
        }));

        panel.Children.Add(SettingsSections.Heading(T("settings.folder")));
        var folder = new SelectableTextBlock { Text = store.Root, FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, monospace"), FontSize = 13, TextWrapping = TextWrapping.Wrap, FlowDirection = FlowDirection.LeftToRight };
        panel.Children.Add(folder);

        panel.Children.Add(SettingsSections.Close(T("dialog.close"), overlay.CloseDialog));
        panel.Children.Add(SettingsSections.Version(HubInfo.Meta));
        overlay.ShowDialog(panel, overlay.CloseDialog, 600);
    }

    /// <summary>A setting that is on or off: its text and a switch; a change is saved at once.</summary>
    private Control Toggle(string label, bool value, Action<bool> set)
    {
        var row = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var text = Text(label, 14);
        text.VerticalAlignment = VerticalAlignment.Center;
        text.Margin = new Thickness(0, 0, 12, 0);
        row.Children.Add(text);
        var toggle = new ToggleSwitch { IsChecked = value, OnContent = "", OffContent = "", VerticalAlignment = VerticalAlignment.Center };
        AutomationProperties.SetName(toggle, label);
        toggle.IsCheckedChanged += (_, _) =>
        {
            set(toggle.IsChecked == true);
            storage.Save("state", state);
        };
        Grid.SetColumn(toggle, 1);
        row.Children.Add(toggle);
        return row;
    }
}
