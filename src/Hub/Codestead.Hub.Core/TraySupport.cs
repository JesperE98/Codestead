using System.Diagnostics;

namespace Codestead.Hub.Core;

/// <summary>
/// Whether the desktop shows tray icons. Windows and macOS always do; on Linux the desktop needs a
/// StatusNotifierItem host (KDE, Cinnamon, XFCE … do; GNOME only with the AppIndicator extension).
/// </summary>
public static class TraySupport
{
    private static readonly Lazy<bool> available = new(Detect);

    public static bool Available => available.Value;

    private static bool Detect()
    {
        if (!OperatingSystem.IsLinux()) return true;
        try
        {
            var psi = new ProcessStartInfo("dbus-send", "--session --print-reply --dest=org.freedesktop.DBus /org/freedesktop/DBus org.freedesktop.DBus.NameHasOwner string:org.kde.StatusNotifierWatcher")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            using var p = Process.Start(psi);
            if (p is null) return false;
            var output = p.StandardOutput.ReadToEnd();
            if (!p.WaitForExit(2000)) return false;
            return p.ExitCode == 0 && output.Contains("boolean true", StringComparison.Ordinal);
        }
        catch (Exception)
        {
            return false; // no dbus-send: assume no tray, so the hub never hides where it cannot be found
        }
    }
}
