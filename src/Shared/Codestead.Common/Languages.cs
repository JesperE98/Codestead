using System.Text.Json;

namespace Codestead.Common;

/// <summary>
/// The languages of every Codestead app, read from build/languages.json (embedded). The first offered language
/// is the default; parked languages keep their files but are not offered.
/// </summary>
public static class Languages
{
    private sealed record LanguageFile(List<LanguageInfo> Languages);

    /// <summary>Every language with texts in the repository, offered or parked, in menu order.</summary>
    public static IReadOnlyList<LanguageInfo> All { get; } = Load();

    /// <summary>The languages the apps offer, in menu order.</summary>
    public static IReadOnlyList<LanguageInfo> Offered { get; } = All.Where(l => l.Offered).ToList();

    /// <summary>The language shown the first time (English).</summary>
    public static string Default => Offered[0].Code;

    public static bool IsOffered(string? code) => code is not null && Offered.Any(l => l.Code == code);

    public static LanguageInfo? Find(string? code) => All.FirstOrDefault(l => l.Code == code);

    /// <summary>The order texts are looked for when one is missing in a language: the language, English, Swedish (the original).</summary>
    public static IReadOnlyList<string> FallbackChain(string lang) => new[] { lang, "en", "sv" }.Distinct().ToList();

    private static List<LanguageInfo> Load()
    {
        using var s = typeof(Languages).Assembly.GetManifestResourceStream("languages.json")
            ?? throw new InvalidOperationException("languages.json is not embedded (build/languages.json).");
        var file = JsonSerializer.Deserialize<LanguageFile>(s, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (file?.Languages is not { Count: > 0 } list) throw new InvalidOperationException("build/languages.json has no languages.");
        return list;
    }
}
