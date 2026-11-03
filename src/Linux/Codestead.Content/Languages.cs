namespace Codestead.Content;

// Port of src/i18n/languages.ts – the languages the app is available in. Swedish is the original
// language; English is the fallback for everything that lacks a translation.

public partial class Language
{
    public Lang Code { get; set; } = "";
    /// <summary>The language's name in the language itself.</summary>
    public string Name { get; set; } = "";
    /// <summary>Writing direction: "ltr" or "rtl".</summary>
    public string Dir { get; set; } = "ltr";
}

public static partial class LanguagesLib
{
    public static List<Language> Languages { get; } = new()
    {
        new() { Code = "sv", Name = "Svenska", Dir = "ltr" },
        new() { Code = "en", Name = "English", Dir = "ltr" },
        new() { Code = "es", Name = "Español", Dir = "ltr" },
        new() { Code = "zh", Name = "中文", Dir = "ltr" },
        new() { Code = "hi", Name = "हिन्दी", Dir = "ltr" },
        new() { Code = "ar", Name = "العربية", Dir = "rtl" },
        new() { Code = "pt", Name = "Português", Dir = "ltr" },
        new() { Code = "fr", Name = "Français", Dir = "ltr" },
        new() { Code = "de", Name = "Deutsch", Dir = "ltr" },
        new() { Code = "ru", Name = "Русский", Dir = "ltr" },
        new() { Code = "ja", Name = "日本語", Dir = "ltr" },
    };

    public static bool IsLang(string? code) => code is not null && Languages.Any(l => l.Code == code);

    /// <summary>
    /// The language to show the first time (when nothing is saved): always English.
    /// (The TypeScript version picked the browser's language; the owner wants English as the default.)
    /// </summary>
    public static Lang DetectLang() => "en";

    /// <summary>The order we look in when a text is missing in the chosen language.</summary>
    public static List<Lang> FallbackChain(Lang lang) => new[] { lang, "en", "sv" }.Distinct().ToList();
}
