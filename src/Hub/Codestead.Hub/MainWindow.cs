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

/// <summary>
/// The hub: a list of Codestead tools with Install / Open / Update / Uninstall, like JetBrains Toolbox.
/// The tool list comes from the signed catalog; tools are installed per user (see <see cref="ToolStore"/>).
/// </summary>
public sealed partial class MainWindow : Window
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
        // Back from a tool: its level and achievements may have changed.
        Activated += (_, _) =>
        {
            if (!overlay.DialogOpen) Render();
        };

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
}
