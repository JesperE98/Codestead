namespace Codestead.Shell.Commands;

// Port of src/shell/commands/regex.ts – turns POSIX regular expressions (used by sed and awk)
// into JavaScript regex syntax. JavaScript regexes are then compiled for .NET with
// NewRegExp, which translates the JavaScript-only semantics (see JsToNet).

public static partial class RegexCmd
{
    /// <summary>Character classes like [[:digit:]] – in UTF-8, å, ä and ö also count as letters.</summary>
    private static readonly OrderedDictionary<string, string> Classes = new(StringComparer.Ordinal)
    {
        ["alpha"] = "a-zA-ZÀ-ÖØ-öø-ÿ",
        ["upper"] = "A-ZÀ-ÖØ-Þ",
        ["lower"] = "a-zß-öø-ÿ",
        ["digit"] = "0-9",
        ["alnum"] = "0-9a-zA-ZÀ-ÖØ-öø-ÿ",
        ["space"] = "\\s",
        ["blank"] = " \\t",
        ["punct"] = "!-\\/:-@\\[-`{-~",
        ["xdigit"] = "0-9A-Fa-f",
        ["cntrl"] = "\\x00-\\x1f\\x7f",
    };

    /// <summary>
    /// Translates a basic (BRE) or extended (ERE) regular expression to JavaScript syntax:
    /// [:classes:], \&lt; \&gt; (word boundary) and BRE's \( \) \{ \}.
    /// </summary>
    public static string ToJsRegex(string src, bool extended)
    {
        var s = new StringBuilder();
        for (int i = 0; i < src.Length; i++)
        {
            char c = src[i];
            if (c == '\\' && i + 1 < src.Length)
            {
                char n = src[i + 1];
                if (n == '<' || n == '>') s.Append("\\b");
                else s.Append(c).Append(n);
                i++;
            }
            else if (c == '[' && i + 1 < src.Length && src[i + 1] == ':')
            {
                int end = src.IndexOf(":]", i + 2, StringComparison.Ordinal);
                string? cls = end > 0 ? Classes.Get(src.Slice(i + 2, end)) : null;
                if (cls is null)
                {
                    s.Append(c);
                }
                else
                {
                    s.Append(cls);
                    i = end + 1;
                }
            }
            else
            {
                s.Append(c);
            }
        }
        return extended ? s.ToString() : TextCmd.BreToJs(s.ToString());
    }

    /// <summary>The number of capturing groups ( ... ) in a regex.</summary>
    public static int GroupCount(Regex re) => re.GetGroupNumbers().Length - 1;

    // ------------------------------------------------------------------
    // JavaScript regex semantics on .NET (C# only – the TypeScript used the JS engine directly)
    // ------------------------------------------------------------------

    /// <summary>
    /// new RegExp(source, flags): compiles a JavaScript regex source for .NET. Only the i flag
    /// changes matching ("g" means "all matches", which is what the callers do anyway).
    /// Throws ArgumentException when the pattern is invalid (JS: SyntaxError).
    /// </summary>
    public static Regex NewRegExp(string source, string flags = "")
    {
        var opts = RegexOptions.CultureInvariant;
        if (flags.Contains('i')) opts |= RegexOptions.IgnoreCase;
        if (flags.Contains('m')) opts |= RegexOptions.Multiline;
        return new Regex(JsToNet(source, flags.Contains('s'), flags.Contains('m')), opts);
    }

    private const string WordCls = "A-Za-z0-9_";
    private const string WordBoundary = "(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))";
    private const string NonWordBoundary = "(?:(?<=[A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<![A-Za-z0-9_])(?![A-Za-z0-9_]))";

    private static bool IsHex(char c) => c is >= '0' and <= '9' or >= 'a' and <= 'f' or >= 'A' and <= 'F';

