using System.Reflection;
using System.Text.Json;

namespace Codestead.Shell;

// The simulator's own texts (tips, notes, the welcome banner and the one-line summaries shown by
// help) in every language. They live in i18n/<lang>.json, embedded as shell-i18n/<lang>.json:
//
//   { "messages": { "<key>": "text with {placeholders}" }, "summaries": { "<command>": "..." } }
//
// en.json is the source; a missing key falls back to English. The summaries in en.json and sv.json
// are generated from CommandDef.SummaryEn/Summary (see ShellI18nTests) – edit them in the code.
// Output that imitates real programs (error messages, man pages) is not translated.

public static partial class ShellI18n
{
    public const string Source = "en";

    private sealed class Texts
    {
        public Dictionary<string, string> Messages { get; } = new(StringComparer.Ordinal);
        public Dictionary<string, string> Summaries { get; } = new(StringComparer.Ordinal);
    }

    private static readonly Assembly Asm = typeof(ShellI18n).Assembly;
    private const string Prefix = "shell-i18n/";

    private static readonly Lazy<Dictionary<string, Texts>> All = new(Load);

    private static Dictionary<string, Texts> Load()
    {
        var all = new Dictionary<string, Texts>(StringComparer.Ordinal);
        foreach (var name in Asm.GetManifestResourceNames())
        {
            var n = name.Replace('\\', '/');
            if (!n.StartsWith(Prefix, StringComparison.Ordinal) || !n.EndsWith(".json", StringComparison.Ordinal)) continue;
            using var stream = Asm.GetManifestResourceStream(name)!;
            using var doc = JsonDocument.Parse(stream);
            var texts = new Texts();
            if (doc.RootElement.TryGetProperty("messages", out var m))
                foreach (var p in m.EnumerateObject()) texts.Messages[p.Name] = p.Value.GetString() ?? "";
            if (doc.RootElement.TryGetProperty("summaries", out var s))
                foreach (var p in s.EnumerateObject()) texts.Summaries[p.Name] = p.Value.GetString() ?? "";
            all[n[Prefix.Length..^".json".Length]] = texts;
        }
        return all;
    }

    /// <summary>The language codes that have a file (en, sv, de ...).</summary>
    public static IReadOnlyCollection<string> Languages => All.Value.Keys;

    /// <summary>All message texts of a language (empty when the language has no file).</summary>
    public static IReadOnlyDictionary<string, string> Messages(string lang) =>
        All.Value.TryGetValue(lang, out var t) ? t.Messages : new Dictionary<string, string>();

    /// <summary>All command summaries of a language (empty when the language has no file).</summary>
    public static IReadOnlyDictionary<string, string> Summaries(string lang) =>
        All.Value.TryGetValue(lang, out var t) ? t.Summaries : new Dictionary<string, string>();

    private static readonly Regex PlaceholderRe = new(@"\{([A-Za-z0-9_]+)\}", RegexOptions.CultureInvariant);

    /// <summary>The message <paramref name="key"/> in <paramref name="lang"/> (else English) with {placeholders} filled in.</summary>
    public static string Msg(string lang, string key, params (string Name, object? Value)[] args)
    {
        var text = Lookup(lang, key, t => t.Messages) ?? key;
        if (args.Length == 0) return text;
        return PlaceholderRe.Replace(text, m =>
        {
            foreach (var (name, value) in args)
                if (name == m.Groups[1].Value) return Format(value);
            return m.Value;
        });
    }

    /// <summary>The one-line summary of a command in <paramref name="lang"/> (else English), or null.</summary>
    public static string? Summary(string lang, string command) => Lookup(lang, command, t => t.Summaries);

    private static string? Lookup(string lang, string key, Func<Texts, Dictionary<string, string>> pick)
    {
        foreach (var l in new[] { lang, Source })
            if (All.Value.TryGetValue(l, out var t) && pick(t).TryGetValue(key, out var v)) return v;
        return null;
    }

    private static string Format(object? value) => value switch
    {
        null => "",
        string s => s,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };

    /// <summary>
    /// The culture used to format numbers for a language (e.g. 10 000 in Swedish, 10,000 in English,
    /// 10.000 in German). Numbers that should follow the language are formatted with it before they
    /// are passed to <see cref="Msg"/>.
    /// </summary>
    public static CultureInfo Culture(string lang)
    {
        var name = lang switch
        {
            "sv" => "sv-SE",
            "en" => "en-US",
            _ => lang,
        };
        try
        {
            return CultureInfo.GetCultureInfo(name);
        }
        catch (CultureNotFoundException)
        {
            return CultureInfo.InvariantCulture;
        }
    }
}
