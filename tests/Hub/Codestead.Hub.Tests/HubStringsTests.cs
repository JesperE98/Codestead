using System.Text.RegularExpressions;
using Codestead.Content;

namespace Codestead.Hub.Tests;

public class HubStringsTests
{
    private static readonly Regex Placeholder = new(@"\{([A-Za-z0-9_]+)\}");

    [Fact(DisplayName = "hubben har samma språk som Codestead Linux")]
    public void SameLanguagesAsTheTool() =>
        Assert.Equal(LanguagesLib.Languages.Select(l => (l.Code, l.Dir == "rtl")).Order(), HubStrings.Languages.Select(l => (l.Code, l.RightToLeft)).Order());

    [Fact(DisplayName = "alla hubbtexter finns på alla språk med samma platshållare")]
    public void AllTranslated()
    {
        var en = HubStrings.For("en");
        Assert.NotEmpty(en);
        foreach (var lang in HubStrings.Languages)
        {
            var texts = HubStrings.For(lang.Code);
            Assert.Equal(en.Keys.Order(), texts.Keys.Order());
            foreach (var (key, text) in texts)
            {
                Assert.False(string.IsNullOrWhiteSpace(text), $"{lang.Code}/{key} is empty");
                Assert.Equal(Placeholder.Matches(en[key]).Select(m => m.Value).Order(), Placeholder.Matches(text).Select(m => m.Value).Order());
                // Leftover Swedish: å never occurs in the other languages, ä/ö only in German.
                var swedish = lang.Code == "de" ? "[åÅ]" : "[åäöÅÄÖ]";
                if (lang.Code != "sv") Assert.False(Regex.IsMatch(text, swedish), $"{lang.Code}/{key} contains Swedish letters: {text}");
            }
        }
    }

    [Fact(DisplayName = "platshållare fylls i och okända nycklar faller tillbaka")]
    public void Translates()
    {
        Assert.Equal("Update to 1.2.3", HubStrings.T("en", "tool.update", ("version", "1.2.3")));
        Assert.Equal("Uppdatera till 1.2.3", HubStrings.T("sv", "tool.update", ("version", "1.2.3")));
        Assert.Equal("no.such.key", HubStrings.T("de", "no.such.key"));
    }
}
