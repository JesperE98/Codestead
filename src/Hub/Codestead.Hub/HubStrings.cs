using System.Text.Json;
using System.Text.RegularExpressions;

namespace Codestead.Hub;

/// <summary>The hub's texts in i18n/&lt;lang&gt;.json (embedded). Missing keys fall back to English.</summary>
public static class HubStrings
{
    /// <summary>The languages the hub offers, in menu order (build/languages.json; parked languages are left out).</summary>
    public static readonly IReadOnlyList<HubLanguage> Languages =
        Codestead.Common.Languages.Offered.Select(l => new HubLanguage(l.Code, l.Name, l.RightToLeft)).ToList();

    private static readonly Dictionary<string, Dictionary<string, string>> Texts = Languages.ToDictionary(l => l.Code, l => Load(l.Code));

    private static Dictionary<string, string> Load(string lang)
    {
        using var s = typeof(HubStrings).Assembly.GetManifestResourceStream($"hub-i18n/{lang}.json");
        return s is null ? new() : JsonSerializer.Deserialize<Dictionary<string, string>>(s) ?? new();
    }

    public static IReadOnlyDictionary<string, string> For(string lang) => Texts.TryGetValue(lang, out var t) ? t : Texts["en"];

    public static bool IsLanguage(string? code) => code is not null && Texts.ContainsKey(code);

    public static string T(string lang, string key, params (string Name, object Value)[] args) =>
        Codestead.Common.Translator.Translate(l => Texts.GetValueOrDefault(l), [lang, "en"], key,
            args.Length == 0 ? null : args.ToDictionary(a => a.Name, a => a.Value),
            v => Convert.ToString(v, System.Globalization.CultureInfo.CurrentCulture) ?? "");
}
