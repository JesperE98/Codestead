using System.Text;
using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// A C++ file the simulator reads: the text with comments blanked out (offsets and lines stay the same), and
/// helpers to find calls, function bodies, declarations and initializers. Values are in CppSource.Values.cs.
/// </summary>
public sealed partial class CppSource
{
    public string FileName { get; }
    public string Text { get; }
    /// <summary>The text with comments replaced by spaces.</summary>
    public string Code { get; }

    public CppSource(string fileName, string text)
    {
        FileName = fileName;
        Text = text.Replace("\r\n", "\n");
        Code = BlankComments(Text);
    }

    /// <summary>Replaces // and /* */ comments with spaces, keeping newlines and string literals.</summary>
    public static string BlankComments(string s)
    {
        var sb = new StringBuilder(s);
        int i = 0;
        while (i < s.Length)
        {
            char c = s[i];
            if (c == '"' || c == '\'')
            {
                // A raw string R"(...)" is skipped whole.
                if (c == '"' && i > 0 && s[i - 1] == 'R')
                {
                    int close = s.IndexOf(")\"", i, StringComparison.Ordinal);
                    i = close < 0 ? s.Length : close + 2;
                    continue;
                }
                i++;
                while (i < s.Length && s[i] != c && s[i] != '\n')
                {
                    if (s[i] == '\\') i++;
                    i++;
                }
                i++;
                continue;
            }
            if (c == '/' && i + 1 < s.Length && s[i + 1] == '/')
            {
                while (i < s.Length && s[i] != '\n') sb[i++] = ' ';
                continue;
            }
            if (c == '/' && i + 1 < s.Length && s[i + 1] == '*')
            {
                while (i < s.Length && !(s[i] == '*' && i + 1 < s.Length && s[i + 1] == '/'))
                {
                    if (s[i] != '\n') sb[i] = ' ';
                    i++;
                }
                if (i < s.Length) sb[i++] = ' ';
                if (i < s.Length) sb[i++] = ' ';
                continue;
            }
            i++;
        }
        return sb.ToString();
    }

    public int LineAt(int offset)
    {
        int line = 1;
        for (int i = 0; i < offset && i < Code.Length; i++)
            if (Code[i] == '\n') line++;
        return line;
    }

    /// <summary>The index of the bracket that closes the one at <paramref name="open"/> (strings are skipped), or -1.</summary>
    public static int MatchBracket(string s, int open)
    {
        char o = s[open];
        char close = o switch { '(' => ')', '{' => '}', '[' => ']', _ => '>' };
        int depth = 0;
        for (int i = open; i < s.Length; i++)
        {
            char c = s[i];
            if (c == '"' || c == '\'')
            {
                i++;
                while (i < s.Length && s[i] != c)
                {
                    if (s[i] == '\\') i++;
                    i++;
                }
                continue;
            }
            if (c == o) depth++;
            else if (c == close && --depth == 0) return i;
        }
        return -1;
    }

    /// <summary>Splits "a, f(b, c), {d, e}" at the top-level commas.</summary>
    public static List<string> SplitArgs(string inside)
    {
        var list = new List<string>();
        int depth = 0, start = 0;
        for (int i = 0; i < inside.Length; i++)
        {
            char c = inside[i];
            if (c == '"' || c == '\'')
            {
                i++;
                while (i < inside.Length && inside[i] != c)
                {
                    if (inside[i] == '\\') i++;
                    i++;
                }
                continue;
            }
            if (c is '(' or '{' or '[') depth++;
            else if (c is ')' or '}' or ']') depth--;
            else if (c == ',' && depth == 0)
            {
                list.Add(inside[start..i].Trim());
                start = i + 1;
            }
        }
        var last = inside[start..].Trim();
        if (last.Length > 0 || list.Count > 0) list.Add(last);
        return list;
    }

    private static readonly Dictionary<string, Regex> CallRes = new();

    private static Regex CallRe(string name)
    {
        lock (CallRes)
        {
            if (!CallRes.TryGetValue(name, out var re))
                CallRes[name] = re = name.StartsWith('.')
                    ? new Regex(@"(?:\.|->)\s*" + Regex.Escape(name[1..]) + @"\s*\(", RegexOptions.CultureInvariant)
                    : new Regex(@"(?<![\w.>])" + Regex.Escape(name) + @"\s*\(", RegexOptions.CultureInvariant);
            return re;
        }
    }

