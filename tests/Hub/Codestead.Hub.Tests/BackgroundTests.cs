using Codestead.Hub.Core;

namespace Codestead.Hub.Tests;

public class BackgroundTests
{
    [Fact(DisplayName = "autostart skriver och tar bort .desktop-filen (Linux)")]
    public void AutostartDesktopFile()
    {
        if (!OperatingSystem.IsLinux()) return;
        var dir = Directory.CreateTempSubdirectory("codestead-autostart-").FullName;
        try
        {
            var autostart = new Autostart("codestead-hub-test", dir);
            Assert.False(autostart.IsEnabled);
            autostart.Enable("Codestead", "/opt/my apps/codestead-hub", "--background");
            Assert.True(autostart.IsEnabled);
            var text = File.ReadAllText(autostart.DesktopFile);
            Assert.Contains("Exec=\"/opt/my apps/codestead-hub\" --background", text);
            Assert.Contains("Name=Codestead", text);
            autostart.Disable();
            Assert.False(autostart.IsEnabled);
            autostart.Disable(); // already off: nothing happens
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact(DisplayName = "en andra start av hubben visar den första")]
    public async Task SecondStartShowsTheFirst()
    {
        var name = $"codestead-hub-test-{Guid.NewGuid():N}";
        using var first = new SingleInstance(name);
        Assert.False(first.NotifyRunning()); // nobody listens yet: this is the first hub
        var shown = new TaskCompletionSource();
        first.Listen(() => shown.TrySetResult());
        await Task.Delay(200);
        using var second = new SingleInstance(name);
        Assert.True(second.NotifyRunning());
        await shown.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }
}
