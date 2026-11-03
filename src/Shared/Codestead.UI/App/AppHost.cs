using Avalonia;
using Avalonia.Media;
using Codestead.Common;

namespace Codestead.UI.App;

/// <summary>The start of every Codestead app: --version and the Avalonia app with the bundled font.</summary>
public static class AppHost
{
    /// <summary>
    /// Answers --version and otherwise starts the app. Call <c>VelopackApp.Build().Run()</c> in the app's own
    /// <c>Program.Main</c> first: Velopack's packager checks for that call in the app's own assembly.
    /// </summary>
    /// <param name="shouldStart">Asked after the installer hooks: false ends here (e.g. the app already runs).</param>
    public static int Run<TApp>(string[] args, ProductMeta product, Func<bool>? shouldStart = null) where TApp : Application, new()
    {
        if (args.Contains("--version"))
        {
            Console.WriteLine(product.Version);
            return 0;
        }
        if (shouldStart is not null && !shouldStart()) return 0;
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
