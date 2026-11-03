using System.Numerics;

namespace Codestead.Shell.Commands;

// JavaScript number formatting (exact, like V8) used by awk output.

public static partial class AwkCmd
{
    /// <summary>String(n) for any JS number.</summary>
    internal static string JsString(double v)
    {
        if (double.IsNaN(v)) return "NaN";
        if (v == 0) return "0";
        if (double.IsInfinity(v)) return v > 0 ? "Infinity" : "-Infinity";
        if (IsInteger(v) && Math.Abs(v) <= 9007199254740991) return ((long)v).ToString(CultureInfo.InvariantCulture);
        var sign = v < 0 ? "-" : "";
        // Shortest round-trip digits and the decimal exponent.
        var shortest = Math.Abs(v).ToString("R", CultureInfo.InvariantCulture);
        string digits;
        int n;
        if (shortest.Contains('E'))
        {
            var parts = shortest.Split('E');
            digits = parts[0].Replace(".", "");
            n = int.Parse(parts[1], CultureInfo.InvariantCulture) + 1;
        }
        else
        {
            var dot = shortest.IndexOf('.');
            var intPart = dot < 0 ? shortest : shortest[..dot];
            var frac = dot < 0 ? "" : shortest[(dot + 1)..];
            var all = intPart + frac;
            int lead = 0;
            while (lead < all.Length - 1 && all[lead] == '0') lead++;
            digits = all[lead..];
            n = intPart.TrimStart('0').Length;
            if (n == 0) n = -(lead - intPart.Length);
        }
        digits = digits.TrimEnd('0');
        if (digits == "") digits = "0";
        int k = digits.Length;
        if (k <= n && n <= 21) return sign + digits + new string('0', n - k);
        if (0 < n && n <= 21) return sign + digits[..n] + "." + digits[n..];
        if (-6 < n && n <= 0) return sign + "0." + new string('0', -n) + digits;
        int e = n - 1;
        var es = (e >= 0 ? "+" : "-") + Math.Abs(e).ToString(CultureInfo.InvariantCulture);
        return sign + digits[..1] + (k > 1 ? "." + digits[1..] : "") + "e" + es;
    }

    /// <summary>n.toFixed(digits)</summary>
    internal static string JsToFixed(double x, int f)
    {
        if (double.IsNaN(x)) return "NaN";
        if (Math.Abs(x) >= 1e21 || double.IsInfinity(x)) return JsString(x);
        var sign = x < 0 ? "-" : "";
        return sign + Math.Abs(x).ToString("F" + f, CultureInfo.InvariantCulture);
    }

    /// <summary>n.toExponential(digits)</summary>
    internal static string JsToExponential(double x, int f)
    {
        if (!double.IsFinite(x)) return JsString(x);
        var sign = x < 0 ? "-" : "";
        var s = Math.Abs(x).ToString("E" + f, CultureInfo.InvariantCulture);
        var parts = s.Split('E');
        int e = int.Parse(parts[1], CultureInfo.InvariantCulture);
        return $"{sign}{parts[0]}e{(e >= 0 ? "+" : "-")}{Math.Abs(e).ToString(CultureInfo.InvariantCulture)}";
    }

    /// <summary>Number(n.toPrecision(p))</summary>
    private static double JsToPrecisionValue(double x, int p) =>
        double.Parse(x.ToString("E" + (p - 1), CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture);

    /// <summary>Math.round</summary>
    internal static double JsRound(double x)
    {
        if (!double.IsFinite(x)) return x;
        double f = Math.Floor(x);
        return x - f >= 0.5 ? f + 1 : f;
    }

    /// <summary>t.toString(radix) for a non-negative integer double.</summary>
    private static string ToRadix(double t, int radix)
    {
        if (!double.IsFinite(t)) return JsString(t);
        if (radix == 10) return JsString(t);
        var big = new BigInteger(t);
        if (big.IsZero) return "0";
        var sb = new StringBuilder();
        while (!big.IsZero)
        {
            int d = (int)(big % radix);
            sb.Insert(0, "0123456789abcdef"[d]);
            big /= radix;
        }
        return sb.ToString();
    }

    private static string FromCodePoint(double cp)
    {
        if (double.IsNaN(cp) || cp < 0 || cp > 0x10FFFF) return "";
        int c = (int)cp;
        return c is >= 0xD800 and <= 0xDFFF ? ((char)c).ToString() : char.ConvertFromUtf32(c);
    }

    /// <summary>s.toUpperCase() (also ß → SS, like JavaScript).</summary>
    internal static string JsUpper(string s) => s.ToUpperInvariant().Replace("ß", "SS");

    /// <summary>s.toLowerCase()</summary>
    internal static string JsLower(string s) => s.ToLowerInvariant();
}
