using Velopack;

namespace Codestead.UI;

/// <summary>
/// An app's own updates. Installed with Setup.exe (Windows) or as an AppImage, it updates itself with
/// Velopack from the release "&lt;id&gt;-latest" in the releases repository. Installed as a .deb/.rpm/Arch
/// package (or by the hub), something else owns the files, so <see cref="CanUpdateItself"/> is false.
/// </summary>
public sealed class SelfUpdate
{
    private readonly UpdateManager? manager;
    private UpdateInfo? pending;

    /// <param name="releasesRepo">"owner/repo" of the public releases repository.</param>
    /// <param name="packageId">The Velopack package id, e.g. "codestead-hub".</param>
    public SelfUpdate(string releasesRepo, string packageId)
    {
        try
        {
            var mgr = new UpdateManager($"https://github.com/{releasesRepo}/releases/download/{packageId}-latest/");
            if (mgr.IsInstalled) manager = mgr;
        }
        catch (Exception)
        {
            // Not installed by Velopack (development build, native package) – no self-update.
        }
    }

    /// <summary>True when the hub can download and apply its own updates.</summary>
    public bool CanUpdateItself => manager is not null;

    /// <summary>The newer version available, or null.</summary>
    public async Task<string?> CheckAsync()
    {
        if (manager is null) return null;
        pending = await manager.CheckForUpdatesAsync();
        return pending?.TargetFullRelease.Version.ToString();
    }

    public async Task DownloadAndRestartAsync(Action<int> progress)
    {
        if (manager is null || pending is null) return;
        await manager.DownloadUpdatesAsync(pending, progress);
        manager.ApplyUpdatesAndRestart(pending.TargetFullRelease);
    }
}
