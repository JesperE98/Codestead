namespace Codestead.Shell.Commands;

// Port of src/shell/commands/awk.ts – a small awk interpreter: tokenizer, recursive parser
// and a tree interpreter. Supports a useful subset of the language: pattern/action,
// BEGIN/END, fields, variables, arrays, if/while/for, print/printf and the most common
// builtin functions. Anything missing gives a syntax error from the parser.
//
// Values (TS: number | string | StrNum) are boxed as object: double, string or StrNum.

public static partial class AwkCmd
{
    // ---------- Values ----------

    /// <summary>Text from outside (fields, -v): counts as a number if it looks like one.</summary>
    internal sealed class StrNum
    {
        public double N { get; }
        public bool Numeric { get; }
        public string S { get; }

        public StrNum(string s, bool? numeric = null)
        {
            S = s;
            N = StrToNum(s);
            Numeric = numeric ?? NumericRe.IsMatch(s);
        }
    }

    private static readonly Regex NumericRe = new(@"^\s*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?\s*\z", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingNumRe = new(@"^\s*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?", RegexOptions.CultureInvariant);

    internal static readonly StrNum Uninit = new("", true);

    private static double StrToNum(string s)
    {
        var m = LeadingNumRe.Match(s);
        return m.Success ? Js.Number(m.Value) : 0;
    }

    internal static double Num(object v) => v switch
    {
        double d => d,
        string s => StrToNum(s),
        StrNum sn => sn.N,
        int i => i,
        long l => l,
        _ => 0,
    };

    internal static bool IsNumeric(object v) => v is double or int or long || (v is StrNum sn && sn.Numeric);

    internal static bool Truthy(object v) => v switch
    {
        string s => s != "",
        StrNum sn => sn.Numeric ? sn.N != 0 : sn.S != "",
        _ => Num(v) != 0,
    };

    /// <summary>%g as in C: at most <paramref name="prec"/> significant digits, without trailing zeros.</summary>
    public static string FormatG(double n, double prec = 6, bool alt = false)
    {
        if (!double.IsFinite(n)) return n > 0 ? "inf" : n < 0 ? "-inf" : "nan";
        if (n == 0) return "0";
        int p = prec == 0 ? 1 : ClampDigits(prec, 1, 100);
        int exp = (int)Math.Floor(Math.Log10(Math.Abs(JsToPrecisionValue(n, p))));
        string Strip(string s) => alt ? s : s.Contains('.') ? TrailingZerosRe.Replace(s, "", 1) : s;
        if (exp < -4 || exp >= p)
        {
            var parts = JsToExponential(n, p - 1).Split('e');
            var mant = parts[0];
            var e = parts[1];
            var sign = e.StartsWith('-') ? "-" : "+";
            return $"{Strip(mant)}e{sign}{e.TrimStart('+', '-').PadLeft(2, '0')}";
        }
        return Strip(JsToFixed(n, Math.Max(0, p - 1 - exp)));
    }

    private static readonly Regex TrailingZerosRe = new(@"\.?0+\z", RegexOptions.CultureInvariant);

    private static int ClampDigits(double d, int min, int max) =>
        double.IsNaN(d) ? min : (int)Math.Max(min, Math.Min(max, Math.Truncate(d)));

    private static string NumToStr(double n)
    {
        if (IsInteger(n) && Math.Abs(n) < 1e16) return JsString(n);
        return FormatG(n, 6);
    }

    private static bool IsInteger(double n) => double.IsFinite(n) && Math.Floor(n) == n;

    internal static string Str(object v) => v switch
    {
        double d => NumToStr(d),
        string s => s,
        StrNum sn => sn.S,
        int i => NumToStr(i),
        long l => NumToStr(l),
        _ => "",
    };

    private static readonly Regex SprintfRe = new(@"%([-+ #0]*)([0-9]+|\*)?(?:\.([0-9]+|\*))?([csdiouxXeEfFgG%])", RegexOptions.CultureInvariant);

    /// <summary>sprintf/printf: %s %d %i %f %e %g %c %x %o %u %% with flags, width and precision.</summary>
    public static string AwkSprintf(string fmt, IReadOnlyList<object> args)
    {
        int ai = 0;
        object Take()
        {
            if (ai >= args.Count) throw new AwkFatal("not enough arguments to satisfy format string");
            return args[ai++];
        }
        return SprintfRe.Replace(fmt, mm =>
        {
            var flags = mm.Groups[1].Value;
            string? w = mm.Groups[2].Success ? mm.Groups[2].Value : null;
            string? pr = mm.Groups[3].Success ? mm.Groups[3].Value : null;
            var conv = mm.Groups[4].Value;
            if (conv == "%") return "%";
            double width = w == "*" ? Num(Take()) : !string.IsNullOrEmpty(w) ? Js.Number(w) : 0;
            double? prec = pr == "*" ? Num(Take()) : pr is not null ? Js.Number(pr) : null;
            bool left = flags.Contains('-') || width < 0;
            var v = Take();
            string body;
            string sign = "";
            bool numeric = true;
            double n = Num(v);
            string SignOf(bool neg) => neg ? "-" : flags.Contains('+') ? "+" : flags.Contains(' ') ? " " : "";
            switch (conv)
            {
                case "s":
                    body = Str(v);
                    if (prec is double ps) body = body.Slice(0, ClampDigits(ps, 0, int.MaxValue));
                    numeric = false;
                    break;
                case "c":
                    if (v is double or int or long) body = FromCodePoint(Math.Truncate(Num(v)));
                    else
                    {
                        var s = Str(v);
                        body = s.Length == 0 ? "" : char.IsSurrogatePair(s, 0) ? s[..2] : s[..1];
                    }
                    numeric = false;
                    break;
                case "d":
                case "i":
                {
                    double t = Math.Truncate(n);
                    body = JsString(Math.Abs(t));
                    if (prec is double pd) body = body.PadLeft(ClampDigits(pd, 0, 10000), '0');
                    sign = SignOf(t < 0);
                    break;
                }
                case "o":
                case "u":
                case "x":
                case "X":
                {
                    double t = Math.Truncate(Math.Abs(n));
                    body = ToRadix(t, conv == "o" ? 8 : conv == "u" ? 10 : 16);
                    if (conv == "X") body = body.ToUpperInvariant();
                    break;
                }
                case "f":
                case "F":
                    body = JsToFixed(Math.Abs(n), prec is double pf ? ClampDigits(pf, 0, 100) : 6);
                    sign = n < 0 || (n == 0 && double.IsNegative(n)) ? "-" : flags.Contains('+') ? "+" : flags.Contains(' ') ? " " : "";
                    break;
                case "e":
                case "E":
                {
                    var parts = JsToExponential(Math.Abs(n), prec is double pe ? ClampDigits(pe, 0, 100) : 6).Split('e');
                    body = parts.Length > 1 ? $"{parts[0]}e{parts[1][0]}{parts[1][1..].PadLeft(2, '0')}" : parts[0];
                    if (conv == "E") body = body.ToUpperInvariant();
                    sign = SignOf(n < 0);
                    break;
                }
                default:
                    body = FormatG(Math.Abs(n), prec ?? 6, flags.Contains('#'));
                    if (conv == "G") body = body.ToUpperInvariant();
                    sign = SignOf(n < 0);
                    break;
            }
            double w2 = Math.Abs(width);
            int len = sign.Length + body.Length;
            if (len >= w2) return sign + body;
            int padN = (int)Math.Min(w2 - len, 1_000_000);
            if (left) return sign + body + new string(' ', padN);
            if (numeric && flags.Contains('0') && prec is null) return sign + new string('0', padN) + body;
            return new string(' ', padN) + sign + body;
        });
    }
}
