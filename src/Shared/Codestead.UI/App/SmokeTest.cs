using Avalonia.Controls;
using Codestead.Common;

namespace Codestead.UI.App;

/// <summary>
/// The --smoke-test of every app (installation tests in the release flow): runs the app's own checks, prints
/// "SMOKE OK name version (details)" or "SMOKE FAILED: …", sets the exit code and closes the window.
/// </summary>
public static class SmokeTest
{
    public static void Run(Window window, ProductMeta product, Func<string> checks) =>
        Finish(window, product, () => Task.FromResult(checks())).GetAwaiter().GetResult();

    public static Task RunAsync(Window window, ProductMeta product, Func<Task<string>> checks) => Finish(window, product, checks);

    private static async Task Finish(Window window, ProductMeta product, Func<Task<string>> checks)
    {
        int code = 0;
        try
        {
            var details = await checks();
            Console.WriteLine($"SMOKE OK {product.Name} {product.Version} ({details})");
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("SMOKE FAILED: " + e);
            code = 1;
        }
        Environment.ExitCode = code;
        window.Close();
    }
}