    /// <summary>
    /// Rewrites a JavaScript (non-unicode) regex so .NET matches the same strings:
    /// ASCII-only \d \w \b, "." that does not match line terminators, "$" that only matches
    /// at the very end, [] and [^], identity escapes such as \a or \e, octal escapes and
    /// no character class subtraction.
    /// </summary>
    public static string JsToNet(string src, bool dotAll = false, bool multiline = false)
    {
        // Count capturing groups first: \N is a back reference only if group N exists.
        int groups = 0;
        bool named = false;
        {
            bool inCls = false;
            for (int i = 0; i < src.Length; i++)
            {
                char c = src[i];
                if (c == '\\') { i++; continue; }
                if (inCls) { if (c == ']') inCls = false; continue; }
                if (c == '[') { inCls = true; if (src.CharAt(i + 1) == "]") i++; else if (src.Slice(i + 1, i + 3) == "^]") i += 2; continue; }
                if (c != '(') continue;
                if (src.CharAt(i + 1) != "?") groups++;
                else if (src.CharAt(i + 2) == "<" && src.CharAt(i + 3) != "=" && src.CharAt(i + 3) != "!")
                {
                    groups++;
                    named = true;
                }
            }
        }

        var o = new StringBuilder();
        bool inClass = false;
        for (int i = 0; i < src.Length; i++)
        {
            char c = src[i];
            if (c == '\\')
            {
                if (i + 1 >= src.Length)
                {
                    // A trailing backslash is a syntax error in JS too.
                    o.Append('\\');
                    continue;
                }
                char n = src[++i];
                switch (n)
                {
                    case 'd': o.Append(inClass ? "0-9" : "[0-9]"); continue;
                    case 'D': o.Append(inClass ? "\\x00-/:-\\uFFFF" : "[^0-9]"); continue;
                    case 'w': o.Append(inClass ? WordCls : "[" + WordCls + "]"); continue;
                    case 'W': o.Append(inClass ? "\\x00-/:-@\\[-\\^`{-\\uFFFF" : "[^" + WordCls + "]"); continue;
                    case 's':
                    case 'S':
                    case 't':
                    case 'n':
                    case 'r':
                    case 'v':
                    case 'f':
                        o.Append('\\').Append(n);
                        continue;
                    case 'b':
                        o.Append(inClass ? "\\b" : WordBoundary);
                        continue;
                    case 'B':
                        o.Append(inClass ? "B" : NonWordBoundary);
                        continue;
                    case 'c':
                        if (i + 1 < src.Length && char.IsAsciiLetter(src[i + 1])) o.Append("\\c").Append(src[++i]);
                        else o.Append("\\\\c");
                        continue;
                    case 'x':
                        if (i + 2 < src.Length && IsHex(src[i + 1]) && IsHex(src[i + 2]))
                        {
                            o.Append("\\x").Append(src, i + 1, 2);
                            i += 2;
                        }
                        else o.Append('x');
                        continue;
                    case 'u':
                        if (i + 4 < src.Length && IsHex(src[i + 1]) && IsHex(src[i + 2]) && IsHex(src[i + 3]) && IsHex(src[i + 4]))
                        {
                            o.Append("\\u").Append(src, i + 1, 4);
                            i += 4;
                        }
                        else o.Append('u');
                        continue;
                    case 'k':
                        if (named && src.CharAt(i + 1) == "<") o.Append("\\k");
                        else o.Append('k');
                        continue;
                }
                if (n is >= '0' and <= '9')
                {
                    // Back reference (outside classes) or a legacy octal escape.
                    int j = i;
                    while (j < src.Length && src[j] is >= '0' and <= '9') j++;
                    var digits = src[i..j];
                    if (!inClass && n != '0' && int.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var refNo) && refNo <= groups)
                    {
                        o.Append("(?:\\").Append(digits).Append(')');
                        i = j - 1;
                        continue;
                    }
                    if (n is '8' or '9')
                    {
                        o.Append(n);
                        continue;
                    }
                    // Up to three octal digits, at most \377.
                    int k = i, val = 0;
                    while (k < src.Length && k - i < 3 && src[k] is >= '0' and <= '7' && val * 8 + (src[k] - '0') <= 255)
                    {
                        val = val * 8 + (src[k] - '0');
                        k++;
                    }
                    o.Append("\\x").Append(val.ToString("x2", CultureInfo.InvariantCulture));
                    i = k - 1;
                    continue;
                }
                // Identity escape: the character itself.
                if (char.IsAsciiLetterOrDigit(n) || n == '_' || n > 127) o.Append(Regex.Escape(n.ToString()));
                else o.Append('\\').Append(n);
                continue;
            }
            if (inClass)
            {
                if (c == ']') inClass = false;
                if (c == '[') o.Append("\\[");
                else o.Append(c);
                continue;
            }
            switch (c)
            {
                case '[':
                    if (src.CharAt(i + 1) == "]")
                    {
                        o.Append("(?!)");
                        i++;
                    }
                    else if (src.Slice(i + 1, i + 3) == "^]")
                    {
                        o.Append("[\\s\\S]");
                        i += 2;
                    }
                    else
                    {
                        inClass = true;
                        o.Append('[');
                        if (src.CharAt(i + 1) == "^")
                        {
                            o.Append('^');
                            i++;
                        }
                    }
                    break;
                case '.':
                    o.Append(dotAll ? "[\\s\\S]" : "[^\\n\\r\\u2028\\u2029]");
                    break;
                case '$':
                    o.Append(multiline ? "(?=[\\n\\r\\u2028\\u2029]|\\z)" : "\\z");
                    break;
                default:
                    o.Append(c);
                    break;
            }
        }
        return o.ToString();
    }

    /// <summary>
    /// s.split(re) with JavaScript semantics: an empty match at the start, or right after the
    /// previous separator, does not split; captured groups are included in the result.
    /// </summary>
    public static List<string> JsSplit(string s, Regex re)
    {
        var result = new List<string>();
        if (s.Length == 0)
        {
            if (!re.Match(s).Success) result.Add(s);
            return result;
        }
        int p = 0, q = 0;
        while (q < s.Length)
        {
            var m = re.Match(s, q);
            if (!m.Success) break;
            q = m.Index;
            if (q >= s.Length) break;
            int e = m.Index + m.Length;
            if (e == p)
            {
                q++;
                continue;
            }
            result.Add(s[p..q]);
            for (int g = 1; g < m.Groups.Count; g++) result.Add(m.Groups[g].Success ? m.Groups[g].Value : "");
            p = e;
            q = p;
        }
        result.Add(s[p..]);
        return result;
    }
}
