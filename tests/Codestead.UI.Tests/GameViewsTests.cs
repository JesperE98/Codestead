using Avalonia.Controls;
using Avalonia.LogicalTree;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;

namespace Codestead.UI.Tests;

public class GameViewsTests
{
    private static readonly ProfileTexts Texts = new(
        (xp, next) => next is int n ? $"{xp} XP, {n - xp} left" : $"{xp} XP",
        (days, today, best) => $"{days} days (best {best}){(today ? "" : ", waiting")}",
        "???", "Keep exploring.", date => $"Unlocked {date}", (title, found, total) => $"{title} · {found}/{total}");

    private static ToolProfile Profile() => new()
    {
        Xp = 520,
        Level = 4,
        MaxLevel = 10,
        LevelStart = 400,
        NextLevelAt = 700,
        LevelTitle = new() { ["en"] = "Pipe fitter", ["sv"] = "Rörmokare" },
        Streak = 5,
        BestStreak = 9,
        LastActiveDay = "2026-11-02",
        Categories = new()
        {
            new() { Id = "learning", Title = new() { ["en"] = "Learning" } },
            new() { Id = "hidden", Title = new() { ["en"] = "Hidden" }, Hidden = true },
        },
        Achievements = new()
        {
            new() { Id = "first", Icon = "👋", Category = "learning", UnlockedAt = "2026-11-01T20:15", Title = new() { ["en"] = "First step", ["sv"] = "Första steget" }, Description = new() { ["en"] = "Solve a task." } },
            new() { Id = "many", Icon = "💯", Category = "learning", Current = 62, Target = 100, Title = new() { ["en"] = "100 tasks" }, Description = new() { ["en"] = "Solve 100 tasks." } },
            new() { Id = "secret", Category = "hidden", Hidden = true },
            new() { Id = "found", Icon = "🐄", Category = "hidden", Hidden = true, UnlockedAt = "2026-11-02T09:00", Title = new() { ["en"] = "Moo" }, Description = new() { ["en"] = "cowsay" } },
        },
    };

    [Fact(DisplayName = "profilen blir kort och sektioner; dolda behåller sin hemlighet")]
    public void ProfileToCards()
    {
        var p = Profile();
        Assert.Equal(2, p.Unlocked);
        var sections = ProfileModels.Sections(p, "sv", Texts);
        Assert.Equal(new[] { "Learning", "Hidden · 1/2" }, sections.Select(s => s.Title));
        var first = sections[0].Cards[0];
        Assert.Equal("Första steget", first.Title);
        Assert.Equal("Solve a task.", first.Description); // falls back to English
        Assert.StartsWith("Unlocked ", first.UnlockedText);
        Assert.Equal("62 / 100", sections[0].Cards[1].ProgressText);
        // Found hidden ones come first; the unfound one shows nothing of itself.
        Assert.Equal("Moo", sections[1].Cards[0].Title);
        var secret = sections[1].Cards[1];
        Assert.Equal(("???", "Keep exploring.", false, true), (secret.Title, secret.Description, secret.Unlocked, secret.Hidden));
    }

    [Fact(DisplayName = "streaken visas tills en dag missas")]
    public void Streak()
    {
        var p = Profile();
        Assert.Equal((5, false), p.StreakOn(new DateOnly(2026, 11, 3)));
        Assert.Equal((5, true), p.StreakOn(new DateOnly(2026, 11, 2)));
        Assert.Equal((0, false), p.StreakOn(new DateOnly(2026, 11, 5)));
        var level = ProfileModels.Level(p, "en", Texts);
        Assert.Equal(("Pipe fitter", 0.4), (level.Title, Math.Round(level.Fraction, 2)));
    }