    /// <summary>Every call of a function, or of a method when the name starts with '.' (".Present").</summary>
    public List<CppCall> Calls(string name, int from = 0, int to = int.MaxValue) => Calls(name, Code, from, to);

    private List<CppCall> Calls(string name, string code, int from, int to)
    {
        var list = new List<CppCall>();
        foreach (Match m in CallRe(name).Matches(code))
        {
            if (m.Index < from || m.Index >= to) continue;
            int open = m.Index + m.Length - 1;
            int close = MatchBracket(code, open);
            if (close < 0) continue;
            string? target = null;
            if (name.StartsWith('.'))
            {
                int j = m.Index - 1;
                while (j >= 0 && (char.IsLetterOrDigit(code[j]) || code[j] is '_' or ']' or '[' or '.' || (code[j] == '>' && j > 0 && code[j - 1] == '-') || (code[j] == '-' && j + 1 < code.Length && code[j + 1] == '>'))) j--;
                target = code[(j + 1)..m.Index].Trim();
            }
            list.Add(new CppCall(name.TrimStart('.'), SplitArgs(code[(open + 1)..close]), m.Index, close + 1, LineAt(m.Index), target));
        }
        return list;
    }

    public bool HasCall(string name) => CallRe(name).IsMatch(Code);

    private static readonly Regex FunctionHead = new(@"(?<![\w.>])(?<name>[A-Za-z_]\w*)\s*\((?<params>[^;{}()]*(?:\([^;{}()]*\)[^;{}()]*)*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?\{", RegexOptions.CultureInvariant);

    /// <summary>The bodies of the function definitions in the file: name → (start, end) offsets of the text between the braces.</summary>
    public IReadOnlyDictionary<string, (int Start, int End)> Functions => functions ??= FindFunctions();
    private Dictionary<string, (int Start, int End)>? functions;

    private Dictionary<string, (int Start, int End)> FindFunctions()
    {
        var result = new Dictionary<string, (int, int)>(StringComparer.Ordinal);
        int i = 0;
        while (i < Code.Length)
        {
            var m = FunctionHead.Match(Code, i);
            if (!m.Success) break;
            var name = m.Groups["name"].Value;
            int open = m.Index + m.Length - 1;
            int close = MatchBracket(Code, open);
            if (close < 0) break;
            if (name is "if" or "while" or "for" or "switch" or "catch" or "return" or "sizeof")
            {
                i = open + 1;
                continue;
            }
            result.TryAdd(name, (open + 1, close));
            // Member functions are inside a class: keep looking inside the class body, but skip function bodies.
            i = close + 1;
        }
        return result;
    }

    /// <summary>The body text of a function definition, or null.</summary>
    public string? FunctionBody(string name) => Functions.TryGetValue(name, out var r) ? Code[r.Start..r.End] : null;

    /// <summary>The function whose body contains an offset, or null.</summary>
    public string? FunctionAt(int offset) => Functions.FirstOrDefault(kv => offset >= kv.Value.Start && offset < kv.Value.End).Key;

    /// <summary>Does a function call another function (directly)?</summary>
    public bool Calls(string caller, string callee) => FunctionBody(caller) is { } body && CallRe(callee).IsMatch(body);

