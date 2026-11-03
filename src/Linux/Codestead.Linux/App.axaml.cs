using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace Codestead.Linux;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
        // The tool's own accent colour (the meaning colours come from the shared theme).
        Codestead.UI.Themes.Brand.Linux.ApplyTo(Resources);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // ~ with a dead key (Swedish and many other keyboards) on Linux, see DeadKeys.
        Codestead.UI.DeadKeys.Install();
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow(Program.SmokeTest);
        }
        base.OnFrameworkInitializationCompleted();
    }
}
