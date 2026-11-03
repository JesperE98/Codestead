namespace Codestead.Shell;

// ParserLib: Parse() and the wildcard (glob) helpers used by the shell.

public static partial class ParserLib
{
    public static Node Parse(string input) => new Parser(Tokenize(input)).ParseProgram();

    /// <summary>Turns a glob pattern (*, ?, [abc]) into a regex. With anyChar, * also matches "/" (as in case).</summary>
    public static Regex GlobToRegex(string seg, bool anyChar = false)
    {
        var star = anyChar ? ".*" : "[^/]*";
        var one = anyChar ? "." : "[^/]";
        var re = new StringBuilder();
        for (int i = 0; i < seg.Length; i++)
        {
            char c = seg[i];
            if (c == '\\' && i + 1 < seg.Length)
            {
                re.Append(EscapeRegex(seg[++i].ToString()));
            }
            else if (c == '*')
            {
                re.Append(star);
            }
            else if (c == '?')
            {
                re.Append(one);
            }
            else if (c == '[')
            {
                int j = i + 2 <= seg.Length ? seg.IndexOf(']', i + 2) : -1;
                if (j < 0)
                {
                    re.Append("\\[");
                }
                else
                {
                    var cls = seg[(i + 1)..j];
                    if (cls.StartsWith('!')) cls = "^" + cls[1..];
                    re.Append('[').Append(cls.Replace("\\", "\\\\")).Append(']');
                    i = j;
                }
            }
            else
            {
                re.Append(EscapeRegex(c.ToString()));
            }
        }
        // \z instead of $: in .NET, $ would also match before a final newline.
        return new Regex($"^(?:{re})\\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    }

    public static bool HasUnescapedGlob(string seg)
    {
        for (int i = 0; i < seg.Length; i++)
        {
            if (seg[i] == '\\')
            {
                i++;
                continue;
            }
            if (seg[i] == '*' || seg[i] == '?' || seg[i] == '[') return true;
        }
        return false;
    }

    private static readonly Regex GlobChars = new(@"[*?[\]\\]", RegexOptions.CultureInvariant);
    private static readonly Regex Escaped = new(@"\\(.)", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex RegexChars = new(@"[.*+?^${}()|[\]\\/]", RegexOptions.CultureInvariant);

    public static string EscapeGlob(string text) => GlobChars.Replace(text, m => "\\" + m.Value);

    public static string UnescapeGlob(string text) => Escaped.Replace(text, "$1");

    public static string EscapeRegex(string text) => RegexChars.Replace(text, m => m.Value == "/" ? "/" : "\\" + m.Value);
}
