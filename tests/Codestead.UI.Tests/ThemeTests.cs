using System.Xml.Linq;
using Avalonia.Media;
using Codestead.UI.Themes;

namespace Codestead.UI.Tests;

/// <summary>The colour system: every colour exists in both themes, and text is readable (WCAG AA).</summary>
public class ThemeTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    private static readonly XNamespace X = "http://schemas.microsoft.com/winfx/2006/xaml";

    /// <summary>Theme ("Light"/"Dark") → colour key → colour, read from Codestead.axaml.</summary>
    private static readonly Lazy<Dictionary<string, Dictionary<string, Color>>> Themes = new(() =>
    {
        var doc = XDocument.Load(Path.Combine(RepoRoot(), "src", "Codestead.UI", "Themes", "Codestead.axaml"));
        return doc.Descendants()
            .Where(e => e.Name.LocalName == "ResourceDictionary" && (string?)e.Attribute(X + "Key") is "Light" or "Dark")
            .ToDictionary(
                e => (string)e.Attribute(X + "Key")!,
                e => e.Elements().Where(b => b.Name.LocalName == "SolidColorBrush")
                    .ToDictionary(b => (string)b.Attribute(X + "Key")!, b => Color.Parse((string)b.Attribute("Color")!)));
    });

    private static double Luminance(Color c)
    {
        static double Channel(byte v)
        {
            double s = v / 255.0;
            return s <= 0.03928 ? s / 12.92 : Math.Pow((s + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * Channel(c.R) + 0.7152 * Channel(c.G) + 0.0722 * Channel(c.B);
    }

    private static double Contrast(Color a, Color b)
    {
        double la = Luminance(a), lb = Luminance(b);
        return (Math.Max(la, lb) + 0.05) / (Math.Min(la, lb) + 0.05);
    }

    private static readonly string[] Meanings = { "Success", "Warning", "Danger", "Info", "Reward" };

    [Fact(DisplayName = "alla färger finns i både ljust och mörkt tema")]
    public void BothThemes()
    {
        var t = Themes.Value;
        Assert.Equal(t["Light"].Keys.Order(), t["Dark"].Keys.Order());
        foreach (var m in Meanings)
        {
            Assert.Contains($"Cs{m}", t["Light"].Keys);
            Assert.Contains($"Cs{m}Soft", t["Light"].Keys);
        }
        Assert.Contains("CsRewardStrong", t["Light"].Keys);
        Assert.Contains("CsOnAccent", t["Light"].Keys);
    }

    public static TheoryData<string> ThemeNames() => new("Light", "Dark");

    [Theory(DisplayName = "text och betydelsefärger går att läsa (kontrast ≥ 4.5)")]
    [MemberData(nameof(ThemeNames))]
    public void ReadableText(string theme)
    {
        var t = Themes.Value[theme];
        var failures = new List<string>();
        void Check(string fg, string bg, double min = 4.5)
        {
            double c = Contrast(t[fg], t[bg]);
            if (c < min) failures.Add($"{fg} on {bg}: {c:0.00}");
        }
        foreach (var bg in new[] { "CsBg", "CsSurface", "CsSurface2" })
        {
            Check("CsText", bg);
            Check("CsTextMuted", bg);
            Check("CsLink", bg);
            foreach (var m in Meanings) Check($"Cs{m}", bg);
        }
        foreach (var m in Meanings)
        {
            Check($"Cs{m}", $"Cs{m}Soft");
            Check("CsText", $"Cs{m}Soft");
            Check("CsTextMuted", $"Cs{m}Soft");
        }
        Check("CsOnAccent", "CsAccent");
        Assert.True(failures.Count == 0, string.Join("\n", failures));
    }

    public static TheoryData<string> BrandNames() => new("Linux", "Hub");

    [Theory(DisplayName = "appens accentfärg: knapptexten går att läsa")]
    [MemberData(nameof(BrandNames))]
    public void BrandContrast(string name)
    {
        var brand = name == "Linux" ? Brand.Linux : Brand.Hub;
        foreach (var (shade, surface) in new[] { (brand.Light, Themes.Value["Light"]["CsSurface"]), (brand.Dark, Themes.Value["Dark"]["CsSurface"]) })
        {
            Assert.True(Contrast(shade.OnAccent, shade.Accent) >= 4.5, $"{name}: text on accent {Contrast(shade.OnAccent, shade.Accent):0.00}");
            // The accent is also used for the current chapter and focus rings next to the surface.
            Assert.True(Contrast(shade.Accent, surface) >= 3, $"{name}: accent on surface {Contrast(shade.Accent, surface):0.00}");
        }
    }
}
