using System.Runtime.InteropServices;

namespace Codestead.Hub.Core;

public static class Platform
{
    /// <summary>The runtime id of this machine as used in the catalog ("win-x64", "linux-x64"), or null if unsupported.</summary>
    public static string? Rid =>
        RuntimeInformation.OSArchitecture != Architecture.X64 ? null
        : OperatingSystem.IsWindows() ? "win-x64"
        : OperatingSystem.IsLinux() ? "linux-x64"
        : null;

    /// <summary>
    /// Where the hub keeps installed tools: %LOCALAPPDATA%\Codestead on Windows,
    /// $XDG_DATA_HOME/codestead (~/.local/share/codestead) on Linux. CODESTEAD_HUB_DIR overrides it.
    /// </summary>
    public static string DataRoot()
    {
        var overridden = Environment.GetEnvironmentVariable("CODESTEAD_HUB_DIR");
        if (!string.IsNullOrEmpty(overridden)) return overridden;
        if (OperatingSystem.IsWindows())
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Codestead");
        var xdg = Environment.GetEnvironmentVariable("XDG_DATA_HOME");
        var baseDir = !string.IsNullOrEmpty(xdg) ? xdg : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "share");
        return Path.Combine(baseDir, "codestead");
    }
}
