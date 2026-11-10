using System.Globalization;
using System.Text.Json;
using Codestead.Common;

namespace Codestead.GP.Course;

/// <summary>The user-interface texts of Codestead GP (ui/&lt;lang&gt;.json); a key missing in a language falls back to English.</summary>
public static class UiStrings
{
    private static readonly Lazy<Dictionary<string, Dictionary<string, string>>> All = new(Load);

    public static IReadOnlyDictionary<string, string>? For(string lang) => All.Value.TryGetValue(lang, out var d) ? d : null;

    private static Dictionary<string, Dictionary<string, string>> Load()
    {
        var all = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        foreach (var lang in Languages.All)
        {
            var json = Resources.Read($"ui/{lang.Code}.json");
            if (json is null) continue;
            using var doc = JsonDocument.Parse(json);
            all[lang.Code] = doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "", StringComparer.Ordinal);
        }
        return all;
    }

    public static string Translate(string lang, string key, IReadOnlyDictionary<string, object>? args = null) =>
        Translator.Translate(For, Languages.FallbackChain(lang), key, args, v => v switch
        {
            null => "",
            IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
            _ => v.ToString() ?? "",
        });
}
