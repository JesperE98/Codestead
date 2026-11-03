using System.Reflection;
using System.Text.Json;

namespace Codestead.Shell;

// The student's simulated computer in the student's language: the user name, the names of the exercise
// files and folders, and what people wrote in them (a fruit list, grades, notes, a small web page ...).
// Each language has world/<lang>.json, embedded as world/<lang>.json:
//
//   {
//     "locale": "en_US.UTF-8",
//     "names": { "user": "student", "documents": "documents", "fruits": "fruits.txt", ... },
//     "words": { "userFull": "Student", "helloWorld": "Hello world", ... },
//     "files": { "fruits": "apple\nbanana\n...", "grades": "...", ... }
//   }
//
// "names" are things the student types as file, folder, user, group, variable or branch names. They are
// ASCII so they can be typed on any keyboard (languages in other scripts use the English names).
// "words" are short texts in the student's language. Chapter texts, task texts and the task checks refer
// to both with {{key}} placeholders, e.g. `~/{{documents}}/{{fruits}}`.
//
// What programs write (logs, configuration files, system files) is English in every language, like on a
// real computer. en.json is the source; every language has the same keys (see the world tests).

public sealed partial class World
{
    public const string Source = "en";

    public string Lang { get; private init; } = Source;
    /// <summary>The value of $LANG in the terminal, e.g. "sv_SE.UTF-8".</summary>
    public string Locale { get; private init; } = "en_US.UTF-8";
    public IReadOnlyDictionary<string, string> Names { get; private init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Words { get; private init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Files { get; private init; } = new Dictionary<string, string>();

    /// <summary>The student's user name (also the home directory /home/&lt;user&gt;).</summary>
    public string User => Names["user"];

    public string Home => $"/home/{User}";

    /// <summary>A name or a word.</summary>
    public string this[string key] =>
        Names.TryGetValue(key, out var n) ? n
        : Words.TryGetValue(key, out var w) ? w
        : throw new KeyNotFoundException($"world/{Lang}.json has no \"{key}\"");

    /// <summary>The contents of an exercise file.</summary>
    public string File(string key) =>
        Files.TryGetValue(key, out var f) ? f : throw new KeyNotFoundException($"world/{Lang}.json has no file \"{key}\"");

    private static readonly Regex PlaceholderRe = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);

    /// <summary>Fills in the {{name}} and {{word}} placeholders of this world. Other placeholders are kept.</summary>
    public string Expand(string text) =>
        text.Contains("{{", StringComparison.Ordinal)
            ? PlaceholderRe.Replace(text, m =>
                Names.TryGetValue(m.Groups[1].Value, out var n) ? n
                : Words.TryGetValue(m.Groups[1].Value, out var w) ? w
                : m.Value)
            : text;

    /// <summary>All names and words, for placeholders in texts.</summary>
    public IEnumerable<KeyValuePair<string, string>> Placeholders => Names.Concat(Words);

    // ---------- Loading ----------

    private static readonly Assembly Asm = typeof(World).Assembly;
    private const string Prefix = "world/";

    private static readonly Lazy<Dictionary<string, World>> All = new(Load);

    private static Dictionary<string, World> Load()
    {
        var all = new Dictionary<string, World>(StringComparer.Ordinal);
        foreach (var resource in Asm.GetManifestResourceNames())
        {
            var n = resource.Replace('\\', '/');
            if (!n.StartsWith(Prefix, StringComparison.Ordinal) || !n.EndsWith(".json", StringComparison.Ordinal)) continue;
            using var stream = Asm.GetManifestResourceStream(resource)!;
            var w = Read(n[Prefix.Length..^".json".Length], stream);
            if (w is not null) all[w.Lang] = w;
        }
        // For translators: world files on disk override the built-in ones (see docs/DEVELOPMENT.md).
        var dir = Environment.GetEnvironmentVariable("CODESTEAD_WORLD_DIR");
        if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
            foreach (var file in Directory.GetFiles(dir, "*.json"))
            {
                try
                {
                    using var stream = System.IO.File.OpenRead(file);
                    var world = Read(Path.GetFileNameWithoutExtension(file), stream);
                    if (world is not null) all[world.Lang] = world;
                }
                catch (JsonException)
                {
                    // A file that is being written: keep the built-in world.
                }
            }
        return all;
    }

    private static World? Read(string lang, Stream stream)
    {
        using var doc = JsonDocument.Parse(stream);
        Dictionary<string, string> Map(string prop)
        {
            var d = new Dictionary<string, string>(StringComparer.Ordinal);
            if (doc.RootElement.TryGetProperty(prop, out var o))
                foreach (var p in o.EnumerateObject()) d[p.Name] = p.Value.GetString() ?? "";
            return d;
        }
        return new World
        {
            Lang = lang,
            Locale = doc.RootElement.TryGetProperty("locale", out var l) ? l.GetString() ?? "en_US.UTF-8" : "en_US.UTF-8",
            Names = Map("names"),
            Words = Map("words"),
            Files = Map("files"),
        };
    }

    /// <summary>The language codes that have a world.</summary>
    public static IReadOnlyCollection<string> Languages => All.Value.Keys;

    public static bool Has(string? lang) => lang is not null && All.Value.ContainsKey(lang);

    /// <summary>The world of a language (English when the language has none).</summary>
    public static World Get(string? lang) =>
        lang is not null && All.Value.TryGetValue(lang, out var w) ? w : All.Value[Source];
}
