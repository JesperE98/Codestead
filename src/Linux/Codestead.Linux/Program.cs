using Avalonia;
using Codestead.UI.App;

namespace Codestead.Linux;

internal static class Program
{
    /// <summary>
    /// --smoke-test: start the real window, load every chapter, solve a task in the simulator,
    /// print "SMOKE OK" and exit with code 0. Used by the installation tests in the release pipeline.
    /// </summary>
    public static bool SmokeTest { get; private set; }

    [STAThread]
    public static int Main(string[] args)
    {
        SmokeTest = args.Contains("--smoke-test");
        return AppHost.Run<App>(args, ProductInfo.Meta);
    }

    /// <summary>Used by the Avalonia designer.</summary>
    public static AppBuilder BuildAvaloniaApp() => AppHost.Build<App>();
}
