using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Styling;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.UI.Themes;

namespace Codestead.UI.Tests;

/// <summary>Layout sketches of the gamification and the colours. Written only when CODESTEAD_MOCKUPS points to a folder.</summary>
public class Mockups
{
    private static readonly string? Dir = Environment.GetEnvironmentVariable("CODESTEAD_MOCKUPS");

    private static LevelModel Level(int n, string title, int xp, int start, int? next) =>
        new(n, title, xp, start, next, next is int nx ? $"{xp} XP · {nx - xp} XP till nivå {n + 1}" : $"{xp} XP");

    private static AchievementCard Card(string icon, string title, string desc, bool unlocked, int cur = 0, int target = 0, bool hidden = false) =>
        hidden && !unlocked
            ? new("❔", "???", "En dold utmärkelse – fortsätt utforska terminalen.", false, true, 0, 0, null, null)
            : new(icon, title, desc, unlocked, hidden, cur, target, unlocked ? "Upplåst 3 nov 2026" : null, target > 0 ? $"{cur} / {target}" : null);

    private static Window Shot(Control content, double w, double h, bool dark, Brand brand, bool rtl = false)
    {
        var win = new Window
        {
            Width = w,
            Height = h,
            RequestedThemeVariant = dark ? ThemeVariant.Dark : ThemeVariant.Light,
            FlowDirection = rtl ? FlowDirection.RightToLeft : FlowDirection.LeftToRight,
            Content = content,
        };
        brand.ApplyTo(win.Resources);
        win.Show();
        Avalonia.Threading.Dispatcher.UIThread.RunJobs();
        return win;
    }

    private static void Save(Window w, string name)
    {
        Avalonia.Threading.Dispatcher.UIThread.RunJobs();
        w.CaptureRenderedFrame()?.Save(Path.Combine(Dir!, name + ".png"));
        w.Close();
    }

    private static TextBlock T(string text, double size, FontWeight? weight = null) => new() { Text = text, FontSize = size, FontWeight = weight ?? FontWeight.Normal, TextWrapping = TextWrapping.Wrap };

