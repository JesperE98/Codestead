using System.Text.Json;

namespace Codestead.Content;

// Port of src/i18n/ui.ts – all texts in the user interface (buttons, menus, dialogs) in the app's language.
// The texts live in i18n/ui/<lang>.json (generated from ui.ts by build/gen-ui-strings.mjs) and are embedded.
// When a key is missing in a language, English is used, and as a last resort Swedish.

public static partial class UiStrings
{
    private static readonly Lazy<OrderedDictionary<Lang, OrderedDictionary<string, string>>> ui = new(Load);

    /// <summary>UI[lang][key]. Swedish has every key; other languages may lack some.</summary>
    public static OrderedDictionary<Lang, OrderedDictionary<string, string>> Ui => ui.Value;

    /// <summary>All keys (the keys of the Swedish texts, in order). TS: UiKey.</summary>
    public static List<string> Keys => Ui["sv"].Keys.ToList();

    private static OrderedDictionary<Lang, OrderedDictionary<string, string>> Load()
    {
        var all = Js.Obj<OrderedDictionary<string, string>>();
        foreach (var lang in LanguagesLib.Languages)
        {
            var dict = Js.Obj<string>();
            var json = Resources.Read($"ui/{lang.Code}.json");
            if (json is not null)
            {
                using var doc = JsonDocument.Parse(json);
                foreach (var p in doc.RootElement.EnumerateObject()) dict[p.Name] = p.Value.GetString() ?? "";
            }
            all[lang.Code] = dict;
        }
        return all;
    }

    /// <summary>Translates a key and fills in {placeholders}.</summary>
    public static string Translate(Lang lang, string key, IReadOnlyDictionary<string, object>? parameters = null) =>
        Codestead.Common.Translator.Translate(l => Ui.TryGetValue(l, out var d) ? d : null, LanguagesLib.FallbackChain(lang), key, parameters, JsString);

    /// <summary>String(value) in JS for the parameter types the UI uses (strings and numbers).</summary>
    private static string JsString(object? value) => value switch
    {
        null => "null",
        string s => s,
        int i => Js.Num(i),
        long l => Js.Num(l),
        double d => Js.Num(d),
        float f => Js.Num(f),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };
}
