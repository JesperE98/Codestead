using Avalonia;
using Avalonia.Controls;

namespace Codestead.Hub;

/// <summary>The hub's icon in the system tray, shown while the window is hidden: click to show, or use its menu.</summary>
public sealed class HubTray : IDisposable
{
    private readonly TrayIcon icon;

    public event Action? ShowRequested;
    public event Action? QuitRequested;
    /// <summary>A tool chosen in the menu (its id).</summary>
    public event Action<string>? OpenRequested;

    public HubTray(WindowIcon? windowIcon, string tooltip)
    {
        icon = new TrayIcon { Icon = windowIcon, ToolTipText = tooltip, IsVisible = false };
        icon.Clicked += (_, _) => ShowRequested?.Invoke();
        if (Application.Current is { } app) TrayIcon.SetIcons(app, new TrayIcons { icon });
    }

    public bool Visible
    {
        get => icon.IsVisible;
        set => icon.IsVisible = value;
    }

    public string ToolTip
    {
        set => icon.ToolTipText = value;
    }

    /// <summary>"Show", one entry per installed tool, and "Quit".</summary>
    public void SetMenu(string show, IEnumerable<(string Id, string Label)> tools, string quit)
    {
        var menu = new NativeMenu();
        var showItem = new NativeMenuItem(show);
        showItem.Click += (_, _) => ShowRequested?.Invoke();
        menu.Items.Add(showItem);
        var toolItems = tools.ToList();
        if (toolItems.Count > 0) menu.Items.Add(new NativeMenuItemSeparator());
        foreach (var (id, label) in toolItems)
        {
            var item = new NativeMenuItem(label);
            item.Click += (_, _) => OpenRequested?.Invoke(id);
            menu.Items.Add(item);
        }
        menu.Items.Add(new NativeMenuItemSeparator());
        var quitItem = new NativeMenuItem(quit);
        quitItem.Click += (_, _) => QuitRequested?.Invoke();
        menu.Items.Add(quitItem);
        icon.Menu = menu;
    }

    public void Dispose()
    {
        icon.IsVisible = false;
        icon.Dispose();
    }
}