    /// <summary>A sketch of the Codestead Linux window: top bar, sidebar, a lesson and a notice.</summary>
    private static Control AppSketch(bool showToast)
    {
        var root = new DockPanel();
        // Top bar
        var top = new Border { BorderThickness = new Thickness(0, 0, 0, 1), Padding = new Thickness(16, 10) };
        top.Bind(Border.BackgroundProperty, top.GetResourceObservable("CsSurface"));
        top.Bind(Border.BorderBrushProperty, top.GetResourceObservable("CsBorder"));
        var topGrid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto") };
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        var logo = new Border { Width = 26, Height = 26, CornerRadius = new CornerRadius(6), Child = new TextBlock { Text = ">_", FontWeight = FontWeight.Bold, FontSize = 12, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } };
        logo.Bind(Border.BackgroundProperty, logo.GetResourceObservable("CsAccent"));
        logo.Child.SetValue(TextBlock.ForegroundProperty, Brushes.White);
        brand.Children.Add(logo);
        brand.Children.Add(T("Codestead Linux", 17, FontWeight.Bold));
        topGrid.Children.Add(brand);
        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        var bar = new GameBar();
        bar.Update(Level(4, "Rörmokare", 520, 400, 700), new StreakModel(5, true, "5 dagar i rad (bäst: 9)"));
        right.Children.Add(bar);
        var prog = new StackPanel { Spacing = 3, VerticalAlignment = VerticalAlignment.Center };
        prog.Children.Add(T("62 / 191", 12));
        var pb = new ProgressBar { Width = 120, Height = 6, MinHeight = 6, Maximum = 191, Value = 62 };
        pb.Bind(ProgressBar.ForegroundProperty, pb.GetResourceObservable("CsAccent"));
        prog.Children.Add(pb);
        right.Children.Add(prog);
        right.Children.Add(new ComboBox { Width = 120, ItemsSource = new[] { "Svenska" }, SelectedIndex = 0 });
        Grid.SetColumn(right, 2);
        topGrid.Children.Add(right);
        top.Child = topGrid;
        DockPanel.SetDock(top, Dock.Top);
        root.Children.Add(top);

        // Sidebar
        var side = new Border { Width = 270, BorderThickness = new Thickness(0, 0, 1, 0) };
        side.Bind(Border.BackgroundProperty, side.GetResourceObservable("CsSurface"));
        side.Bind(Border.BorderBrushProperty, side.GetResourceObservable("CsBorder"));
        var sideDock = new DockPanel();
        var bottom = new StackPanel { Spacing = 2, Margin = new Thickness(10, 8) };
        foreach (var label in new[] { "🏆  Utmärkelser · 12/42", "⚙  Inställningar" })
        {
            var b = new Button { Content = label, HorizontalAlignment = HorizontalAlignment.Stretch };
            b.Classes.Add("nav-item");
            bottom.Children.Add(b);
        }
        DockPanel.SetDock(bottom, Dock.Bottom);
        sideDock.Children.Add(bottom);
        var nav = new StackPanel { Spacing = 2, Margin = new Thickness(10, 12) };
        var part = T("GRUNDERNA", 11.5, FontWeight.Bold);
        part.Classes.Add("muted");
        part.Margin = new Thickness(10, 0, 0, 6);
        nav.Children.Add(part);
        var rows = new[] { ("1", "Navigera i filsystemet", "✓", true), ("2", "Filer och kataloger", "✓", true), ("3", "Läsa text", "4/6", false), ("4", "Omdirigering och pipes", "0/7", false) };
        foreach (var (n, title, mark, done) in rows)
        {
            var g = new Grid { ColumnDefinitions = new ColumnDefinitions("26,*,Auto") };
            g.Children.Add(T(n, 13));
            var t = T(title, 13.5);
            Grid.SetColumn(t, 1);
            g.Children.Add(t);
            var m = T(mark, 13, done ? FontWeight.Bold : FontWeight.Normal);
            m.Bind(TextBlock.ForegroundProperty, m.GetResourceObservable(done ? "CsSuccess" : "CsTextMuted"));
            Grid.SetColumn(m, 2);
            g.Children.Add(m);
            var b = new Button { Content = g, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = HorizontalAlignment.Stretch };
            b.Classes.Add("nav-item");
            if (n == "3") b.Classes.Add("current");
            nav.Children.Add(b);
        }
        sideDock.Children.Add(nav);
        side.Child = sideDock;
        DockPanel.SetDock(side, Dock.Left);
        root.Children.Add(side);

        // Content: a task list with the colours in use.
        var content = new StackPanel { Spacing = 12, Margin = new Thickness(28, 22) };
        content.Children.Add(T("Läsa text", 28, FontWeight.Bold));
        Control Task(string mark, string text, string brush, string? bg = null)
        {
            var row = new Border { CornerRadius = new CornerRadius(8), Padding = new Thickness(12, 8) };
            if (bg is not null) row.Bind(Border.BackgroundProperty, row.GetResourceObservable(bg));
            var sp = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
            var c = T(mark, 15, FontWeight.Bold);
            c.Bind(TextBlock.ForegroundProperty, c.GetResourceObservable(brush));
            sp.Children.Add(c);
            sp.Children.Add(T(text, 14));
            row.Child = sp;
            return row;
        }
        content.Children.Add(Task("✓", "Visa de första raderna i fruits.txt med head.", "CsSuccess", "CsSuccessSoft"));
        content.Children.Add(Task("✓", "Visa de sista raderna med tail.", "CsSuccess"));
        content.Children.Add(Task("○", "Sök efter raden ERROR i server.log med grep.", "CsTextMuted"));
        var hint = new Border { CornerRadius = new CornerRadius(8), Padding = new Thickness(12, 8), BorderThickness = new Thickness(1) };
        hint.Bind(Border.BackgroundProperty, hint.GetResourceObservable("CsWarningSoft"));
        hint.Bind(Border.BorderBrushProperty, hint.GetResourceObservable("CsWarning"));
        hint.Child = T("💡 Ledtråd: grep tar först mönstret och sedan filen.", 13.5);
        content.Children.Add(hint);
        var wrong = new TextBlock { Text = "✗ Inte riktigt – försök igen.", FontWeight = FontWeight.SemiBold };
        wrong.Bind(TextBlock.ForegroundProperty, wrong.GetResourceObservable("CsDanger"));
        content.Children.Add(wrong);
        var link = new TextBlock { Text = "Läs mer: man grep (man7.org)", TextDecorations = TextDecorations.Underline };
        link.Bind(TextBlock.ForegroundProperty, link.GetResourceObservable("CsInfo"));
        content.Children.Add(link);
        var next = new Button { Content = "Nästa kapitel: Omdirigering och pipes" };
        next.Classes.Add("primary");
        content.Children.Add(next);

        var grid = new Grid();
        grid.Children.Add(content);
        if (showToast)
        {
            var notices = new NoticeLayer { Margin = new Thickness(0, 12, 18, 0) };
            notices.Show(AchievementToast.Build("Ny utmärkelse", "🔗", "Första pipen", "Du skickade utdata vidare till ett annat kommando med |."), 60);
            notices.Show(AchievementToast.Build("Ny nivå", "4", "Nivå 4: Rörmokare", "520 XP – 180 XP kvar till nivå 5.", level: true), 60);
            grid.Children.Add(notices);
        }
        root.Children.Add(grid);
        return root;
    }

