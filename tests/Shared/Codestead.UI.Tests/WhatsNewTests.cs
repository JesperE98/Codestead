using System.Text.Json;
using Avalonia.Controls;
using Avalonia.LogicalTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

public class WhatsNewTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    private static readonly string[] Languages = { "en", "sv", "de", "fr", "es", "pt", "ru", "zh", "ja", "ar", "hi" };

    private static List<ChangelogEntry> Log(params string[] versions) =>
        versions.Select(v => new ChangelogEntry { Version = v, Date = "2026-11-03", Changes = new() { ["en"] = new() { $"In {v}" }, ["sv"] = new() { $"I {v}" } } }).ToList();

    [Fact(DisplayName = "versionerna mellan den senast visade och den nuvarande, nyast först")]
    public void Between()
    {
        var log = Changelog.Parse(JsonSerializer.Serialize(Log("0.5.2", "0.5.10", "0.5.3", "0.6.0"), Changelog.Json));
        Assert.Equal(new[] { "0.6.0", "0.5.10", "0.5.3", "0.5.2" }, log.Select(e => e.Version));
        Assert.Equal(new[] { "0.5.10", "0.5.3" }, Changelog.Between(log, "0.5.2", "0.5.10").Select(e => e.Version));
        Assert.Empty(Changelog.Between(log, "0.6.0", "0.6.0"));
        Assert.Equal("I 0.5.3", log[2].ChangesFor("sv")[0]);
        Assert.Equal("In 0.5.3", log[2].ChangesFor("ja")[0]);
        Assert.Empty(Changelog.Parse("not json"));
    }

    [Fact(DisplayName = "nyheterna visas efter en uppdatering, inte vid första installationen och bara en gång")]
    public void NewsAtStart()
    {
        var log = Log("0.5.5", "0.5.4", "0.5.3");
        var dir = Directory.CreateTempSubdirectory("codestead-whatsnew-").FullName;
        try
        {
            // A new installation: nothing, but the version is remembered.
            var fresh = new Storage("fresh", dir);
            Assert.Empty(Changelog.NewsAtStart(fresh, log, "0.5.5", existingUser: false));
            Assert.Equal("0.5.5", Changelog.Seen(fresh));
            // Updated from a version before this feature: the current version's news.
            var old = new Storage("old", dir);
            Assert.Equal(new[] { "0.5.5" }, Changelog.NewsAtStart(old, log, "0.5.5", existingUser: true).Select(e => e.Version));
            Assert.Empty(Changelog.NewsAtStart(old, log, "0.5.5", existingUser: true));
            // Updated from 0.5.3: what came after it.
            var seen = new Storage("seen", dir);
            Changelog.MarkSeen(seen, "0.5.3");
            Assert.Equal(new[] { "0.5.5", "0.5.4" }, Changelog.NewsAtStart(seen, log, "0.5.5", existingUser: true).Select(e => e.Version));
            // A development build shows nothing.
            Assert.Empty(Changelog.NewsAtStart(new Storage("dev", dir), log, "0.0.0", existingUser: true));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact(DisplayName = "rutan visar varje version med sina ändringar och stängs med knappen")]
    public void View()
        => Ui.Run(() =>
    {
        int closed = 0;
        var view = WhatsNewView.Build(new WhatsNewTexts("Nytt i Codestead Linux", "Version {version} · {date}", "OK"), Log("0.5.5", "0.5.4"), "sv", () => closed++);
        var w = new Window { Content = view };
        w.Show();
        var texts = view.GetLogicalDescendants().OfType<TextBlock>().Select(t => t.Text).ToList();
        Assert.Contains("Nytt i Codestead Linux", texts);
        Assert.Contains("Version 0.5.4 · 2026-11-03", texts);
        Assert.Equal(2, view.GetLogicalDescendants().OfType<MarkdownView>().Count());
        view.GetLogicalDescendants().OfType<Button>().Single().RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
        Assert.Equal(1, closed);
        w.Close();
    });

    [Theory(DisplayName = "ändringsloggarna är kompletta på alla språk")]
    [InlineData("Linux")]
    [InlineData("Hub")]
    public void ChangelogsAreComplete(string product)
    {
        var json = File.ReadAllText(Path.Combine(RepoRoot(), "src", product, "changelog.json"));
        var raw = JsonSerializer.Deserialize<List<ChangelogEntry>>(json, Changelog.Json)!;
        Assert.NotEmpty(raw);
        // Newest first, each version once, with a date.
        var versions = raw.Select(e => Changelog.ParseVersion(e.Version)).ToList();
        Assert.All(raw, e => Assert.True(Changelog.ParseVersion(e.Version) is not null, $"{product}: bad version \"{e.Version}\""));
        Assert.Equal(versions.OrderByDescending(v => v), versions);
        Assert.Equal(versions.Count, versions.Distinct().Count());
        Assert.All(raw, e => Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", e.Date));
        foreach (var e in raw)
        {
            var en = e.Changes.GetValueOrDefault("en") ?? new();
            Assert.True(en.Count > 0, $"{product} {e.Version}: no English changes");
            foreach (var lang in Languages)
            {
                var lines = e.Changes.GetValueOrDefault(lang);
                Assert.True(lines is not null && lines.Count == en.Count && lines.All(l => l.Trim() != ""),
                    $"{product} {e.Version}: \"{lang}\" needs {en.Count} lines, like English");
                Assert.True(lines!.Select(l => l.Count(c => c == '`')).SequenceEqual(en.Select(l => l.Count(c => c == '`'))),
                    $"{product} {e.Version}/{lang}: the `code` parts differ from English");
            }
        }
    }
}
