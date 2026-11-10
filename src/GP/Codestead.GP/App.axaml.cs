using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using Codestead.UI.Themes;

namespace Codestead.GP;

public partial class App : Application
{
    /// <summary>Codestead GP's accent colour: the orange of the first triangle (1.0, 0.5, 0.2).</summary>
    public static readonly Brand GpBrand = new("gp",
        new(Color.Parse("#c2410c"), Color.Parse("#fde4d3"), Colors.White),
        new(Color.Parse("#fb923c"), Color.Parse("#3a1f10"), Color.Parse("#2a1205")));

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
        GpBrand.ApplyTo(Resources);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // ~ with a dead key (Swedish and many other keyboards) on Linux, see DeadKeys.
        Codestead.UI.DeadKeys.Install();
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            desktop.MainWindow = new Codestead.Learning.UI.LearningWindow(new GpTool(), Program.SmokeTest);
        base.OnFrameworkInitializationCompleted();
    }
}
