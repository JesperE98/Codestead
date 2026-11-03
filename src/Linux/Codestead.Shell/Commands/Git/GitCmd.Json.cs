using System.Text.Json;

namespace Codestead.Shell.Commands;

// JavaScript object semantics (key order, Set) and JSON.stringify(x, null, 1), as in the TypeScript.

public static partial class GitCmd
{
    /// <summary>
    /// A plain JS object used as a map (Record&lt;string, T&gt;): missing keys read as null and
    /// keys iterate like Object.keys (array-index keys first in numeric order, then insertion order).
    /// </summary>
    private sealed class JsMap<T> where T : class
    {
        private readonly OrderedDictionary<string, T> d = new(StringComparer.Ordinal);

        public T? this[string key]
        {
            get => d.TryGetValue(key, out var v) ? v : null;
            set => d[key] = value!;
        }

        public bool Has(string key) => d.ContainsKey(key);
        public void Delete(string key) => d.Remove(key);
        public int Count => d.Count;
        public List<string> Keys => JsKeyOrder(d.Keys);

        /// <summary>{ ...this }</summary>
        public JsMap<T> Copy()
        {
            var c = new JsMap<T>();
            foreach (var k in Keys) c[k] = d[k];
            return c;
        }

        /// <summary>{ ...this, ...other }</summary>
        public JsMap<T> Merge(JsMap<T> other)
        {
            var c = Copy();
            foreach (var k in other.Keys) c[k] = other[k];
            return c;
        }
    }

    private static bool IsArrayIndex(string k)
    {
        if (k.Length == 0 || k.Length > 10) return false;
        if (k == "0") return true;
        if (k[0] < '1' || k[0] > '9') return false;
        foreach (var ch in k)
            if (ch < '0' || ch > '9') return false;
        return ulong.Parse(k, CultureInfo.InvariantCulture) < 4294967295UL;
    }

    /// <summary>The order Object.keys gives for keys inserted in this order.</summary>
    private static List<string> JsKeyOrder(IEnumerable<string> keys)
    {
        var all = keys.ToList();
        var idx = all.Where(IsArrayIndex).OrderBy(k => ulong.Parse(k, CultureInfo.InvariantCulture)).ToList();
        if (idx.Count == 0) return all;
        idx.AddRange(all.Where(k => !IsArrayIndex(k)));
        return idx;
    }

    /// <summary>new Set([...a, ...b]) – distinct values in first-seen order.</summary>
    private static List<string> Union(params IEnumerable<string>[] lists)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var res = new List<string>();
        foreach (var l in lists)
            foreach (var x in l)
                if (seen.Add(x)) res.Add(x);
        return res;
    }

    /// <summary>A Set&lt;string&gt; that iterates in insertion order.</summary>
    private sealed class OSet : IEnumerable<string>
    {
        private readonly HashSet<string> set = new(StringComparer.Ordinal);
        private readonly List<string> order = new();

        public bool Add(string x)
        {
            if (!set.Add(x)) return false;
            order.Add(x);
            return true;
        }

        public bool Has(string x) => set.Contains(x);
        public int Count => order.Count;
        public IEnumerator<string> GetEnumerator() => order.GetEnumerator();
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }

    /// <summary>arr.slice(start, end) – List&lt;T&gt;.Slice is (start, count) in .NET, so call the JS version explicitly.</summary>
    private static List<T> JsSlice<T>(List<T> list, int start, int? end = null) => Js.Slice<T>(list, start, end);

    private static List<string> SortedOrdinal(IEnumerable<string> xs)
    {
        var l = xs.ToList();
        l.Sort(StringComparer.Ordinal);
        return l;
    }

    private static string JsonQuote(string s)
    {
        var sb = new StringBuilder("\"");
        for (int i = 0; i < s.Length; i++)
        {
            char ch = s[i];
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20) sb.Append($"\\u{(int)ch:x4}");
                    else if (char.IsHighSurrogate(ch) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        sb.Append(ch).Append(s[i + 1]);
                        i++;
                    }
                    else if (char.IsSurrogate(ch)) sb.Append($"\\u{(int)ch:x4}");
                    else sb.Append(ch);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }

    /// <summary>
    /// Serialises a value like JSON.stringify(v, null, 1). Values: string, long/int,
    /// List&lt;object&gt; (array) or List&lt;KeyValuePair&lt;string, object?&gt;&gt; (object; null values are skipped).
    /// </summary>
    private static string JsonStringify(object v, string indent = "")
    {
        var inner = indent + " ";
        switch (v)
        {
            case string s:
                return JsonQuote(s);
            case int n:
                return n.ToString(CultureInfo.InvariantCulture);
            case long n:
                return n.ToString(CultureInfo.InvariantCulture);
            case List<KeyValuePair<string, object?>> obj:
            {
                var parts = obj.Where(kv => kv.Value is not null).Select(kv => $"{inner}{JsonQuote(kv.Key)}: {JsonStringify(kv.Value!, inner)}").ToList();
                return parts.Count == 0 ? "{}" : "{\n" + string.Join(",\n", parts) + "\n" + indent + "}";
            }
            case List<object> arr:
            {
                if (arr.Count == 0) return "[]";
                return "[\n" + string.Join(",\n", arr.Select(x => inner + JsonStringify(x, inner))) + "\n" + indent + "]";
            }
            default:
                throw new ArgumentException("unsupported JSON value");
        }
    }

    private static JsMap<string> TreeFromJson(JsonElement e)
    {
        var t = new JsMap<string>();
        if (e.ValueKind != JsonValueKind.Object) return t;
        foreach (var p in e.EnumerateObject())
        {
            if (p.Value.ValueKind == JsonValueKind.String) t[p.Name] = p.Value.GetString()!;
            else if (p.Value.ValueKind is not JsonValueKind.Null) t[p.Name] = p.Value.ToString();
        }
        return t;
    }
}
