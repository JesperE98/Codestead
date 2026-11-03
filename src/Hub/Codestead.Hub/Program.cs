using Avalonia;
using Avalonia.Media;
using Velopack;

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
        VelopackApp.Build().Run();
        if (args.Contains("--version"))
        {
            Console.WriteLine(HubInfo.Version);
            return 0;
        }
        Options = HubOptions.Parse(args);
        return BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UsePlatformDetect()
        .WithInterFont()
        .With(new FontManagerOptions { DefaultFamilyName = "fonts:Inter#Inter" })
        .LogToTrace();
}
