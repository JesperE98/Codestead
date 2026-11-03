namespace Codestead.Shell.Commands;

// Port of src/shell/commands/text.ts – text commands: echo, cat, less, head, tail, wc, grep, sort, uniq, cut, tee.

public static partial class TextCmd
{
    // ---------- JavaScript helpers shared by the basic commands ----------

    /// <summary>The characters JavaScript's \s and String.prototype.trim treat as white space.</summary>
    internal const string JsWhitespaceClass = "[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

    private static readonly char[] JsWhitespaceChars =
    {
        '\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
        '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff',
    };

    private static readonly Regex JsWhitespaceRun = new(JsWhitespaceClass + "+", RegexOptions.CultureInvariant);
    private static readonly Regex JsWhitespaceOne = new(JsWhitespaceClass, RegexOptions.CultureInvariant);

    /// <summary>s.trim() in JavaScript.</summary>
    internal static string JsTrim(string s) => s.Trim(JsWhitespaceChars);

    /// <summary>s.split(/\s+/).filter(Boolean) in JavaScript.</summary>
    internal static List<string> SplitWords(string s) => JsWhitespaceRun.Split(s).Where(w => w != "").ToList();

    /// <summary>/\s/.test(s) in JavaScript.</summary>
    internal static bool HasJsWhitespace(string s) => JsWhitespaceOne.IsMatch(s);

    /// <summary>
    /// new RegExp(source, flags) in JavaScript. ECMAScript mode gives the JavaScript meaning of \w, \d and \b
    /// (ASCII only). Throws ArgumentException for an invalid pattern, like JavaScript throws SyntaxError.
    /// </summary>
    internal static Regex JsRegex(string source, bool ignoreCase = false)
    {
        var options = RegexOptions.ECMAScript | RegexOptions.CultureInvariant;
        if (ignoreCase) options |= RegexOptions.IgnoreCase;
        return new Regex(source, options);
    }

    private static CommandDef CatLike(string name, string summary, string man) => new()
    {
        Name = name,
        Summary = summary,
        Man = man,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "n", Long = new() { ["number"] = "n" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            int lineNo = 1;
            foreach (var input in inputs)
            {
                if (o.Flags.Contains("n"))
                {
                    foreach (var line in UtilCmd.SplitLines(input.Content)) ctx.Out($"{Js.Num(lineNo++).PadLeft(6)}\t{line}\n");
                }
                else
                {
                    ctx.Out(input.Content);
                }
            }
            return failed ? 1 : 0;
        },
    };

    /// <summary>A JS number used as an array index (slice): NaN is 0, the rest is truncated and clamped.</summary>
    private static int ToIndex(double n) =>
        double.IsNaN(n) ? 0 : n >= int.MaxValue ? int.MaxValue : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);

    /// <summary>Turns a basic regular expression (BRE, as grep uses) into JavaScript.</summary>
    public static string BreToJs(string p)
    {
        const string special = "|(){}+?";
        var sb = new StringBuilder();
        for (int i = 0; i < p.Length; i++)
        {
            char c = p[i];
            if (c == '\\' && i + 1 < p.Length)
            {
                char n = p[++i];
                if (special.Contains(n)) sb.Append(n);
                else sb.Append('\\').Append(n);
            }
            else if (special.Contains(c))
            {
                sb.Append('\\').Append(c);
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// How sort orders text: by the terminal's $LANG, like GNU sort (sv_SE.UTF-8 puts å, ä, ö last,
    /// en_US.UTF-8 sorts them with a and o). Unknown locales fall back to the invariant culture.
    /// </summary>
    public static CompareInfo Collation(Shell sh)
    {
        var lang = sh.Env.Get("LC_ALL") is { Length: > 0 } all ? all : sh.Env.Get("LANG") ?? "";
        var name = lang.Split('.')[0].Replace('_', '-');
        if (name is "" or "C" or "POSIX") return CultureInfo.InvariantCulture.CompareInfo;
        try
        {
            return CultureInfo.GetCultureInfo(name).CompareInfo;
        }
        catch (CultureNotFoundException)
        {
            return CultureInfo.InvariantCulture.CompareInfo;
        }
    }

    /// <summary>Plain `sort` of some lines, as the simulator does it.</summary>
    public static List<string> SortLines(Shell sh, IEnumerable<string> lines)
    {
        var ci = Collation(sh);
        var list = lines.ToList();
        list.StableSort((a, b) =>
        {
            int c = ci.Compare(a, b, CompareOptions.None);
            if (c != 0) return c;
            int o = string.CompareOrdinal(a, b);
            return o < 0 ? -1 : o > 0 ? 1 : 0;
        });
        return list;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Echo, Cat, Less, More, HeadTail("head"), HeadTail("tail"), Wc, Grep, Sort, Uniq, Cut, Tee };
}
