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

// Checking the catalog and installing, opening, updating, rolling back and uninstalling tools.
public sealed partial class MainWindow
{
    // ---------- Actions ----------

    private async Task Refresh()
    {
        if (loading) return;
        loading = true;
        Render();
        try
        {
            var result = await catalogClient.LoadAsync();
            catalog = result.Catalog;
            catalogProblem = result.FromCache && result.Problem is not null ? T("catalog.offline", ("error", result.Problem)) : null;
            if (!result.FromCache) checkedAt = DateTime.UtcNow;
        }
        catch (CatalogException e)
        {
            catalogProblem = T("catalog.error", ("error", e.Message));
        }
        try
        {
            if (!options.SmokeTest && await selfUpdate.CheckAsync() is { } v) hubUpdate = v;
            // Installed as a native package: the catalog says whether there is a newer hub.
            if (!selfUpdate.CanUpdateItself && catalog?.Find(HubInfo.Id) is { } hub && SemVer.IsNewer(hub.Version, HubInfo.Version)) hubUpdate = hub.Version;
        }
        catch (Exception)
        {
            // The hub's own update check is best effort.
        }
        loading = false;
        Render();
    }

    /// <summary>True when the hub had saved settings at start (a missing "seen" version then means an update).</summary>
    private readonly bool existingUser;

    private static List<ChangelogEntry> Entries(CatalogTool tool) =>
        (tool.Changes ?? new()).Select(c => new ChangelogEntry { Version = c.Version, Date = c.Date, Changes = c.Changes }).ToList();

    /// <summary>The "What's new" dialog for a tool (or the hub itself).</summary>
    private void ShowNews(string name, IEnumerable<ChangelogEntry> entries) =>
        NewsDialog.Show(overlay, new WhatsNewTexts(T("whatsnew.title", ("name", name)), T("whatsnew.version"), T("whatsnew.close")), entries, Lang);

    private async Task<InstalledTool?> Install(CatalogTool tool, CatalogAsset asset)
    {
        var before = store.Installed(tool.Id)?.Version;
        busy[tool.Id] = 0;
        errors.Remove(tool.Id);
        Render();
        var progress = new Progress<double>(p =>
        {
            var pct = p >= 1 ? -1 : (int)(p * 100);
            if (busy.TryGetValue(tool.Id, out var old) && old == pct) return;
            busy[tool.Id] = pct;
            Render();
        });
        try
        {
            var installed = await Task.Run(() => store.InstallAsync(tool, asset, http, progress));
            overlay.Toast(T("tool.installed", ("version", installed.Version)) + " – " + tool.Name);
            // An update: show what changed here, and tell the tool so that it doesn't show the same news again
            // when it starts (the tools keep the version they have shown in their own storage).
            var news = before is null ? new List<ChangelogEntry>() : Changelog.Between(Entries(tool), before, installed.Version);
            Changelog.MarkSeen(new Storage(tool.Id), installed.Version);
            if (news.Count > 0) ShowNews(tool.Name, news);
            return installed;
        }
        catch (Exception e)
        {
            errors[tool.Id] = e.Message;
            return null;
        }
        finally
        {
            busy.Remove(tool.Id);
            Render();
        }
    }

    private void Open(string id, string name)
    {
        try
        {
            store.Launch(id, Array.Empty<string>());
        }
        catch (Exception e)
        {
            overlay.Toast(T("tool.startFailed", ("name", name), ("error", e.Message)));
        }
    }

    private void RollBack(string id)
    {
        store.RollBack(id);
        Render();
    }

    private void ConfirmUninstall(string id, string name)
    {
        overlay.Confirm(T("uninstall.title", ("name", name)), T("uninstall.text"), T("uninstall.button"), T("dialog.cancel"), true, () =>
        {
            try
            {
                store.Uninstall(id);
                errors.Remove(id);
            }
            catch (Exception e)
            {
                errors[id] = e.Message;
            }
            Render();
        });
    }

    private async void OpenUrl(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https") await Launcher.LaunchUriAsync(uri);
    }
}
