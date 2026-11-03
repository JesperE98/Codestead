using System.Text.Json;

namespace Codestead.Shell.Commands;

// The index (staging area).

public static partial class GitCmd
{
    private sealed class Unmerged
    {
        public string? Base;
        public string? Ours;
        public string? Theirs;
    }

    private sealed class Index
    {
        public JsMap<string> Entries = new();
        /// <summary>Files with a conflict after a merge, with the three versions.</summary>
        public JsMap<Unmerged> Unmerged = new();
    }

    private static Index ReadIndex(Repo r)
    {
        var text = ReadText(r.G, Gpath(r, "index"));
        if (string.IsNullOrEmpty(text)) return new Index();
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw Fatal("index file corrupt");
            var idx = new Index();
            if (root.TryGetProperty("entries", out var entries)) idx.Entries = TreeFromJson(entries);
            if (root.TryGetProperty("unmerged", out var unmerged) && unmerged.ValueKind == JsonValueKind.Object)
            {
                foreach (var p in unmerged.EnumerateObject())
                {
                    string? Str(string k) => p.Value.ValueKind == JsonValueKind.Object && p.Value.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                    idx.Unmerged[p.Name] = new Unmerged { Base = Str("base"), Ours = Str("ours"), Theirs = Str("theirs") };
                }
            }
            return idx;
        }
        catch (JsonException)
        {
            throw Fatal("index file corrupt");
        }
    }

    private static void WriteIndex(Repo r, Index idx)
    {
        List<KeyValuePair<string, object?>> Sorted<T>(JsMap<T> o, Func<T, object> conv) where T : class =>
            JsKeyOrder(SortedOrdinal(o.Keys)).Select(k => new KeyValuePair<string, object?>(k, conv(o[k]!))).ToList();
        var json = new List<KeyValuePair<string, object?>>
        {
            new("version", 1),
            new("entries", Sorted(idx.Entries, h => h)),
            new("unmerged", Sorted(idx.Unmerged, u => new List<KeyValuePair<string, object?>> { new("base", u.Base), new("ours", u.Ours), new("theirs", u.Theirs) })),
        };
        WriteText(r.G, Gpath(r, "index"), JsonStringify(json) + "\n");
    }
}
