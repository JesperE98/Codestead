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

// The layout and rendering of the page: the update banner and the tool cards.
public sealed partial class MainWindow
{
    // ---------- Layout ----------

    private Control BuildLayout()
    {
        // The Codestead logo (build/icons/codestead-hub.svg): a house with a prompt inside.
        var mark = new Image
        {
            Source = new Bitmap(AssetLoader.Open(new Uri("avares://Codestead.Hub/Assets/icon.png"))),
            Width = 34,
            Height = 34,
        };
        RenderOptions.SetBitmapInterpolationMode(mark, Avalonia.Media.Imaging.BitmapInterpolationMode.HighQuality);
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        brand.Children.Add(mark);
        brand.Children.Add(brandName);
        settingsButton.Classes.Add("flat");
        settingsButton.Click += (_, _) => OpenSettings();
        var bar = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        bar.Children.Add(brand);
        Grid.SetColumn(settingsButton, 1);
        bar.Children.Add(settingsButton);
        var top = new Border { Padding = new Thickness(20, 10), BorderThickness = new Thickness(0, 0, 0, 1), Child = bar };
        top.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSurface"));
        top.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));

        var dock = new DockPanel();
        DockPanel.SetDock(top, Dock.Top);
        dock.Children.Add(top);
        dock.Children.Add(new ScrollViewer { Content = page });
        return dock;
    }

    private Button Action(string label, string cls, Action onClick, bool enabled = true)
    {
        var b = new Button { Content = label, IsEnabled = enabled };
        b.Classes.Add(cls);
        b.Click += (_, _) => onClick();
        return b;
    }

    // ---------- Rendering ----------

    private void Render()
    {
        FlowDirection = HubStrings.Languages.First(l => l.Code == Lang).RightToLeft ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        brandName.Text = HubInfo.Name;
        ToolTip.SetTip(settingsButton, T("settings.title"));
        page.Children.Clear();

        page.Children.Add(Text(T("hub.tagline"), 15, null, "muted"));
        if (hubUpdate is not null) page.Children.Add(HubUpdateBanner(hubUpdate));

        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto"), Margin = new Thickness(0, 8, 0, 0) };
        header.Children.Add(Text(T("tools.title"), 22, FontWeight.Bold));
        var check = Action(loading ? T("catalog.loading") : "↻  " + T("catalog.check"), "secondary", () => _ = Refresh(), !loading);
        Grid.SetColumn(check, 1);
        header.Children.Add(check);
        page.Children.Add(header);

        var profiles = ProfilesShown();
        if (profiles.Count > 0) page.Children.Add(TotalRow(profiles));

        if (catalogProblem is not null)
        {
            var problem = new Border { Padding = new Thickness(14, 10), CornerRadius = new CornerRadius(8), Child = Text(catalogProblem, 13.5) };
            problem.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarningSoft"));
            page.Children.Add(problem);
        }

        // Tools from the catalog (the hub itself is not listed), plus installed tools no longer in the catalog.
        var shown = new HashSet<string>();
        foreach (var tool in catalog?.Tools.Where(t => t.Id != HubInfo.Id) ?? Enumerable.Empty<CatalogTool>())
        {
            shown.Add(tool.Id);
            page.Children.Add(ToolCard(tool.Id, tool.Name, tool, store.Installed(tool.Id)));
        }
        foreach (var installed in store.All().Where(t => !shown.Contains(t.Id)))
            page.Children.Add(ToolCard(installed.Id, installed.Id, null, installed));
        if (catalog is null && !store.All().Any() && loading)
            page.Children.Add(Text(T("catalog.loading"), 14, null, "muted"));

        var planned = new StackPanel { Spacing = 4, Margin = new Thickness(0, 12, 0, 0) };
        planned.Children.Add(Text(T("planned.title"), 16, FontWeight.SemiBold));
        planned.Children.Add(Text(T("planned.text", ("names", T("planned.names"))), 14, null, "muted"));
        page.Children.Add(planned);

        var footer = $"{HubInfo.Name} {HubInfo.Version}";
        if (checkedAt is { } at) footer += " · " + T("catalog.checked", ("time", at.ToLocalTime().ToString("t")));
        page.Children.Add(Text(footer, 12, null, "muted"));
    }

    private Control HubUpdateBanner(string version)
    {
        var box = new StackPanel { Spacing = 8 };
        box.Children.Add(Text(T("self.available", ("name", HubInfo.Name), ("version", version)), 14.5, FontWeight.SemiBold));
        if (hubUpdateProgress is { } p)
        {
            box.Children.Add(Text(T("self.downloading", ("percent", p)), 13));
        }
        else if (selfUpdate.CanUpdateItself)
        {
            box.Children.Add(Action(T("self.install"), "primary", async () =>
            {
                hubUpdateProgress = 0;
                Render();
                try
                {
                    await selfUpdate.DownloadAndRestartAsync(pct => Dispatcher.UIThread.Post(() =>
                    {
                        hubUpdateProgress = pct;
                        Render();
                    }));
                }
                catch (Exception e)
                {
                    hubUpdateProgress = null;
                    overlay.Toast(T("tool.failed", ("error", e.Message)));
                    Render();
                }
            }));
        }
        else
        {
            box.Children.Add(Action(T("self.download"), "primary", () => OpenUrl($"https://github.com/{HubInfo.ReleasesRepo}/releases/tag/{HubInfo.Id}-latest")));
        }
        var card = new Border { Padding = new Thickness(16, 12), CornerRadius = new CornerRadius(10), Child = box };
        card.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsAccentSoft"));
        return card;
    }

    private Control ToolCard(string id, string name, CatalogTool? tool, InstalledTool? installed)
    {
        var rid = Platform.Rid;
        var asset = rid is null ? null : tool?.AssetFor(rid);
        bool updateAvailable = installed is not null && tool is not null && asset is not null && SemVer.IsNewer(tool.Version, installed.Version);

        var info = new StackPanel { Spacing = 4 };
        info.Children.Add(Text(name, 18, FontWeight.Bold));
        if (tool is not null) info.Children.Add(Text(tool.DescriptionFor(Lang), 14));
        string status = installed is null
            ? tool is not null ? T("tool.available", ("version", tool.Version)) : ""
            : T("tool.installed", ("version", installed.Version)) + (updateAvailable ? " · " + T("tool.available", ("version", tool!.Version)) : " · " + T("tool.upToDate"));
        info.Children.Add(Text(status, 12.5, null, "muted"));
        if (tool is not null && asset is null) info.Children.Add(Text(T("tool.notForPlatform"), 12.5, null, "muted"));
        if (installed is not null && LoadProfile(id) is { } profile) info.Children.Add(ProfileRow.Build(ProfileModelFor(profile), () => OpenAchievements(name, profile)));

        var actions = new WrapPanel { Margin = new Thickness(0, 8, 0, 0) };
        void Add(Control c)
        {
            c.Margin = new Thickness(0, 0, 8, 6);
            actions.Children.Add(c);
        }
        if (busy.TryGetValue(id, out var pct))
        {
            var progress = new StackPanel { Spacing = 4, Width = 260 };
            progress.Children.Add(Text(pct < 0 ? T("tool.installing") : T("tool.downloading", ("percent", pct)), 13));
            var bar = new ProgressBar { Minimum = 0, Maximum = 100, Value = Math.Max(0, pct), IsIndeterminate = pct < 0, Height = 6, MinHeight = 6 };
            bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsInfo"));
            progress.Children.Add(bar);
            Add(progress);
        }
        else
        {
            if (installed is not null) Add(Action("▶  " + T("tool.open"), updateAvailable ? "secondary" : "primary", () => Open(id, name)));
            if (updateAvailable) Add(Action("⬇  " + T("tool.update", ("version", tool!.Version)), "primary", () => _ = Install(tool, asset!)));
            if (installed is null && tool is not null && asset is not null) Add(Action("⬇  " + T("tool.install"), "primary", () => _ = Install(tool, asset)));
            if (tool?.Changes is { Count: > 0 }) Add(Action(T("tool.whatsNew"), "flat", () => ShowNews(tool.Name, Entries(tool).Take(5))));
            if (installed?.Previous is { } previous) Add(Action("↶  " + T("tool.rollback", ("version", previous)), "flat", () => RollBack(id)));
            if (installed is not null) Add(Action(T("tool.uninstall"), "danger-outline", () => ConfirmUninstall(id, name)));
        }
        info.Children.Add(actions);
        if (errors.TryGetValue(id, out var error))
        {
            var e = Text(T("tool.failed", ("error", error)), 13);
            e.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsDanger"));
            info.Children.Add(e);
        }

        // The tool's own icon (Assets/tools/<id>.png, from build/icons/<id>.svg), or a prompt for tools without one.
        Control icon;
        var iconUri = new Uri($"avares://Codestead.Hub/Assets/tools/{id}.png");
        if (AssetLoader.Exists(iconUri))
        {
            var image = new Image { Source = new Bitmap(AssetLoader.Open(iconUri)), Width = 52, Height = 52 };
            RenderOptions.SetBitmapInterpolationMode(image, Avalonia.Media.Imaging.BitmapInterpolationMode.HighQuality);
            icon = image;
        }
        else
        {
            icon = new Border
            {
                Width = 52,
                Height = 52,
                CornerRadius = new CornerRadius(12),
                Background = new SolidColorBrush(Color.Parse("#0f1318")),
                Child = new TextBlock { Text = ">_", FontSize = 20, Foreground = new SolidColorBrush(Color.Parse("#7ee787")), FontWeight = FontWeight.Bold, FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, monospace"), HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
            };
        }
        icon.VerticalAlignment = VerticalAlignment.Top;
        icon.Margin = new Thickness(0, 2, 16, 0);
        var row = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*") };
        row.Children.Add(icon);
        Grid.SetColumn(info, 1);
        row.Children.Add(info);
        var card = new Border { Padding = new Thickness(18, 16), Child = row };
        card.Classes.Add("card");
        return card;
    }
}
