// The update button of an installed C# Codestead app, without its window (packaging/upgrade-test.sh and
// upgrade-test-windows.ps1): what Codestead.UI.SelfUpdate does when the learner clicks "Update" – Velopack's
// UpdateManager on a plain web feed, CheckForUpdatesAsync, DownloadUpdatesAsync, ApplyUpdatesAndRestart – with the same
// Velopack version as the apps, but run against an installed app (named by its executable) and a local feed.
//
// Velopack finds the installation from the path of the running executable (its locators: on Windows Update.exe next to
// the "current" folder, on Linux the AppImage's usr/bin with UpdateNix and $APPIMAGE). Here that path is the installed
// app's executable instead of this program's, so the locator, the packages folder, the channel, the installed version
// and the updater are the installed app's own; the updater waits for this process to exit, as for the app.
//
// Usage: Codestead.UpgradeDriver --app <installed executable> --feed <url> [--expect <version>] [--silent]
//          [-- <arguments for the restarted app>]
//   --silent: the updater shows no progress window or dialog (Windows runners: an error would otherwise wait in a
//   dialog); without it the call is exactly the app's ApplyUpdatesAndRestart.
using Velopack;
using Velopack.Locators;
using Velopack.Logging;

string? app = null, feed = null, expect = null;
bool silent = false;
var restartArgs = new List<string>();
for (int i = 0; i < args.Length; i++)
{
    switch (args[i])
    {
        case "--app": app = args[++i]; break;
        case "--feed": feed = args[++i]; break;
        case "--expect": expect = args[++i]; break;
        case "--silent": silent = true; break;
        case "--": restartArgs.AddRange(args[(i + 1)..]); i = args.Length; break;
        default: return Fail($"Unknown argument: {args[i]}");
    }
}
if (app is null || feed is null) return Fail("Usage: Codestead.UpgradeDriver --app <installed executable> --feed <url> [--expect <version>] [--silent] [-- <restart args>]");

IVelopackLogger log = new ConsoleVelopackLogger();
var process = new InstalledAppProcess(Path.GetFullPath(app), log);
IVelopackLocator locator = OperatingSystem.IsWindows() ? new WindowsVelopackLocator(process, log)
    : OperatingSystem.IsLinux() ? new LinuxVelopackLocator(process, log)
    : throw new PlatformNotSupportedException();

// As SelfUpdate: new UpdateManager(<feed url>) – a string, so a SimpleWebSource.
var manager = new UpdateManager(feed, null, locator);
Console.WriteLine($"Installed: {manager.AppId} {manager.CurrentVersion} (channel {locator.Channel}) in {locator.RootAppDir}");
Console.WriteLine($"Updater: {locator.UpdateExePath}; packages: {locator.PackagesDir}");
if (!manager.IsInstalled) return Fail($"Velopack does not see an installation at {app}.");

var update = await manager.CheckForUpdatesAsync();
if (update is null) return Fail($"No update found in {feed}.");
var target = update.TargetFullRelease;
Console.WriteLine($"Update: {target.PackageId} {target.Version} ({target.FileName}, {target.Size} bytes)");
if (expect is not null && target.Version.ToString() != expect) return Fail($"Expected the update {expect}, found {target.Version}.");

int shown = -1;
await manager.DownloadUpdatesAsync(update, p =>
{
    if (p / 25 == shown) return;
    shown = p / 25;
    Console.WriteLine($"Downloading: {p}%");
});
Console.WriteLine($"Downloaded to {locator.PackagesDir}; applying and restarting ({(restartArgs.Count == 0 ? "no arguments" : string.Join(' ', restartArgs))})");
Console.Out.Flush();
if (silent)
{
    // ApplyUpdatesAndRestart without the progress window and dialogs.
    manager.WaitExitThenApplyUpdates(target, silent: true, restart: true, restartArgs.ToArray());
    return 0;
}
manager.ApplyUpdatesAndRestart(target, restartArgs.ToArray()); // exits
return 0;

static int Fail(string message)
{
    Console.Error.WriteLine($"UPGRADE DRIVER FAILED: {message}");
    return 1;
}

/// <summary>This process, as Velopack sees it, but with the installed app's executable as its path.</summary>
sealed class InstalledAppProcess(string executable, IVelopackLogger log) : IProcessImpl
{
    private readonly DefaultProcessImpl real = new(log);

    public string GetCurrentProcessPath() => executable;
    public uint GetCurrentProcessId() => real.GetCurrentProcessId();
    public void StartProcess(string exePath, IEnumerable<string> args, string workDir, bool showWindow) => real.StartProcess(exePath, args, workDir, showWindow);
    public void Exit(int exitCode) => Environment.Exit(exitCode);
}
