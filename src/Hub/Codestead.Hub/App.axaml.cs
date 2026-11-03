using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using Codestead.Hub.Core;

namespace Codestead.Hub;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
        // The tool's own accent colour (the meaning colours come from the shared theme).
        Codestead.UI.Themes.Brand.Hub.ApplyTo(Resources);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // ~ with a dead key (Swedish and many other keyboards) on Linux, see DeadKeys.
        Codestead.UI.DeadKeys.Install();
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var window = new MainWindow(Program.Options);
            // The hub can live in the tray with its window hidden, so it ends when the window really closes.
            desktop.ShutdownMode = ShutdownMode.OnExplicitShutdown;
            window.Closed += (_, _) => desktop.Shutdown();
            // A later start of the hub shows this one.
            Program.Instance?.Listen(() => Dispatcher.UIThread.Post(window.ShowFromBackground));
            if (Program.Options.Background && TraySupport.Available)
            {
                // Started at login: only the tray icon.
                window.HideToBackground();
            }
            else
            {
                if (Program.Options.Background) window.WindowState = WindowState.Minimized;
                desktop.MainWindow = window;
            }
        }
        base.OnFrameworkInitializationCompleted();
    }
}
