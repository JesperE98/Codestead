using Avalonia;
using Avalonia.Media;
using Codestead.Common;
using Velopack;

namespace Codestead.UI.App;

/// <summary>The start of every Codestead app: installer hooks, --version, and the Avalonia app with the bundled font.</summary>
public static class AppHost
{
    /// <summary>
    /// Runs Velopack's install/update hooks (it exits when started for one of them), answers --version, and otherwise
    /// starts the app.
    /// </summary>
    public static int Run<TApp>(string[] args, ProductMeta product) where TApp : Application, new()
    {
        VelopackApp.Build().Run();
        if (args.Contains("--version"))
        {
            Console.WriteLine(product.Version);
            return 0;
        }
        return Build<TApp>().StartWithClassicDesktopLifetime(args);
    }

    /// <summary>
    /// The Avalonia app. The bundled Inter font is the default, so it also starts on systems without any fonts
    /// installed (minimal Arch/CachyOS installations, containers); other scripts fall back to system fonts.
    /// </summary>
    public static AppBuilder Build<TApp>() where TApp : Application, new() => AppBuilder.Configure<TApp>()
        .UsePlatformDetect()
        .WithInterFont()
        .With(new FontManagerOptions { DefaultFamilyName = "fonts:Inter#Inter" })
        .LogToTrace();
}
