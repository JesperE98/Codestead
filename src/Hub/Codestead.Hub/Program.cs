using Avalonia;
using Codestead.Hub.Core;
using Codestead.UI.App;
using Velopack;

namespace Codestead.Hub;

internal static class Program
{
    public static HubOptions Options { get; private set; } = new(false, null, null, null);

    /// <summary>Listens for later starts of the hub (null in the smoke test).</summary>
    public static SingleInstance? Instance { get; private set; }

    /// <summary>
    /// --smoke-test: open the window and exit with "SMOKE OK" (installation tests).
    /// --smoke-test --catalog &lt;catalog.json&gt; --public-key &lt;pem&gt; --install &lt;id&gt;: also install that tool from the
    /// catalog, start it with --smoke-test, and uninstall it again (end-to-end test in the release workflow).
    /// </summary>
    [STAThread]
    public static int Main(string[] args)
    {
        // Velopack's install/update hooks; it exits when started for one of them. It must be called here, in the
        // app's own assembly, because `vpk pack` checks for it.
        VelopackApp.Build().Run();
        Options = HubOptions.Parse(args);
        // One hub per user: a second start shows the first one (not in the installation tests).
        return AppHost.Run<App>(args, HubInfo.Meta, () => Options.SmokeTest || !(Instance = new SingleInstance(HubInfo.Id)).NotifyRunning());
    }

    /// <summary>Used by the Avalonia designer.</summary>
    public static AppBuilder BuildAvaloniaApp() => AppHost.Build<App>();
}