    /// <summary>
    /// The initializer of a variable's declaration: "{ … }" for name[] = { … }, name = { … } and name{ … }, or the
    /// expression of name = expr; (the last declaration in the file wins). Null when not found.
    /// </summary>
    public string? Initializer(string name)
    {
        var re = new Regex(@"(?<![\w.>])" + Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)*(?<eq>=\s*)?(?<brace>\{)?", RegexOptions.CultureInvariant);
        string? found = null, foundBraces = null;
        foreach (Match m in re.Matches(Code))
        {
            // Must be a declaration: preceded by a type (an identifier, '>', '*' or '&' and whitespace).
            int j = m.Index - 1;
            while (j >= 0 && Code[j] is ' ' or '\t' or '\n') j--;
            if (j < 0 || !(char.IsLetterOrDigit(Code[j]) || Code[j] is '_' or '>' or '*' or '&')) continue;
            // "return name;", "else name = …" are not declarations.
            int k = j;
            while (k >= 0 && (char.IsLetterOrDigit(Code[k]) || Code[k] == '_')) k--;
            var word = Code[(k + 1)..(j + 1)];
            if (word is "return" or "else" or "case" or "delete" or "new" or "throw") continue;
            if (m.Groups["brace"].Success)
            {
                int open = m.Index + m.Length - 1;
                int close = MatchBracket(Code, open);
                if (close > 0) foundBraces = Code[open..(close + 1)];
            }
            else if (m.Groups["eq"].Success)
            {
                int end = StatementEnd(m.Index + m.Length);
                found = Code[(m.Index + m.Length)..end].Trim();
            }
        }
        // Data (vertices, indices, a clear value) is written with braces; a local of the same name
        // (QueueFamilyIndices indices = findQueueFamilies(…)) should not hide it.
        return foundBraces ?? found;
    }

    /// <summary>The offset of the ';' that ends the statement starting at <paramref name="from"/> (nested brackets skipped).</summary>
    public int StatementEnd(int from)
    {
        int depth = 0;
        for (int i = from; i < Code.Length; i++)
        {
            char c = Code[i];
            if (c == '"' || c == '\'')
            {
                i++;
                while (i < Code.Length && Code[i] != c)
                {
                    if (Code[i] == '\\') i++;
                    i++;
                }
                continue;
            }
            if (c is '(' or '{' or '[') depth++;
            else if (c is ')' or '}' or ']')
            {
                if (--depth < 0) return i;
            }
            else if (c == ';' && depth == 0) return i;
        }
        return Code.Length;
    }

    /// <summary>The declared type of a variable (the word before it: "std::vector&lt;Vertex&gt;" gives "std::vector&lt;Vertex&gt;").</summary>
    public string? DeclaredType(string name)
    {
        var m = Regex.Match(Code, @"(?<type>[A-Za-z_][\w:]*(?:\s*<[^;=(){}]*>)?)\s*[*&]?\s+" + Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)*[=;{(\[,)]", RegexOptions.CultureInvariant);
        while (m.Success && m.Groups["type"].Value is "return" or "else" or "case" or "new" or "delete")
            m = m.NextMatch();
        return m.Success ? Regex.Replace(m.Groups["type"].Value, @"\s+", "") : null;
    }

    /// <summary>Assignments "target.field = value;" (also through -> and with a swizzle-like .x after the field).</summary>
    public IEnumerable<(string Target, string Field, string Value, int Offset)> FieldAssignments(string field)
    {
        var re = new Regex(@"(?<target>[A-Za-z_][\w\[\]]*(?:(?:\.|->)[A-Za-z_]\w*)*)\s*(?:\.|->)\s*" + Regex.Escape(field) + @"\s*=(?!=)\s*", RegexOptions.CultureInvariant);
        foreach (Match m in re.Matches(Code))
        {
            int end = StatementEnd(m.Index + m.Length);
            yield return (m.Groups["target"].Value, field, Code[(m.Index + m.Length)..end].Trim(), m.Index);
        }
    }

    /// <summary>The value last assigned to ".field" before an offset (optionally on a given target, e.g. "samplers[1]").</summary>
    public string? FieldValueBefore(string field, int offset, string? target = null) =>
        FieldAssignments(field).Where(a => a.Offset < offset && (target is null || a.Target == target)).Select(a => a.Value).LastOrDefault();

    /// <summary>The value assigned to any ".field" (the last one in the file), e.g. "rasterizer.cullMode = VK_CULL_MODE_NONE".</summary>
    public string? LastFieldValue(string field) => FieldAssignments(field).Select(a => a.Value).LastOrDefault();

    /// <summary>The string literal of an argument ("LearnOpenGL", L"Title"), or null.</summary>
    public static string? StringArg(string arg)
    {
        var m = Regex.Match(arg, "^(?:L|u8)?\"((?:[^\"\\\\]|\\\\.)*)\"$");
        return m.Success ? Regex.Unescape(m.Groups[1].Value) : null;
    }

    /// <summary>Does the code use an identifier (as a whole word)?</summary>
    public bool Uses(string identifier) => Regex.IsMatch(Code, @"(?<![\w])" + Regex.Escape(identifier) + @"(?![\w])");
}
