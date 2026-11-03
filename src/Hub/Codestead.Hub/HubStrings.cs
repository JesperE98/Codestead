using System.Text.Json;
using System.Text.RegularExpressions;

namespace Codestead.Hub;

/// <summary>A language of the user interface (the same 11 as Codestead Linux).</summary>
public sealed record HubLanguage(string Code, string Name, bool RightToLeft = false);

/// <summary>The hub's texts in i18n/&lt;lang&gt;.json (embedded). Missing keys fall back to English.</summary>
public static class HubStrings
{
    public static readonly IReadOnlyList<HubLanguage> Languages = new HubLanguage[]
    {
        new("en", "English"), new("sv", "Svenska"), new("es", "Español"), new("zh", "中文"),
        new("hi", "हिन्दी"), new("ar", "العربية", true), new("pt", "Português"), new("fr", "Français"),
        new("de", "Deutsch"), new("ru", "Русский"), new("ja", "日本語"),
    };

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
