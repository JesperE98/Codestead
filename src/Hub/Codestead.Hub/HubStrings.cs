using System.Text.Json;
using System.Text.RegularExpressions;

namespace Codestead.Hub;

/// <summary>The hub's texts in i18n/&lt;lang&gt;.json (embedded). Missing keys fall back to English.</summary>
public static class HubStrings
{
    /// <summary>The languages the hub offers, in menu order (parked languages are left out).</summary>
    public static readonly IReadOnlyList<HubLanguage> Languages = LoadLanguages();

    private sealed record LanguageEntry(string Code, string Name, string Dir, bool Offered);

    private sealed record LanguageFile(List<LanguageEntry> Languages);

    private static List<HubLanguage> LoadLanguages()
    {
        using var s = typeof(HubStrings).Assembly.GetManifestResourceStream("languages.json")
            ?? throw new InvalidOperationException("languages.json is not embedded (build/languages.json).");
        var file = JsonSerializer.Deserialize<LanguageFile>(s, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("build/languages.json has no languages.");
        return file.Languages.Where(l => l.Offered).Select(l => new HubLanguage(l.Code, l.Name, l.Dir == "rtl")).ToList();
    }

    private static readonly Dictionary<string, Dictionary<string, string>> Texts = Languages.ToDictionary(l => l.Code, l => Load(l.Code));

    private static Dictionary<string, string> Load(string lang)
    {
        using var s = typeof(HubStrings).Assembly.GetManifestResourceStream($"hub-i18n/{lang}.json");
        return s is null ? new() : JsonSerializer.Deserialize<Dictionary<string, string>>(s) ?? new();
    }

    public static IReadOnlyDictionary<string, string> For(string lang) => Texts.TryGetValue(lang, out var t) ? t : Texts["en"];

    public static bool IsLanguage(string? code) => code is not null && Texts.ContainsKey(code);

    private static readonly Regex Placeholder = new(@"\{([A-Za-z0-9_]+)\}", RegexOptions.CultureInvariant);

    public static string T(string lang, string key, params (string Name, object Value)[] args)
    {
        if (!For(lang).TryGetValue(key, out var text) && !Texts["en"].TryGetValue(key, out text)) text = key;
        return Placeholder.Replace(text, m => args.FirstOrDefault(a => a.Name == m.Groups[1].Value) is { Name: not null } a ? Convert.ToString(a.Value, System.Globalization.CultureInfo.CurrentCulture) ?? "" : m.Value);
    }
}
