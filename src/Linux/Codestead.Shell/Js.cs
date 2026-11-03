using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codestead.Shell;

/// <summary>
/// Helpers that reproduce JavaScript semantics the TypeScript original relied on
/// (string slicing, number formatting, sorting, dates, JSON cloning).
/// Use these when porting so behaviour stays identical.
/// </summary>
public static class Js
{
    private static readonly AsyncLocal<Func<long>?> clockOverride = new();

    /// <summary>
    /// Optional clock override for tests (milliseconds since the Unix epoch). It only applies to the
    /// code that set it (and what it calls), so tests running in parallel do not affect each other.
    /// </summary>
    public static Func<long>? ClockOverride
    {
        get => clockOverride.Value;
        set => clockOverride.Value = value;
    }

    /// <summary>Date.now()</summary>
    public static long Now() => ClockOverride?.Invoke() ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    /// <summary>new Date(ms) in local time.</summary>
    public static DateTime LocalDate(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime;

    /// <summary>new Date() in local time.</summary>
    public static DateTime LocalNow() => LocalDate(Now());

    /// <summary>String.prototype.slice(start, end) with negative indices and clamping.</summary>
    public static string Slice(this string s, int start, int? end = null)
    {
        int len = s.Length;
        int from = start < 0 ? Math.Max(len + start, 0) : Math.Min(start, len);
        int to = end is null ? len : end.Value < 0 ? Math.Max(len + end.Value, 0) : Math.Min(end.Value, len);
        return to > from ? s.Substring(from, to - from) : "";
    }

    /// <summary>Array.prototype.slice(start, end) with negative indices and clamping.</summary>
    public static List<T> Slice<T>(this IReadOnlyList<T> list, int start, int? end = null)
    {
        int len = list.Count;
        int from = start < 0 ? Math.Max(len + start, 0) : Math.Min(start, len);
        int to = end is null ? len : end.Value < 0 ? Math.Max(len + end.Value, 0) : Math.Min(end.Value, len);
        var result = new List<T>(Math.Max(0, to - from));
        for (int i = from; i < to; i++) result.Add(list[i]);
        return result;
    }

    /// <summary>Array.prototype.at(-1) etc. Returns default when out of range.</summary>
    public static T? At<T>(this IReadOnlyList<T> list, int index)
    {
        int i = index < 0 ? list.Count + index : index;
        return i >= 0 && i < list.Count ? list[i] : default;
    }

    /// <summary>s[i] in JS: the character as a string, or "" when out of range (JS gives undefined).</summary>
    public static string CharAt(this string s, int i) => i >= 0 && i < s.Length ? s[i].ToString() : "";

    /// <summary>"x".repeat(n)</summary>
    public static string Repeat(this string s, int count) => count <= 0 ? "" : string.Concat(Enumerable.Repeat(s, count));

    /// <summary>[...s].length – number of Unicode code points.</summary>
    public static int CodePointLength(string s) => s.EnumerateRunes().Count();

    /// <summary>new TextEncoder().encode(s).length</summary>
    public static int Utf8Length(string s) => Encoding.UTF8.GetByteCount(s);

    /// <summary>Default JS sort for strings (UTF-16 code unit order).</summary>
    public static readonly StringComparer Ordinal = StringComparer.Ordinal;

    /// <summary>a.localeCompare(b)</summary>
    public static int LocaleCompare(string a, string b) => string.Compare(a, b, CultureInfo.InvariantCulture, CompareOptions.None);

    /// <summary>Sorts in place with the JS default order and returns the list (like arr.sort()).</summary>
    public static List<string> SortJs(this List<string> list)
    {
        list.Sort(StringComparer.Ordinal);
        return list;
    }

    /// <summary>Stable sort (JS Array.prototype.sort is stable).</summary>
    public static List<T> StableSort<T>(this List<T> list, Comparison<T> cmp)
    {
        var sorted = list.Select((item, idx) => (item, idx)).ToList();
        sorted.Sort((a, b) =>
        {
            int c = cmp(a.item, b.item);
            return c != 0 ? c : a.idx.CompareTo(b.idx);
        });
        list.Clear();
        list.AddRange(sorted.Select(x => x.item));
        return list;
    }

    /// <summary>String(n) for a JS number.</summary>
    public static string Num(double n)
    {
        if (double.IsNaN(n)) return "NaN";
        if (double.IsPositiveInfinity(n)) return "Infinity";
        if (double.IsNegativeInfinity(n)) return "-Infinity";
        if (n == Math.Floor(n) && Math.Abs(n) < 1e21) return new System.Numerics.BigInteger(n).ToString(CultureInfo.InvariantCulture);
        return n.ToString("R", CultureInfo.InvariantCulture);
    }

    /// <summary>String(n) for integers.</summary>
    public static string Num(long n) => n.ToString(CultureInfo.InvariantCulture);

    /// <summary>n.toFixed(digits)</summary>
    public static string ToFixed(double n, int digits) =>
        Math.Round(n, digits, MidpointRounding.AwayFromZero).ToString("F" + digits, CultureInfo.InvariantCulture);

    /// <summary>Number(s): the whole (trimmed) string must be numeric, "" is 0, otherwise NaN.</summary>
    public static double Number(string? s)
    {
        if (s is null) return double.NaN;
        var t = s.Trim();
        if (t == "") return 0;
        if (t.StartsWith("0x", StringComparison.OrdinalIgnoreCase) &&
            long.TryParse(t.AsSpan(2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var hex)) return hex;
        if (t == "Infinity" || t == "+Infinity") return double.PositiveInfinity;
        if (t == "-Infinity") return double.NegativeInfinity;
        return double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN;
    }

    /// <summary>parseInt(s, 10): leading whitespace, optional sign, then as many digits as possible.</summary>
    public static double ParseInt(string? s, int radix = 10)
    {
        if (s is null) return double.NaN;
        var m = Regex.Match(s, radix == 16 ? @"^\s*([+-]?)(?:0[xX])?([0-9a-fA-F]+)" : radix == 8 ? @"^\s*([+-]?)([0-7]+)" : @"^\s*([+-]?)(\d+)");
        if (!m.Success) return double.NaN;
        double v = 0;
        foreach (char c in m.Groups[2].Value) v = v * radix + Convert.ToInt32(c.ToString(), 16);
        return m.Groups[1].Value == "-" ? -v : v;
    }

    /// <summary>parseFloat(s)</summary>
    public static double ParseFloat(string? s)
    {
        if (s is null) return double.NaN;
        var m = Regex.Match(s, @"^\s*([+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|Infinity))");
        if (!m.Success) return double.NaN;
        var v = m.Groups[1].Value;
        if (v.EndsWith("Infinity")) return v.StartsWith("-") ? double.NegativeInfinity : double.PositiveInfinity;
        return double.Parse(v, NumberStyles.Float, CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Octal literal: Oct(755) == 0o755 in TypeScript. C# has no octal literals, so permission
    /// bits are written as Js.Oct(644) etc.
    /// </summary>
    public static int Oct(int digits)
    {
        int result = 0, factor = 1;
        for (int n = digits; n > 0; n /= 10, factor *= 8) result += (n % 10) * factor;
        return result;
    }

    /// <summary>Math.trunc</summary>
    public static double Trunc(double v) => Math.Truncate(v);

    /// <summary>Math.random()</summary>
    public static double Random() => System.Random.Shared.NextDouble();

    /// <summary>s.split(re) with JS semantics (captured groups are included, like Regex.Split).</summary>
    public static List<string> Split(string s, Regex re) => s.Length == 0 && re.IsMatch("") ? new List<string>() : re.Split(s).ToList();

    /// <summary>s.split(sep) with JS semantics ("".split(",") gives [""]).</summary>
    public static List<string> Split(string s, string sep) =>
        sep == "" ? s.Select(c => c.ToString()).ToList() : s.Split(sep).ToList();

    /// <summary>s.replace(/re/g, fn) – convenience wrapper.</summary>
    public static string ReplaceAll(string s, Regex re, Func<Match, string> fn) => re.Replace(s, m => fn(m));

    /// <summary>JSON options used for snapshots and deep clones (camelCase, like the original JSON): the shared defaults.</summary>
    public static readonly JsonSerializerOptions JsonOptions = Codestead.Common.JsonDefaults.Options;

    /// <summary>JSON.parse(JSON.stringify(x)) – deep clone.</summary>
    public static T Clone<T>(T value) =>
        JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;

    /// <summary>JSON.stringify(x)</summary>
    public static string Stringify<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);

    /// <summary>JSON.parse(s)</summary>
    public static T? Parse<T>(string json) => JsonSerializer.Deserialize<T>(json, JsonOptions);

    /// <summary>Copies a dictionary ({ ...obj } in JS), keeping insertion order.</summary>
    public static OrderedDictionary<string, T> Copy<T>(OrderedDictionary<string, T> d)
    {
        var copy = new OrderedDictionary<string, T>(StringComparer.Ordinal);
        foreach (var kv in d) copy[kv.Key] = kv.Value;
        return copy;
    }

    /// <summary>obj[key] in JS: the value or null when missing.</summary>
    public static T? Get<T>(this OrderedDictionary<string, T> d, string key) where T : class =>
        d.TryGetValue(key, out var v) ? v : null;

    /// <summary>obj[key] for value types: the value or null when missing.</summary>
    public static T? GetValue<T>(this OrderedDictionary<string, T> d, string key) where T : struct =>
        d.TryGetValue(key, out var v) ? v : null;

    /// <summary>Creates an empty ordered dictionary with ordinal keys (a JS object literal {}).</summary>
    public static OrderedDictionary<string, T> Obj<T>() => new(StringComparer.Ordinal);
}
