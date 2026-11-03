namespace Codestead.Shell.Commands;

// Port of src/shell/commands/script.ts – builtins for scripts: test/[ ]/[[ ]], read, printf, local, return,
// break, continue, shift, let and set.

public static partial class ScriptCmd
{
    private static readonly Regex EscapeRe = new(@"\\(n|t|r|\\|""|a|e|0[0-7]{0,3})", RegexOptions.CultureInvariant);
    private static readonly Regex SpecRe = new(@"%([-+ 0#]*)([0-9]+)?(?:\.([0-9]+))?([sdifxXoceb%])", RegexOptions.CultureInvariant);
    private static readonly Regex ZeroPadConv = new("[dfixXo]", RegexOptions.CultureInvariant);

    /// <summary>Number(x) || 0 in JavaScript.</summary>
    private static double NumOrZero(string s)
    {
        double n = Js.Number(s);
        return double.IsNaN(n) ? 0 : n;
    }

    /// <summary>Math.trunc(n).toString(radix) in JavaScript.</summary>
    private static string ToRadix(double n, int radix)
    {
        double t = Math.Truncate(n);
        if (double.IsInfinity(t)) return t > 0 ? "Infinity" : "-Infinity";
        if (Math.Abs(t) >= 9.2e18) return Js.Num(t);
        long v = (long)t;
        var digits = Convert.ToString(Math.Abs(v), radix);
        return v < 0 ? "-" + digits : digits;
    }

    /// <summary>n.toFixed(digits) in JavaScript (Math.Round only handles up to 15 decimals).</summary>
    private static string ToFixed(double n, int digits) =>
        digits <= 15 ? Js.ToFixed(n, digits) : n.ToString("F" + digits, CultureInfo.InvariantCulture);

    /// <summary>n.toExponential(digits) in JavaScript, e.g. "1.50e+0".</summary>
    private static string ToExponential(double n, int digits)
    {
        if (double.IsNaN(n)) return "NaN";
        if (double.IsInfinity(n)) return n > 0 ? "Infinity" : "-Infinity";
        var s = n.ToString("E" + digits, CultureInfo.InvariantCulture);
        int e = s.IndexOf('E');
        var mantissa = s[..e];
        int exp = int.Parse(s[(e + 1)..], NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture);
        return $"{mantissa}e{(exp < 0 ? "-" : "+")}{Math.Abs(exp)}";
    }

    /// <summary>Formats like printf(1): %s %d %i %f %x %o %c %b %% with flags, width and precision.</summary>
    public static string FormatPrintf(string format, List<string> args)
    {
        static string Escapes(string s) => EscapeRe.Replace(s, m =>
        {
            var c = m.Groups[1].Value;
            if (c == "n") return "\n";
            if (c == "t") return "\t";
            if (c == "r") return "\r";
            if (c == "e") return "\x1b";
            if (c == "a") return "";
            if (c.StartsWith('0'))
            {
                double code = Js.ParseInt(c, 8);
                return ((char)(double.IsNaN(code) ? 0 : (int)code)).ToString();
            }
            return c;
        });
        var fmt = Escapes(format);
        var output = new StringBuilder();
        int argi = 0;
        do
        {
            bool consumed = false;
            output.Append(SpecRe.Replace(fmt, m =>
            {
                var flags = m.Groups[1].Value;
                string? width = m.Groups[2].Success ? m.Groups[2].Value : null;
                string? prec = m.Groups[3].Success ? m.Groups[3].Value : null;
                var conv = m.Groups[4].Value;
                if (conv == "%") return "%";
                var arg = argi < args.Count ? args[argi] : "";
                argi++;
                consumed = true;
                string s;
                switch (conv)
                {
                    case "d":
                    case "i":
                        s = Js.Num(Math.Truncate(NumOrZero(arg)));
                        if (flags.Contains('+') && !s.StartsWith('-')) s = "+" + s;
                        break;
                    case "f":
                    case "e":
                    {
                        int p = prec is not null ? (int)Js.Number(prec) : 6;
                        s = conv == "f" ? ToFixed(NumOrZero(arg), p) : ToExponential(NumOrZero(arg), p);
                        break;
                    }
                    case "x":
                    case "X":
                        s = ToRadix(NumOrZero(arg), 16);
                        if (conv == "X") s = s.ToUpperInvariant();
                        break;
                    case "o":
                        s = ToRadix(NumOrZero(arg), 8);
                        break;
                    case "c":
                        s = arg.CharAt(0);
                        break;
                    case "b":
                        s = Escapes(arg);
                        break;
                    default:
                        s = prec is not null ? arg.Slice(0, (int)Js.Number(prec)) : arg;
                        break;
                }
                int w = (int)Js.Number(width ?? "0");
                if (s.Length < w)
                {
                    if (flags.Contains('-')) s = s.PadRight(w);
                    else if (flags.Contains('0') && ZeroPadConv.IsMatch(conv)) s = s.StartsWith('-') ? "-" + s[1..].PadLeft(w - 1, '0') : s.PadLeft(w, '0');
                    else s = s.PadLeft(w);
                }
                return s;
            }));
            if (!consumed) break;
        } while (argi < args.Count);
        return output.ToString();
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        TestCommand("test"),
        TestCommand("["),
        TestCommand("[["),
        Read,
        Printf,
        Local,
        ReturnCmd,
        LoopControl("break"),
        LoopControl("continue"),
        Shift,
        LetCmd,
        Set,
    };
}
