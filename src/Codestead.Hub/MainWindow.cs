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

namespace Codestead.Hub;

/// <summary>Settings saved between runs.</summary>
public sealed class HubState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
}

/// <summary>
/// The hub: a list of Codestead tools with Install / Open / Update / Uninstall, like JetBrains Toolbox.
/// The tool list comes from the signed catalog; tools are installed per user (see <see cref="ToolStore"/>).
/// </summary>
public sealed class MainWindow : Window
{
    /// <summary>How often the hub looks for new versions while it is open.</summary>
    public static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    private readonly HubOptions options;
    private readonly Storage storage = new(HubInfo.Id);
    private readonly HubState state;
    private readonly ToolStore store = new(Platform.DataRoot());
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromMinutes(10) };
    private readonly CatalogClient catalogClient;
    private readonly SelfUpdate selfUpdate = new(HubInfo.ReleasesRepo, HubInfo.Id);
    private readonly OverlayHost overlay;

    private Catalog? catalog;
    private string? catalogProblem;
    private bool loading;
    private DateTime? checkedAt;
    private string? hubUpdate;
    private int? hubUpdateProgress;
    /// <summary>Tool id → download progress 0..100 (or -1 while unpacking) for running installs.</summary>
    private readonly Dictionary<string, int> busy = new();
    private readonly Dictionary<string, string> errors = new();

    private readonly StackPanel page = new() { MaxWidth = 860, Margin = new Thickness(32, 24, 32, 40), Spacing = 14 };
    private readonly TextBlock brandName = new() { FontSize = 18, FontWeight = FontWeight.Bold, VerticalAlignment = VerticalAlignment.Center };
    private readonly Button settingsButton = new() { Content = Icons.Gear(19), Padding = new Thickness(10, 6) };

    private string Lang => state.Lang ?? "en";
    private string T(string key, params (string, object)[] args) => HubStrings.T(Lang, key, args);

    public MainWindow() : this(new HubOptions(false, null, null, null)) { }

    public MainWindow(HubOptions options)
    {
        this.options = options;
        var saved = storage.Load<HubState>("state");
        existingUser = saved is not null;
        state = saved ?? new HubState();
        if (!HubStrings.IsLanguage(state.Lang)) state.Lang = "en";

        var verifier = new CatalogVerifier(options.SmokeTest && options.PublicKeyFile is not null ? File.ReadAllText(options.PublicKeyFile) : HubInfo.CatalogPublicKey());
        var url = options.SmokeTest && options.Catalog is not null ? options.Catalog : CatalogClient.DefaultUrl(HubInfo.ReleasesRepo);
        catalogClient = new CatalogClient(http, verifier, Path.Combine(Platform.DataRoot(), "hub", "catalog"), url);

        Title = HubInfo.Name;
        Width = 980;
        Height = 720;
        MinWidth = 640;
        MinHeight = 480;
        try
        {
            Icon = new WindowIcon(AssetLoader.Open(new Uri("avares://Codestead.Hub/Assets/icon.png")));
        }
        catch (Exception)
        {
            // The icon is cosmetic.
        }

        overlay = new OverlayHost(BuildLayout());
        Content = overlay;
        ApplyTheme();
        Render();

        Opened += async (_, _) =>
        {
            if (options.SmokeTest)
            {
                // After the window has finished opening: closing it while it opens crashes the lifetime.
                Dispatcher.UIThread.Post(() => _ = RunSmokeTest(), DispatcherPriority.Background);
                return;
            }
            // After the hub updated itself: what changed.
            var news = Changelog.NewsAtStart(storage, Changelog.Embedded(typeof(MainWindow).Assembly), HubInfo.Version, existingUser);
            if (news.Count > 0) ShowNews(HubInfo.Name, news);
            await Refresh();
            DispatcherTimer.Run(() =>
            {
                _ = Refresh();
                return true;
            }, CheckInterval);
        };
    }

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

    private static TextBlock Text(string text, double size = 14, FontWeight? weight = null, string? cls = null)
    {
        var tb = new TextBlock { Text = text, FontSize = size, TextWrapping = TextWrapping.Wrap };
        if (weight is not null) tb.FontWeight = weight.Value;
        if (cls is not null) tb.Classes.Add(cls);
        return tb;
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

        if (catalogProblem is not null)
        {
            var problem = new Border { Padding = new Thickness(14, 10), CornerRadius = new CornerRadius(8), Child = Text(catalogProblem, 13.5) };
            problem.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarnBg"));
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
            bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsAccent"));
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
    private void ShowNews(string name, IEnumerable<ChangelogEntry> entries)
    {
        var texts = new WhatsNewTexts(T("whatsnew.title", ("name", name)), T("whatsnew.version"), T("whatsnew.close"));
        overlay.ShowDialog(WhatsNewView.Build(texts, entries, Lang, overlay.CloseDialog), overlay.CloseDialog, 560, scroll: false);
    }

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

    private void ApplyTheme()
    {
        if (Application.Current is null) return;
        Application.Current.RequestedThemeVariant = state.Theme switch
        {
            "light" => ThemeVariant.Light,
            "dark" => ThemeVariant.Dark,
            _ => ThemeVariant.Default,
        };
    }

    private void OpenSettings()
    {
        var panel = new StackPanel { Spacing = 10 };
        panel.Children.Add(Text(T("settings.title"), 21, FontWeight.Bold));
        panel.Children.Add(Text(T("settings.language"), 15, FontWeight.SemiBold));
        var langs = new WrapPanel();
        foreach (var l in HubStrings.Languages)
        {
            var b = new Button { Content = l.Name, Margin = new Thickness(0, 0, 8, 8), MinWidth = 110 };
            b.Classes.Add("chip");
            if (l.Code == Lang) b.Classes.Add("active");
            var code = l.Code;
            b.Click += (_, _) =>
            {
                state.Lang = code;
                storage.Save("state", state);
                Render();
                OpenSettings();
            };
            langs.Children.Add(b);
        }
        panel.Children.Add(langs);

        panel.Children.Add(Text(T("settings.theme"), 15, FontWeight.SemiBold));
        var themes = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        foreach (var (value, label) in new (string?, string)[] { (null, T("theme.system")), ("light", T("theme.light")), ("dark", T("theme.dark")) })
        {
            var b = new Button { Content = label };
            b.Classes.Add("chip");
            if (state.Theme == value) b.Classes.Add("active");
            var v = value;
            b.Click += (_, _) =>
            {
                state.Theme = v;
                storage.Save("state", state);
                ApplyTheme();
                OpenSettings();
            };
            themes.Children.Add(b);
        }
        panel.Children.Add(themes);

        panel.Children.Add(Text(T("settings.folder"), 15, FontWeight.SemiBold));
        var folder = new SelectableTextBlock { Text = store.Root, FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, monospace"), FontSize = 13, TextWrapping = TextWrapping.Wrap, FlowDirection = FlowDirection.LeftToRight };
        panel.Children.Add(folder);

        var close = new Button { Content = T("dialog.close"), HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => overlay.CloseDialog();
        panel.Children.Add(close);
        panel.Children.Add(Text($"{HubInfo.Name} {HubInfo.Version}", 11.5, null, "muted"));
        overlay.ShowDialog(panel, overlay.CloseDialog, 600);
    }

    // ---------- Smoke test (installation tests) ----------

    private async Task RunSmokeTest()
    {
        int code = 0;
        try
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
            Console.WriteLine($"SMOKE OK {HubInfo.Name} {HubInfo.Version} ({HubStrings.Languages.Count} languages{detail})");
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("SMOKE FAILED: " + e);
            code = 1;
        }
        Environment.ExitCode = code;
        Close();
    }
}
