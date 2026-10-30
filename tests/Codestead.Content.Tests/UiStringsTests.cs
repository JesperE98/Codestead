using System.Text.RegularExpressions;
using Codestead.Shell;

namespace Codestead.Content.Tests;

// Port of src/i18n/ui.test.ts.
public class UiStringsTests
{
    public static TheoryData<string> LanguageCodes() => new(LanguagesLib.Languages.Select(l => l.Code));

    private static readonly Regex PlaceholderRe = new(@"\{[A-Za-z0-9_]+\}", RegexOptions.CultureInvariant);

    private static string Placeholders(string s) =>
        string.Join(",", PlaceholderRe.Matches(s).Select(m => m.Value).Order(StringComparer.Ordinal));

    [Theory(DisplayName = "har alla nycklar och samma platshållare")]
    [MemberData(nameof(LanguageCodes))]
    public void HasAllKeysAndSamePlaceholders(string code)
    {
        var sv = UiStrings.Ui["sv"];
        foreach (var key in UiStrings.Keys)
        {
            var text = UiStrings.Ui[code].Get(key) ?? (key == "progress.short" ? sv.Get(key) : null);
            Assert.True(!string.IsNullOrEmpty(text), $"{code}: {key}");
            Assert.True(Placeholders(text!) == Placeholders(sv[key]), $"{code}: {key}: {Placeholders(text!)} != {Placeholders(sv[key])}");
        }
    }

    [Fact(DisplayName = "platshållare fylls i och saknade nycklar faller tillbaka")]
    public void PlaceholdersAndFallback()
    {
        Assert.Equal("Chapter 3 of 21", UiStrings.Translate("en", "lesson.chapter", new Dictionary<string, object> { ["n"] = 3, ["total"] = 21 }));
        Assert.Equal("1/2", UiStrings.Translate("ja", "progress.short", new Dictionary<string, object> { ["done"] = 1, ["total"] = 2 }));
    }

    // Not in the TypeScript: the owner's requirement that the app starts in English when nothing is saved.
    [Fact(DisplayName = "standardspråket är engelska och reservordningen är språk → en → sv")]
    public void DefaultLanguageIsEnglish()
    {
        Assert.Equal("en", LanguagesLib.DetectLang());
        Assert.Equal(new[] { "de", "en", "sv" }, LanguagesLib.FallbackChain("de"));
        Assert.Equal(new[] { "en", "sv" }, LanguagesLib.FallbackChain("en"));
        Assert.Equal(new[] { "sv", "en" }, LanguagesLib.FallbackChain("sv"));
    }
}
