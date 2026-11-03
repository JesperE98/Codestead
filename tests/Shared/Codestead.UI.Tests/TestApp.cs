using Avalonia;
using Avalonia.Headless;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Themes.Fluent;

namespace Codestead.UI.Tests;

/// <summary>A headless Avalonia app with the Codestead theme. Rendering uses Skia so frames can be captured.</summary>
public sealed class TestApp : Application
{
    public override void Initialize()
    {
        Styles.Add(new FluentTheme());
        Styles.Add(new Codestead.UI.Themes.CodesteadTheme());
    }

    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<TestApp>()
        .UseSkia()
        .WithInterFont()
        .UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false });
}

/// <summary>One headless Avalonia session shared by all UI tests; code runs on its UI thread via <see cref="Run"/>.</summary>
public static class Ui
{
    private static readonly Lazy<HeadlessUnitTestSession> Session = new(() => HeadlessUnitTestSession.StartNew(typeof(TestApp)));

    public static void Run(Action action) =>
        Session.Value.Dispatch(action, CancellationToken.None).GetAwaiter().GetResult();
}
