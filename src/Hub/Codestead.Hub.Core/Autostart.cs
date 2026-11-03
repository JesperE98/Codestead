using System.Runtime.Versioning;

namespace Codestead.Hub.Core;

/// <summary>
/// Starting an app when the user logs in: on Windows a value under HKCU\Software\Microsoft\Windows\CurrentVersion\Run,
/// on Linux a .desktop file in ~/.config/autostart (the freedesktop autostart standard).
/// </summary>
public sealed class Autostart(string appId, string? configHome = null)
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

    /// <summary>The Linux autostart file.</summary>
    public string DesktopFile => Path.Combine(ConfigHome, "autostart", appId + ".desktop");

    private string ConfigHome =>
        configHome
        ?? (Environment.GetEnvironmentVariable("XDG_CONFIG_HOME") is { Length: > 0 } xdg ? xdg
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config"));

    /// <summary>Starting at login is possible on this system.</summary>
    public static bool Supported => OperatingSystem.IsWindows() || OperatingSystem.IsLinux();

    public bool IsEnabled => OperatingSystem.IsWindows() ? WindowsValue() is not null : File.Exists(DesktopFile);

    /// <summary>Starts <paramref name="executable"/> with <paramref name="arguments"/> at login.</summary>
    public void Enable(string name, string executable, string arguments)
    {
        if (OperatingSystem.IsWindows())
        {
            SetWindowsValue($"\"{executable}\" {arguments}".TrimEnd());
            return;
        }
        Directory.CreateDirectory(Path.GetDirectoryName(DesktopFile)!);
        File.WriteAllText(DesktopFile, $"""
            [Desktop Entry]
            Type=Application
            Name={name}
            Exec={Quote(executable)} {arguments}
            X-GNOME-Autostart-enabled=true
            NoDisplay=true

            """);
    }

    public void Disable()
    {
        if (OperatingSystem.IsWindows())
        {
            SetWindowsValue(null);
            return;
        }
        if (File.Exists(DesktopFile)) File.Delete(DesktopFile);
    }

    /// <summary>A path for the Exec line of a .desktop file (quoted when it has spaces).</summary>
    private static string Quote(string path) => path.Contains(' ') ? $"\"{path.Replace("\"", "\\\"")}\"" : path;

    [SupportedOSPlatform("windows")]
    private string? WindowsValue()
    {
        using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RunKey);
        return key?.GetValue(appId) as string;
    }

    [SupportedOSPlatform("windows")]
    private void SetWindowsValue(string? value)
    {
        using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(RunKey);
        if (value is null) key.DeleteValue(appId, throwOnMissingValue: false);
        else key.SetValue(appId, value);
    }
}
