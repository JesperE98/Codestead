using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

/// <summary>
/// The simulator's own texts in src/Codestead.Shell/i18n/&lt;lang&gt;.json (see ShellI18n).
///
/// The summaries in en.json and sv.json are generated from CommandDef.SummaryEn/Summary. After changing
/// a summary in the code, regenerate them with
///   CODESTEAD_UPDATE_SHELL_I18N=1 dotnet test --project tests/Codestead.Shell.Tests
/// and translate the change in the other languages.
/// </summary>
public class ShellI18nTests
{
    /// <summary>The app's languages (Codestead.Content/Languages.cs).</summary>
    private static readonly string[] LangCodes = ["en", "sv", "es", "zh", "hi", "ar", "pt", "fr", "de", "ru", "ja"];

    public static TheoryData<string> Languages => new(LangCodes);

    /// <summary>
    /// Texts that may be the same as the English ones in a language (lang → message keys, or "summary.&lt;command&gt;").
    /// Empty today; add a key here only when the identical text is right (e.g. a message that is only a command).
    /// </summary>
    private static readonly Dictionary<string, string[]> SameAsEnglish = new();

    private static readonly Regex Placeholder = new(@"\{([A-Za-z0-9_]+)\}", RegexOptions.CultureInvariant);
    private static readonly Regex Swedish = new("[åäöÅÄÖ]", RegexOptions.CultureInvariant);
    /// <summary>German has ä and ö of its own: look for å and common Swedish words instead.</summary>
    private static readonly Regex SwedishInGerman = new(@"[åÅ]|\b(och|inte|är|för|stöds|finns|simulatorn)\b", RegexOptions.CultureInvariant);