    private static CelebrationModel Chapter(bool rtl = false) => rtl
        ? new("✓", "اكتمل الفصل!", "قراءة النصوص", false, "الأوامر التي تدربت عليها", new[] { "head", "tail", "grep", "wc", "sort" },
            "نحو 14 دقيقة", "+95 XP", Level(4, "سبّاك", 430, 400, 700), Level(4, "سبّاك", 525, 400, 700), null,
            "إنجازات جديدة", new[] { Card("🧩", "25 مهمة", "حللت 25 مهمة.", true) }, "إغلاق", "التالي: إعادة التوجيه والأنابيب")
        : new("✓", "Kapitlet klart!", "Läsa text", false, "Kommandon du övade på", new[] { "head", "tail", "grep", "wc", "sort" },
            "Ungefär 14 minuter", "+95 XP", Level(4, "Rörmokare", 430, 400, 700), Level(4, "Rörmokare", 525, 400, 700), null,
            "Nya utmärkelser", new[] { Card("🧩", "25 uppgifter", "Du har löst 25 uppgifter.", true) }, "Stäng", "Nästa: Omdirigering och pipes");

    [Fact(DisplayName = "skisser (bara med CODESTEAD_MOCKUPS)")]
    public void Render()
    {
        if (string.IsNullOrEmpty(Dir)) return;
        Directory.CreateDirectory(Dir);
        Ui.Run(() =>
        {
            Motion.Enabled = false;
            try
            {
                // 1. The app with the top bar and notices, light and dark.
                Save(Shot(AppSketch(true), 1280, 720, false, Brand.Linux), "1-app-ljus");
                Save(Shot(AppSketch(true), 1280, 720, true, Brand.Linux), "2-app-mork");

                // 2. Chapter done (light), part done (dark), Arabic (right to left).
                Control Dialog(CelebrationModel m, double width)
                {
                    var overlay = new OverlayHost(AppSketch(false));
                    overlay.ShowDialog(CelebrationView.Build(m, () => { }, () => { }), () => { }, width, scroll: false);
                    return overlay;
                }
                Save(Shot(Dialog(Chapter(), 540), 1280, 760, false, Brand.Linux), "3-kapitel-klart");
                var part = new CelebrationModel("🧱", "Grunderna klara!", "Alla fem kapitlen i Grunderna – nu väntar provet.", true,
                    "Kommandon du har lärt dig", new[] { "ls", "cd", "cp", "mv", "rm", "grep", "sort", "uniq", "sed", "awk" },
                    "Ungefär 2 timmar", "+75 XP", Level(4, "Rörmokare", 640, 400, 700), Level(5, "Skriptskrivare", 715, 700, 1100), "Nivå 5: Skriptskrivare",
                    "Nya utmärkelser", new[] { Card("🧱", "Grunderna", "Alla kapitel i Grunderna klara.", true), Card("🔗", "Första pipen", "Du skickade utdata vidare med |.", true) },
                    "Stäng", "Till provet");
                Save(Shot(Dialog(part, 560), 1280, 820, true, Brand.Linux), "4-del-klar-mork");
                var exam = new CelebrationModel("🎓", "Provet godkänt – 100 %!", "Prov: Systemet", true, null, Array.Empty<string>(), null, "+150 XP",
                    Level(6, "Pakettämjare", 1300, 1100, 1600), Level(6, "Pakettämjare", 1450, 1100, 1600), null,
                    "Nya utmärkelser", new[] { Card("⭐", "Felfritt", "100 % på ett prov.", true) }, "Stäng", "Nästa del: Distributioner");
                Save(Shot(Dialog(exam, 540), 1280, 720, false, Brand.Linux), "5-prov-godkant");
                Save(Shot(new OverlayHost(new Border()).Also(o => o.ShowDialog(CelebrationView.Build(Chapter(true), () => { }, () => { }), () => { }, 540, scroll: false)), 1000, 720, false, Brand.Linux, rtl: true), "6-kapitel-klart-arabiska");

                // 3. The gallery.
                var sections = new[]
                {
                    new AchievementSection("Lärande", new[]
                    {
                        Card("👋", "Första steget", "Lös din första uppgift.", true),
                        Card("📗", "Första kapitlet", "Bli klar med ett kapitel.", true),
                        Card("🧩", "25 uppgifter", "Lös 25 uppgifter.", true),
                        Card("💯", "100 uppgifter", "Lös 100 uppgifter.", false, 62, 100),
                        Card("🧱", "Grunderna", "Alla kapitel i Grunderna.", true),
                        Card("⚙️", "Systemet", "Alla kapitel i Systemet.", false, 2, 5),
                        Card("🐧", "Tre familjer", "Lös uppgifter i Debian, Arch och Fedora.", false, 1, 3),
                    }),
                    new AchievementSection("Terminalen", new[]
                    {
                        Card("🔗", "Första pipen", "Skicka utdata vidare med |.", true),
                        Card("🚰", "Lång rörledning", "En pipe med fyra kommandon.", false),
                        Card("🔑", "Med root-rätt", "Kör ett kommando med sudo.", true),
                        Card("📚", "Ordförråd", "Använd 25 olika kommandon.", false, 17, 25),
                    }),
                    new AchievementSection("Vanor", new[]
                    {
                        Card("🌱", "Upptid: 3 dagar", "Lär dig tre dagar i rad.", true),
                        Card("🔥", "Upptid: 7 dagar", "Lär dig sju dagar i rad.", false, 5, 7),
                        Card("🎯", "På egen hand", "Lös 10 uppgifter utan ledtråd.", true),
                    }),
                    new AchievementSection("Dolda · 2 av 10 hittade", new[]
                    {
                        Card("🐄", "Muu", "Du körde cowsay.", true, hidden: true),
                        Card("📖", "RTFM", "Du läste en manualsida.", true, hidden: true),
                        Card("", "", "", false, hidden: true),
                        Card("", "", "", false, hidden: true),
                    }),
                };
                var gallery = new OverlayHost(AppSketch(false));
                gallery.ShowDialog(AchievementGalleryView.Build(new GalleryTexts("Utmärkelser", "12 av 42 upplåsta", "🔥 5 dagar i rad · bäst 9", "Stäng"),
                    Level(4, "Rörmokare", 520, 400, 700), sections, () => { }), () => { }, 800, scroll: false);
                Save(Shot(gallery, 1280, 820, false, Brand.Linux), "7-utmarkelser");

                // 4. The hub with a tool's profile.
                Control HubSketch()
                {
                    var page = new StackPanel { Spacing = 14, Margin = new Thickness(28, 22) };
                    var head = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
                    var logo = new Border { Width = 30, Height = 30, CornerRadius = new CornerRadius(7) };
                    logo.Bind(Border.BackgroundProperty, logo.GetResourceObservable("CsAccent"));
                    head.Children.Add(logo);
                    head.Children.Add(T("Codestead", 22, FontWeight.Bold));
                    page.Children.Add(head);
                    var total = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(14, 10) };
                    total.Bind(Border.BackgroundProperty, total.GetResourceObservable("CsAccentSoft"));
                    total.Child = T("Totalt: 520 XP · 🏆 12 av 42 utmärkelser · 🔥 5 dagar i rad", 14, FontWeight.SemiBold);
                    page.Children.Add(total);
                    var card = new Border { CornerRadius = new CornerRadius(12), Padding = new Thickness(18, 14), BorderThickness = new Thickness(1) };
                    card.Bind(Border.BackgroundProperty, card.GetResourceObservable("CsSurface"));
                    card.Bind(Border.BorderBrushProperty, card.GetResourceObservable("CsBorder"));
                    var inner = new StackPanel { Spacing = 6 };
                    inner.Children.Add(T("Codestead Linux", 18, FontWeight.Bold));
                    inner.Children.Add(T("Lär dig Linux-skalet genom att göra.", 14));
                    var st = T("Installerad: 0.6.0 · senaste versionen", 13);
                    st.Classes.Add("muted");
                    inner.Children.Add(st);
                    inner.Children.Add(ProfileRow.Build(new ProfileModel(Level(4, "Rörmokare", 520, 400, 700), new StreakModel(5, true, "5 dagar i rad"), 12, 42, "12/42", "Utmärkelser"), () => { }));
                    var buttons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Margin = new Thickness(0, 6, 0, 0) };
                    var open = new Button { Content = "▶  Öppna" };
                    open.Classes.Add("primary");
                    buttons.Children.Add(open);
                    var news = new Button { Content = "Vad är nytt" };
                    news.Classes.Add("flat");
                    buttons.Children.Add(news);
                    inner.Children.Add(buttons);
                    card.Child = inner;
                    page.Children.Add(card);
                    return page;
                }
                Save(Shot(HubSketch(), 1000, 480, false, Brand.Hub), "8-hubben-ljus");
                Save(Shot(HubSketch(), 1000, 480, true, Brand.Hub), "9-hubben-mork");

                // 5. The colour system.
                Control Palette()
                {
                    var page = new StackPanel { Spacing = 14, Margin = new Thickness(28, 22) };
                    page.Children.Add(T("Färgsystemet", 24, FontWeight.Bold));
                    var rows = new[]
                    {
                        ("CsSuccess", "CsSuccessSoft", "Klart / rätt", "✓ Uppgiften klar"),
                        ("CsWarning", "CsWarningSoft", "Varning / ledtråd", "💡 Ledtråd"),
                        ("CsDanger", "CsDangerSoft", "Fel / farligt", "✗ Inte riktigt"),
                        ("CsInfo", "CsInfoSoft", "Information / länkar", "ℹ Läs mer"),
                        ("CsReward", "CsRewardSoft", "Belöningar", "🏆 +25 XP"),
                    };
                    foreach (var (fg, bg, meaning, sample) in rows)
                    {
                        var r = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
                        var sw = new Border { Width = 36, Height = 36, CornerRadius = new CornerRadius(8) };
                        sw.Bind(Border.BackgroundProperty, sw.GetResourceObservable(fg));
                        r.Children.Add(sw);
                        var label = T(meaning, 14, FontWeight.SemiBold);
                        label.Width = 190;
                        label.VerticalAlignment = VerticalAlignment.Center;
                        r.Children.Add(label);
                        var pill = new Border { CornerRadius = new CornerRadius(8), Padding = new Thickness(12, 6) };
                        pill.Bind(Border.BackgroundProperty, pill.GetResourceObservable(bg));
                        var pt = T(sample, 14, FontWeight.SemiBold);
                        pt.Bind(TextBlock.ForegroundProperty, pt.GetResourceObservable(fg));
                        pill.Child = pt;
                        r.Children.Add(pill);
                        page.Children.Add(r);
                    }
                    page.Children.Add(T("Accentfärg per app", 17, FontWeight.Bold));
                    foreach (var b in new[] { Brand.Linux, Brand.Hub })
                    {
                        var host = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
                        b.ApplyTo(host.Resources);
                        var name = T(b == Brand.Linux ? "Codestead Linux" : "Codestead (hubben)", 14, FontWeight.SemiBold);
                        name.Width = 190;
                        name.VerticalAlignment = VerticalAlignment.Center;
                        host.Children.Add(name);
                        var p = new Button { Content = "Primärknapp" };
                        p.Classes.Add("primary");
                        host.Children.Add(p);
                        var chip = new Button { Content = "Valt" };
                        chip.Classes.Add("chip");
                        chip.Classes.Add("active");
                        host.Children.Add(chip);
                        var navb = new Button { Content = "Markerat kapitel", Width = 200 };
                        navb.Classes.Add("nav-item");
                        navb.Classes.Add("current");
                        host.Children.Add(navb);
                        page.Children.Add(host);
                    }
                    return page;
                }
                Save(Shot(Palette(), 900, 560, false, Brand.Linux), "10-farger-ljus");
                Save(Shot(Palette(), 900, 560, true, Brand.Linux), "11-farger-mork");
            }
            finally
            {
                Motion.Enabled = true;
            }
        });
    }
}

internal static class AlsoExtension
{
    public static T Also<T>(this T value, Action<T> action)
    {
        action(value);
        return value;
    }
}
