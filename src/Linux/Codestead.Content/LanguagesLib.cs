namespace Codestead.Content;

// The languages the app is available in, read from build/languages.json (shared with the hub and the
// release flow). Swedish is the original language; English is the default and the fallback for
// everything that lacks a translation.

public static partial class LanguagesLib
{
    /// <summary>Every language with texts in the repository, offered or parked (build/languages.json).</summary>
    public static IReadOnlyList<Language> All { get; } = Load();

    /// <summary>The languages the app offers, in menu order. Parked languages are left out.</summary>
    public static List<Language> Languages { get; } = All.Where(l => l.Offered).ToList();

    private sealed record LanguageFile(List<Language> Languages);

    private static List<Language> Load()
    {
        using var s = typeof(LanguagesLib).Assembly.GetManifestResourceStream("languages.json")
            ?? throw new InvalidOperationException("languages.json is not embedded (build/languages.json).");
        var file = System.Text.Json.JsonSerializer.Deserialize<LanguageFile>(s, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return file?.Languages ?? throw new InvalidOperationException("build/languages.json has no languages.");
    }

    public static bool IsLang(string? code) => code is not null && Languages.Any(l => l.Code == code);

    /// <summary>
    /// The language to show the first time (when nothing is saved): always English.
    /// (The TypeScript version picked the browser's language; the owner wants English as the default.)
    /// </summary>
    public static Lang DetectLang() => "en";

    /// <summary>The order we look in when a text is missing in the chosen language.</summary>
    public static List<Lang> FallbackChain(Lang lang) => new[] { lang, "en", "sv" }.Distinct().ToList();
}
