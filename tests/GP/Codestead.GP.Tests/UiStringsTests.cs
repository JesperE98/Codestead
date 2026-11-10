using System.Text.Json;
using System.Text.RegularExpressions;
using Codestead.Common;
using Codestead.GP.Course.Game;

namespace Codestead.GP.Tests;

/// <summary>The user-interface texts: every offered language has every key with the same placeholders, and every achievement and level has its texts.</summary>
public class UiStringsTests
{
    private static Dictionary<string, string> Load(string lang) =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(Path.Combine(Repo.Root, "src", "GP", "Codestead.GP.Course", "i18n", "ui", lang + ".json")))!;

    private static string Placeholders(string s) => string.Join(",", Regex.Matches(s, @"\{(\w+)\}").Select(m => m.Groups[1].Value).Order());

    [Fact(DisplayName = "alla erbjudna språk har alla texter med samma platshållare")]
    public void AllLanguagesComplete()
    {
        var en = Load("en");
        foreach (var lang in Languages.Offered.Select(l => l.Code).Where(l => l != "en"))
        {
            var d = Load(lang);
            var missing = en.Keys.Where(k => !d.ContainsKey(k)).ToList();
            Assert.True(missing.Count == 0, $"{lang}: missing {string.Join(", ", missing)}");
            foreach (var (k, v) in en) Assert.True(Placeholders(v) == Placeholders(d[k]), $"{lang}: {k} has other placeholders");
        }
    }

    [Fact(DisplayName = "varje utmärkelse, nivå och del har sina texter")]
    public void GameTexts()
    {
        var en = Load("en");
        foreach (var a in GpAchievements.All)
        {
            Assert.True(en.ContainsKey(a.TitleKey), a.TitleKey);
            Assert.True(en.ContainsKey(a.DescKey), a.DescKey);
        }
        for (int i = 1; i <= Learning.Game.Levels.Max; i++) Assert.True(en.ContainsKey($"level.{i}"));
        foreach (var part in Course.GpCourse.Parts) Assert.True(en.ContainsKey($"part.{part}"), $"part.{part}");
    }

    [Fact(DisplayName = "simulatorns meddelanden har texter")]
    public void SimulatorNotes()
    {
        var en = Load("en");
        var src = Path.Combine(Repo.Root, "src", "GP", "Codestead.GP.Gpu");
        var keys = Directory.GetFiles(src, "*.cs", SearchOption.AllDirectories)
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"SimNote\.(?:Info|Warning|Error)\(""(\w+)""").Select(m => m.Groups[1].Value)).Distinct();
        foreach (var k in keys) Assert.True(en.ContainsKey("sim." + k), "sim." + k);
    }
}
