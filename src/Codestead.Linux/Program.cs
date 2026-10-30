using Avalonia;
using Velopack;

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
        // Velopack (installer and auto-update) runs its install/update hooks here and exits if it was one of them.
        VelopackApp.Build().Run();
        SmokeTest = args.Contains("--smoke-test");
        if (args.Contains("--version"))
        {
            Console.WriteLine(ProductInfo.Version);
            return 0;
        }
        return BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>()
        .UsePlatformDetect()
        .WithInterFont()
        .LogToTrace();
}
