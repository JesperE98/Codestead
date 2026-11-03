using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Hub.Core;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;

namespace Codestead.Hub;

// The --smoke-test of the installation tests (also the end-to-end test with a tool).
public sealed partial class MainWindow
{
    // ---------- Smoke test (installation tests) ----------

    private Task RunSmokeTest() => SmokeTest.RunAsync(this, HubInfo.Meta, async () =>
    {
        foreach (var l in HubStrings.Languages)
        {
            state.Lang = l.Code;
            Render();
        }
        state.Lang = "en";
        var detail = "";
        if (options.Catalog is not null)
        {
            await Refresh();
            if (catalog is null) throw new InvalidOperationException(catalogProblem ?? "no catalog");
            if (options.Install is { } id)
            {
                var tool = catalog.Find(id) ?? throw new InvalidOperationException($"{id} is not in the catalog.");
                var asset = tool.AssetFor(Platform.Rid ?? "") ?? throw new InvalidOperationException($"{id} has no package for {Platform.Rid}.");
                var installed = await Install(tool, asset) ?? throw new InvalidOperationException(errors.GetValueOrDefault(id, "install failed"));
                using (var p = store.Launch(id, new[] { "--smoke-test" }, captureOutput: true))
                {
                    var output = await p.StandardOutput.ReadToEndAsync();
                    await p.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(3)).Token);
                    p.WaitForExit(); // also waits until the output is fully read and the process is gone
                    Console.WriteLine(output.Trim());
                    if (p.ExitCode != 0 || !output.Contains("SMOKE OK")) throw new InvalidOperationException($"{id} --smoke-test failed (exit {p.ExitCode}).");
                }
                store.Uninstall(id);
                if (store.Installed(id) is not null) throw new InvalidOperationException($"{id} is still installed after uninstalling.");
                detail = $", installed, started and removed {id} {installed.Version}";
            }
        }
        return $"{HubStrings.Languages.Count} languages{detail}";
    });
}
