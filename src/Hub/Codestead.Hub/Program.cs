using Avalonia;
using Codestead.UI.App;

namespace Codestead.Hub;

internal static class Program
{
    public static HubOptions Options { get; private set; } = new(false, null, null, null);

    /// <summary>
    /// --smoke-test: open the window and exit with "SMOKE OK" (installation tests).
    /// --smoke-test --catalog &lt;catalog.json&gt; --public-key &lt;pem&gt; --install &lt;id&gt;: also install that tool from the
    /// catalog, start it with --smoke-test, and uninstall it again (end-to-end test in the release workflow).
    /// </summary>
    [STAThread]
    public static int Main(string[] args)
    {
        Options = HubOptions.Parse(args);
        return AppHost.Run<App>(args, HubInfo.Meta);
    }

    /// <summary>Used by the Avalonia designer.</summary>
    public static AppBuilder BuildAvaloniaApp() => AppHost.Build<App>();
}