    [Fact(DisplayName = "profilfilen sparas och läses, saknad eller trasig fil ger null")]
    public void SaveAndLoad()
    {
        var dir = Directory.CreateTempSubdirectory("codestead-profile-").FullName;
        try
        {
            var storage = new Storage("tool", dir);
            Assert.Null(ToolProfile.Load(storage));
            Profile().Save(storage);
            var back = ToolProfile.Load(storage)!;
            Assert.Equal(520, back.Xp);
            Assert.Equal(4, back.Achievements.Count);
            Assert.Equal("Rörmokare", ToolProfile.Pick(back.LevelTitle, "sv"));
            storage.SaveText(ToolProfile.FileName, "{ not json");
            Assert.Null(ToolProfile.Load(storage));
            storage.SaveText(ToolProfile.FileName, "{\"schema\": 99}");
            Assert.Null(ToolProfile.Load(storage));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact(DisplayName = "datum skrivs med gregoriansk kalender på alla språk")]
    public void Dates()
    {
        foreach (var lang in new[] { "en", "sv", "ar", "hi", "ja", "zh", "ru" })
            Assert.Contains("2026", ProfileModels.FormatDate("2026-11-03T10:00", lang));
        Assert.Equal("broken", ProfileModels.FormatDate("broken", "en"));
    }

    private static IEnumerable<string> Strings(Control c) =>
        c.GetLogicalDescendants().OfType<TextBlock>().Select(t => t.Text ?? "").Concat(c.GetLogicalDescendants().OfType<Button>().Select(b => b.Content as string ?? ""));

    [Fact(DisplayName = "galleriet, firandet och notiserna byggs utan att visa dolda titlar")]
    public void Views()
    {
        Ui.Run(() =>
        {
            Motion.Enabled = false;
            var p = Profile();
            var gallery = AchievementGalleryView.Build(new GalleryTexts("Achievements", "2 of 4", "🔥 5", "Close"), ProfileModels.Level(p, "en", Texts), ProfileModels.Sections(p, "en", Texts), () => { });
            var host = new OverlayHost(new Border());
            host.ShowDialog(gallery, () => { }, 800, scroll: false);
            var win = new Window { Width = 1000, Height = 800, Content = host };
            win.Show();
            var texts = Strings(gallery).ToList();
            Assert.Contains("Moo", texts);
            Assert.Contains("???", texts);
            Assert.DoesNotContain(texts, t => t.Contains("secret", StringComparison.OrdinalIgnoreCase));

            bool closed = false, next = false;
            var level = ProfileModels.Level(p, "en", Texts);
            var model = new CelebrationModel("✓", "Chapter complete!", "Reading text", false, "Commands", new[] { "head", "tail" }, "About 5 minutes", "+45 XP",
                level, level, null, "New achievements", new[] { ProfileModels.Card(p.Achievements[0], "en", Texts) }, "Close", "Next: Pipes");
            var celebration = CelebrationView.Build(model, () => closed = true, () => next = true);
            var buttons = celebration.GetLogicalDescendants().OfType<Button>().ToList();
            buttons.First(b => b.Content as string == "Close").Command?.Execute(null);
            foreach (var b in buttons) b.RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
            Assert.True(closed && next);
            Assert.Contains("head", Strings(celebration));

            var layer = new NoticeLayer { MoreText = n => $"+{n} more" };
            for (int i = 0; i < 5; i++) layer.Show(AchievementToast.Build("New", "👋", $"A{i}", "d"), 60);
            Assert.Equal(NoticeLayer.MaxVisible + 1, layer.Children.Count);
            Assert.Contains("+2 more", Strings(layer));
            win.Close();
        });
    }

    [Fact(DisplayName = "dialogkön visar nästa dialog först när den öppna stängs")]
    public void DialogQueue()
    {
        Ui.Run(() =>
        {
            var host = new OverlayHost(new Border());
            var shown = new List<string>();
            host.ShowWhenFree(() => { shown.Add("a"); host.ShowDialog(new TextBlock { Text = "a" }, host.CloseDialog); });
            host.ShowWhenFree(() => { shown.Add("b"); host.ShowDialog(new TextBlock { Text = "b" }, host.CloseDialog); });
            Assert.Equal(new[] { "a" }, shown);
            host.CloseDialog();
            Avalonia.Threading.Dispatcher.UIThread.RunJobs();
            Assert.Equal(new[] { "a", "b" }, shown);
            Assert.True(host.DialogOpen);
        });
    }
}
