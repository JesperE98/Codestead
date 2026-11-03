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
using System.Diagnostics;

namespace Codestead.Hub;

// The hub in the background: the tray icon, hiding while a tool runs, the close button, starting at login,
// and installing tool updates by itself.
public sealed partial class MainWindow
{
    private HubTray? tray;
    private bool quitting;
    /// <summary>Hidden because a tool was opened: show again when the last one closes.</summary>
    private bool hiddenForTools;
    /// <summary>The tools started from the hub that still run (id → process).</summary>
    private readonly Dictionary<string, Process> running = new();
    private readonly Autostart autostart = new(HubInfo.Id);

    private void SetUpBackground()
    {
        if (options.SmokeTest) return;
        if (TraySupport.Available)
        {
            tray = new HubTray(Icon, HubInfo.Name);
            tray.ShowRequested += ShowFromBackground;
            tray.QuitRequested += Quit;
            tray.OpenRequested += id => Open(id, catalog?.Find(id)?.Name ?? id);
        }
        Closing += (_, e) =>
        {
            if (quitting || !state.CloseToTray) return;
            e.Cancel = true;
            HideToBackground();
        };
    }

    /// <summary>Hides the window in the tray, or minimises it where there is no tray (so it can always be found).</summary>
    public void HideToBackground()
    {
        if (tray is null)
        {
            WindowState = WindowState.Minimized;
            return;
        }
        tray.SetMenu(T("tray.show"), store.All().Select(t => (t.Id, T("tray.open", ("name", catalog?.Find(t.Id)?.Name ?? t.Id)))), T("tray.quit"));
        tray.Visible = true;
        Hide();
    }

    /// <summary>Shows the window again (tray click, a second start of the hub, or the last tool closed).</summary>
    public void ShowFromBackground()
    {
        hiddenForTools = false;
        Show();
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Activate();
        if (tray is not null) tray.Visible = false;
        Render();
    }

    private void Quit()
    {
        quitting = true;
        tray?.Dispose();
        Close();
    }

    /// <summary>A tool was started: hide while it runs (if the setting says so) and come back when it closes.</summary>
    private void Started(string id, Process process)
    {
        running[id] = process;
        process.EnableRaisingEvents = true;
        process.Exited += (_, _) => Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            running.Remove(id);
            if (hiddenForTools && running.Count == 0) ShowFromBackground();
            else Render();
        });
        if (process.HasExited) return;
        if (state.HideOnToolOpen && !options.SmokeTest)
        {
            hiddenForTools = true;
            HideToBackground();
        }
    }

    /// <summary>Starting at login: the hub starts in the background (tray or minimised).</summary>
    private bool StartsWithComputer
    {
        get => autostart.IsEnabled;
        set
        {
            if (value) autostart.Enable(HubInfo.Name, Environment.GetEnvironmentVariable("APPIMAGE") ?? Environment.ProcessPath ?? "", "--background");
            else autostart.Disable();
        }
    }

    /// <summary>Installs the tool updates the catalog has, except for tools that are running or busy.</summary>
    private async Task InstallUpdatesByItself()
    {
        if (!state.AutoInstallUpdates || options.SmokeTest || catalog is null || Platform.Rid is not { } rid) return;
        foreach (var installed in store.All().ToList())
        {
            if (running.ContainsKey(installed.Id) || busy.ContainsKey(installed.Id)) continue;
            if (catalog.Find(installed.Id) is not { } tool || tool.AssetFor(rid) is not { } asset || !SemVer.IsNewer(tool.Version, installed.Version)) continue;
            if (await Install(tool, asset) is { } done && tray is not null)
                tray.ToolTip = T("tool.autoUpdated", ("name", tool.Name), ("version", done.Version));
        }
    }
}
