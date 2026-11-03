namespace Codestead.Hub;

/// <summary>Settings saved between runs.</summary>
public sealed class HubState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
    /// <summary>Hide in the tray (or minimise) when a tool is opened, and come back when it closes.</summary>
    public bool HideOnToolOpen { get; set; } = true;
    /// <summary>The close button hides the hub in the tray instead of quitting.</summary>
    public bool CloseToTray { get; set; }
    /// <summary>Look for new versions while the hub is open (every few hours).</summary>
    public bool AutoCheckUpdates { get; set; } = true;
    /// <summary>Install tool updates by itself (never while the tool runs).</summary>
    public bool AutoInstallUpdates { get; set; }
}
