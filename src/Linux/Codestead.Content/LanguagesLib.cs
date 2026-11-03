namespace Codestead.Content;

// The languages the app is available in, read from build/languages.json (shared with the hub and the
// release flow). Swedish is the original language; English is the default and the fallback for
// everything that lacks a translation.

public static partial class LanguagesLib
{
    /// <summary>Every language with texts in the repository, offered or parked (build/languages.json).</summary>
    public static IReadOnlyList<Language> All { get; } = Codestead.Common.Languages.All
        .Select(l => new Language { Code = l.Code, Name = l.Name, Dir = l.Dir, Offered = l.Offered }).ToList();

    /// <summary>The languages the app offers, in menu order. Parked languages are left out.</summary>
    public static List<Language> Languages { get; } = All.Where(l => l.Offered).ToList();

    public static bool IsLang(string? code) => code is not null && Languages.Any(l => l.Code == code);

    /// <summary>
    /// The language to show the first time (when nothing is saved): always English.
    /// (The TypeScript version picked the browser's language; the owner wants English as the default.)
    /// </summary>
    public static Lang DetectLang() => Codestead.Common.Languages.Default;

    /// <summary>The order we look in when a text is missing in the chosen language.</summary>
    public static List<Lang> FallbackChain(Lang lang) => new[] { lang, "en", "sv" }.Distinct().ToList();
}
