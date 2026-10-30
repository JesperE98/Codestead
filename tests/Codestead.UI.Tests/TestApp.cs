using Avalonia;
using Avalonia.Headless;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Themes.Fluent;

[assembly: AvaloniaTestApplication(typeof(Codestead.UI.Tests.TestApp))]

namespace Codestead.UI.Tests;

/// <summary>A headless Avalonia app with the Codestead theme. Rendering uses Skia so frames can be captured.</summary>
public sealed class TestApp : Application
{
    public override void Initialize()
    {
        Styles.Add(new FluentTheme());
        Styles.Add(new StyleInclude(new Uri("avares://Codestead.UI.Tests/")) { Source = new Uri("avares://Codestead.UI/Themes/Codestead.axaml") });
    }

    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<TestApp>()
        .UseSkia()
        .WithInterFont()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false });
}
