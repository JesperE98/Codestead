using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.Terminal;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

// "What's new" after an update and the offer to update.
public sealed partial class MainWindow
{
    /// <summary>
    /// Installed with Setup.exe or as an AppImage, the app updates itself (Velopack). Installed by the hub or
    /// as a native package, the hub or the package manager does it instead.
    /// </summary>
    /// <summary>True when the app had saved progress at start (so a missing "seen" version means an update, not a new installation).</summary>
    private readonly bool existingUser;

    /// <summary>The changelog embedded in the app.</summary>
    private static readonly Lazy<List<ChangelogEntry>> ChangelogEntries = new(() => Changelog.Embedded(typeof(MainWindow).Assembly));

    /// <summary>Shows "What's new" if the app was updated since it last ran. Returns false if there was nothing to show.</summary>
    private bool ShowNewsAfterUpdate()
    {
        var news = Changelog.NewsAtStart(storage, ChangelogEntries.Value, ProductInfo.Version, existingUser);
        if (news.Count == 0) return false;
        ShowNews(news, () => _ = OfferUpdate());
        return true;
    }

    /// <summary>The "What's new" dialog for some versions (newest first).</summary>
    private void ShowNews(IEnumerable<ChangelogEntry> entries, Action? afterClose = null) =>
        NewsDialog.Show(overlay, new WhatsNewTexts(T("whatsnew.title", ("name", ProductInfo.Name)), T("whatsnew.version"), T("whatsnew.close")), entries, Lang, afterClose);

    private async Task OfferUpdate()
    {
        var updater = new SelfUpdate(ProductInfo.ReleasesRepo, ProductInfo.ToolId);
        if (!updater.CanUpdateItself) return;
        string? version;
        try
        {
            version = await updater.CheckAsync();
        }
        catch (Exception)
        {
            return; // Offline or the release server is unavailable – try again next start.
        }
        if (version is null) return;
        overlay.ShowWhenFree(() => overlay.Confirm(T("update.title"), T("update.text", ("version", version)), T("update.button"), T("update.later"), false, async () =>
        {
            overlay.Toast(T("update.downloading"), 30);
            try
            {
                SaveAll();
                await updater.DownloadAndRestartAsync(_ => { });
            }
            catch (Exception e)
            {
                overlay.Toast(e.Message);
            }
        }));
    }
}
