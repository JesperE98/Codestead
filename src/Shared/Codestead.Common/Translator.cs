using System.Globalization;
using System.Text.RegularExpressions;

namespace Codestead.Common;

/// <summary>Looks up user-interface texts by language with a fallback chain and fills in {placeholders}.</summary>
public static class Translator
{
    private static readonly Regex Placeholder = new(@"\{([A-Za-z0-9_]+)\}", RegexOptions.CultureInvariant);

    /// <summary>The {names} in a text.</summary>
    public static IEnumerable<string> Placeholders(string text) => Placeholder.Matches(text).Select(m => m.Groups[1].Value);

    /// <summary>
    /// The text of <paramref name="key"/> in the first language of <paramref name="chain"/> that has it (the key itself if
    /// none has), with its {placeholders} filled from <paramref name="args"/>. Unknown placeholders stay as they are.
    /// </summary>
    /// <param name="format">How a value becomes text (default: invariant culture).</param>
    public static string Translate(
        Func<string, IReadOnlyDictionary<string, string>?> texts, IEnumerable<string> chain, string key,
        IReadOnlyDictionary<string, object>? args = null, Func<object?, string>? format = null)
    {
        var text = key;
        foreach (var lang in chain)
        {
            if (texts(lang) is { } dict && dict.TryGetValue(key, out var v))
            {
                text = v;
                break;
            }
        }
        return Fill(text, args, format);
    }

    /// <summary>Fills in {placeholders}; unknown ones stay as they are.</summary>
    public static string Fill(string text, IReadOnlyDictionary<string, object>? args, Func<object?, string>? format = null)
    {
        if (args is null || args.Count == 0) return text;
        format ??= Invariant;
        return Placeholder.Replace(text, m => args.TryGetValue(m.Groups[1].Value, out var value) ? format(value) : m.Value);
    }

    private static string Invariant(object? value) => value switch
    {
        null => "",
        string s => s,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };
}