    /// <summary>
    /// A message key passed as a string literal to Msg or one of its wrappers
    /// (Dim, Note, Tip, DimNote, Unsupported, AwkUnsupported.Feature), optionally after one argument (sh, ctx, lang).
    /// </summary>
    private static readonly Regex KeyInCode = new(
        @"\b(?:Msg|Dim|Note|Tip|DimNote|Unsupported|Feature)\(\s*(?:[A-Za-z_][\w.]*\s*,\s*)?""([a-z]+\.[A-Za-z0-9.]+)""",
        RegexOptions.CultureInvariant);

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new DirectoryNotFoundException("Codestead.sln");
    }

    private static string I18nDir => Path.Combine(RepoRoot(), "src", "Codestead.Shell", "i18n");

    private static HashSet<string> Names(string text) => Placeholder.Matches(text).Select(m => m.Groups[1].Value).ToHashSet();

    /// <summary>The commands help shows, with the summaries written in the code.</summary>
    private static List<CommandDef> Commands() =>
        IndexCmd.Commands.Where(kv => kv.Value.Name == kv.Key && !kv.Key.StartsWith("__", StringComparison.Ordinal))
            .Select(kv => kv.Value).OrderBy(d => d.Name, StringComparer.Ordinal).ToList();

    [Fact(DisplayName = "det finns en fil för varje språk")]
    public void AFileForEveryLanguage()
    {
        Assert.Equal(LangCodes.Order(StringComparer.Ordinal), ShellI18n.Languages.Order(StringComparer.Ordinal));
    }

    [Theory(DisplayName = "samma nycklar och platshållare som engelskan")]
    [MemberData(nameof(Languages))]
    public void SameKeysAndPlaceholdersAsEnglish(string lang)
    {
        var en = ShellI18n.Messages("en");
        var msgs = ShellI18n.Messages(lang);
        Assert.Equal(en.Keys.Order(StringComparer.Ordinal), msgs.Keys.Order(StringComparer.Ordinal));
        foreach (var (key, text) in en)
        {
            Assert.True(Names(text).SetEquals(Names(msgs[key])), $"{lang}/{key}: placeholders differ:\n{text}\n{msgs[key]}");
            Assert.False(string.IsNullOrWhiteSpace(msgs[key]), $"{lang}/{key} is empty");
        }
        Assert.Equal(ShellI18n.Summaries("en").Keys.Order(StringComparer.Ordinal), ShellI18n.Summaries(lang).Keys.Order(StringComparer.Ordinal));
        Assert.All(ShellI18n.Summaries(lang), kv => Assert.False(string.IsNullOrWhiteSpace(kv.Value), $"{lang}/{kv.Key} is empty"));
    }

    [Theory(DisplayName = "inga svenska tecken och inget oöversatt")]
    [MemberData(nameof(Languages))]
    public void TranslatedAndNoSwedish(string lang)
    {
        if (lang == "en") return;
        var allowed = SameAsEnglish.GetValueOrDefault(lang) ?? [];
        var texts = ShellI18n.Messages(lang).Select(kv => (Key: kv.Key, Text: kv.Value, En: ShellI18n.Messages("en")[kv.Key]))
            .Concat(ShellI18n.Summaries(lang).Select(kv => (Key: "summary." + kv.Key, Text: kv.Value, En: ShellI18n.Summaries("en")[kv.Key])));
        var swedish = lang == "de" ? SwedishInGerman : Swedish;
        foreach (var (key, text, en) in texts)
        {
            if (lang != "sv") Assert.False(swedish.IsMatch(text), $"{lang}/{key}: leftover Swedish: {text}");
            if (!allowed.Contains(key)) Assert.True(text != en, $"{lang}/{key} is the same as the English text: {text}");
        }
    }

    [Fact(DisplayName = "engelska och svenska sammanfattningar kommer från koden")]
    public void SummariesComeFromTheCode()
    {
        var expected = new Dictionary<string, Func<CommandDef, string>>
        {
            ["en"] = ManEnCmd.EnglishSummary,
            ["sv"] = d => d.Summary,
        };
        if (Environment.GetEnvironmentVariable("CODESTEAD_UPDATE_SHELL_I18N") == "1")
        {
            foreach (var (lang, summary) in expected) WriteSummaries(lang, Commands().ToDictionary(d => d.Name, summary));
            return;
        }
        foreach (var (lang, summary) in expected)
        {
            var json = ShellI18n.Summaries(lang);
            Assert.Equal(Commands().Select(d => d.Name), json.Keys.Order(StringComparer.Ordinal));
            foreach (var def in Commands())
                Assert.True(json[def.Name] == summary(def),
                    $"{lang}.json: the summary of {def.Name} differs from the code. Run CODESTEAD_UPDATE_SHELL_I18N=1 dotnet test --project tests/Codestead.Shell.Tests");
        }
    }

    private static void WriteSummaries(string lang, Dictionary<string, string> summaries)
    {
        var path = Path.Combine(I18nDir, $"{lang}.json");
        var root = JsonNode.Parse(File.ReadAllText(path))!.AsObject();
        var obj = new JsonObject();
        foreach (var (name, text) in summaries.OrderBy(kv => kv.Key, StringComparer.Ordinal)) obj[name] = text;
        root["summaries"] = obj;
        var options = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        File.WriteAllText(path, root.ToJsonString(options) + "\n");
    }

    [Fact(DisplayName = "varje nyckel i koden finns, och varje nyckel används")]
    public void EveryKeyExistsAndIsUsed()
    {
        var src = Path.Combine(RepoRoot(), "src", "Codestead.Shell");
        var used = Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .SelectMany(f => KeyInCode.Matches(File.ReadAllText(f)).Select(m => m.Groups[1].Value))
            .ToHashSet();
        var keys = ShellI18n.Messages("en").Keys.ToHashSet();
        Assert.Empty(used.Except(keys));
        Assert.Empty(keys.Except(used));
    }

    [Fact(DisplayName = "en saknad nyckel eller ett okänt språk ger engelska")]
    public void FallsBackToEnglish()
    {
        Assert.Equal(ShellI18n.Msg("en", "shell.internalError"), ShellI18n.Msg("xx", "shell.internalError"));
        Assert.Equal("no.such.key", ShellI18n.Msg("de", "no.such.key"));
        Assert.Equal(ShellI18n.Summaries("en")["cd"], ManEnCmd.SummaryFor(IndexCmd.Commands["cd"], new TestShell("ubuntu", "xx").Sh));
    }

    // ---------- the simulator speaks the student's language ----------

    [Fact(DisplayName = "tipsrader, välkomsttext och help på tyska")]
    public void GermanHintsWelcomeAndHelp()
    {
        var t = new TestShell("fedora", "de");
        var cowsay = t.Run("cowsay hej").Out;
        Assert.Contains("command not found", cowsay); // the imitated bash error stays English
        Assert.Contains("Tipp vom Simulator: Der Befehl ist im Paket '", cowsay);
        Assert.Contains("Siehe das Kapitel über Paketverwaltung.", cowsay);

        Assert.Contains("Simuliertes Terminal (", UtilCmd.StripAnsi(t.Sh.Welcome()));
        Assert.Contains("Gib 'help' ein", UtilCmd.StripAnsi(t.Sh.Welcome()));

        var help = t.Run("help").Out;
        Assert.Contains("Befehle in diesem simulierten Terminal", help);
        Assert.Contains("Wechselt das aktuelle Verzeichnis", help);
        Assert.Contains("Das ist ein simuliertes Terminal", t.Run("exit").Out);

        // Man pages are not translated, like on a real system.
        var man = t.Run("man ls").Out;
        Assert.Contains("DESCRIPTION", man);
    }

    [Fact(DisplayName = "tal skrivs som i språket")]
    public void NumbersFollowTheLanguage()
    {
        string Loop(string lang) => new TestShell("ubuntu", lang).Run("while true; do true; done").Out;
        Assert.Contains("nach 20.000 Schritten", Loop("de"));
        Assert.Contains("after 20,000 steps", Loop("en"));
        Assert.Contains("efter 20 000 steg", Loop("sv"));
    }

    [Theory(DisplayName = "välkomsttexten på alla språk")]
    [InlineData("es", "Terminal simulada")]
    [InlineData("zh", "模拟终端")]
    [InlineData("hi", "सिम्युलेटेड टर्मिनल")]
    [InlineData("ar", "طرفية محاكاة")]
    [InlineData("pt", "Terminal simulado")]
    [InlineData("fr", "Terminal simulé")]
    [InlineData("ru", "Симулированный терминал")]
    [InlineData("ja", "シミュレーションのターミナル")]
    public void WelcomeInEveryLanguage(string lang, string expected)
    {
        Assert.Contains(expected, UtilCmd.StripAnsi(new TestShell("ubuntu", lang).Sh.Welcome()));
    }
}
