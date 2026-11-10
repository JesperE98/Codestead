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

    /// <summary>A function's body with the function-like macros expanded, each line with its own __LINE__.</summary>
    public string? ExpandedBody(string name)
    {
        if (!Functions.TryGetValue(name, out var r)) return null;
        var body = Code[r.Start..r.End];
        if (FunctionMacros.Count == 0 && !body.Contains("__LINE__", StringComparison.Ordinal) && !body.Contains("__FILE__", StringComparison.Ordinal)) return body;
        int first = LineAt(r.Start);
        var lines = body.Split('\n');
        for (int i = 0; i < lines.Length; i++) lines[i] = ExpandMacros(lines[i], first + i, Path.GetFileName(FileName));
        return string.Join('\n', lines);
    }

    private static readonly Regex FunctionMacroRe = new(@"^[ \t]*#[ \t]*define[ \t]+(\w+)\(([^)]*)\)[ \t]*(.*?)[ \t]*$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private Dictionary<string, (List<string> Params, string Body)>? functionMacros;

    private Dictionary<string, (List<string> Params, string Body)> FunctionMacros => functionMacros ??= FunctionMacroRe.Matches(Code).GroupBy(m => m.Groups[1].Value)
        .ToDictionary(g => g.Key, g => (g.First().Groups[2].Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(), g.First().Groups[3].Value), StringComparer.Ordinal);

    /// <summary>
    /// Text with the program's function-like macros expanded (glCheckError() → glCheckError_(__FILE__, __LINE__)),
    /// __FILE__ as the file's name and __LINE__ as the given line.
    /// </summary>
    public string ExpandMacros(string text, int line, string file)
    {
        for (int pass = 0; pass < 4 && FunctionMacros.Count > 0; pass++)
        {
            bool changed = false;
            foreach (var (macro, (parameters, body)) in FunctionMacros)
            {
                var call = Regex.Match(text, @"(?<![\w.>])" + Regex.Escape(macro) + @"\s*\(");
                if (!call.Success) continue;
                int open = call.Index + call.Length - 1;
                int close = MatchBracket(text, open);
                if (close < 0) continue;
                var args = SplitArgs(text[(open + 1)..close]).Select(x => x.Trim()).Where(x => x != "").ToList();
                var expanded = body;
                for (int i = 0; i < parameters.Count; i++)
                    expanded = Regex.Replace(expanded, @"\b" + Regex.Escape(parameters[i]) + @"\b", i < args.Count ? args[i] : "");
                text = text[..call.Index] + expanded + text[(close + 1)..];
                changed = true;
            }
            if (!changed) break;
        }
        if (text.Contains("__", StringComparison.Ordinal))
            text = text.Replace("__LINE__", line.ToString(System.Globalization.CultureInfo.InvariantCulture)).Replace("__FILE__", "\"" + file + "\"");
        return text;
    }

    /// <summary>The function whose body contains an offset, or null.</summary>
    public string? FunctionAt(int offset) => Functions.FirstOrDefault(kv => offset >= kv.Value.Start && offset < kv.Value.End).Key;

    /// <summary>Does a function call another function (directly)?</summary>
    /// <summary>
    /// The text a string argument stands for: its literal (L"sprite.hlsl" → sprite.hlsl), or – when it is a parameter of
    /// the function it is in (D3DCompileFromFile(shaderFile, …) in loadShaderFromFile) – the literal the callers pass,
    /// followed through up to four calls.
    /// </summary>
    public string? StringValue(string arg, int offset, int depth = 0)
    {
        if (StringArg(arg) is { } literal) return literal;
        var name = Regex.Match(arg.Trim(), @"^(\w+)(?:\.c_str\(\))?$");
        if (!name.Success || depth > 4 || FunctionAt(offset) is not { } fn || ParametersOf(fn) is not { } parameters) return Evaluate(arg)?.Text;
        int index = parameters.ToList().FindIndex(p => p.Name == name.Groups[1].Value);
        if (index < 0) return Evaluate(arg)?.Text;
        foreach (var call in Calls(fn).Concat(Calls("." + fn)))
            if (call.Arg(index) is { Length: > 0 } passed && StringValue(passed, call.Offset, depth + 1) is { } value) return value;
        return parameters[index].Default is { } fallback ? StringArg(fallback) : null;
    }

    /// <summary>A parameter of one of the program's functions: its name, whether it is a reference, its default value.</summary>
    public sealed record Parameter(string Name, bool Ref, string? Default);

    /// <summary>
    /// The parameters of a function's definition (the one with a body), also with default values that contain calls
    /// (glm::vec2 size = glm::vec2(10.0f, 10.0f)); null when the definition is not found.
    /// </summary>
    public IReadOnlyList<Parameter>? ParametersOf(string function)
    {
        if (parameterCache.TryGetValue(function, out var known)) return known;
        IReadOnlyList<Parameter>? result = null;
        if (Functions.TryGetValue(function, out var range))
        {
            // The header right before the body: name ( … ) [const] {
            int brace = range.Start - 1;
            while (brace >= 0 && Code[brace] != '{') brace--;
            int close = brace - 1;
            while (close >= 0 && char.IsWhiteSpace(Code[close])) close--;
            if (close >= 5 && Code[(close - 4)..(close + 1)] == "const") close -= 5;
            while (close >= 0 && char.IsWhiteSpace(Code[close])) close--;
            int open = close >= 0 && Code[close] == ')' ? MatchOpenBracket(Code, close) : -1;
            if (open >= 0)
                result = SplitArgs(Code[(open + 1)..close]).Select(p => p.Trim()).Where(p => p is not ("" or "void")).Select(p =>
                {
                    int eq = TopLevelEquals(p);
                    var decl = eq >= 0 ? p[..eq].Trim() : p;
                    var name = Regex.Match(decl, @"(\w+)\s*(?:\[\s*\])?$").Groups[1].Value;
                    return new Parameter(name, decl.Contains('&') && !decl.Contains("&&"), eq >= 0 ? p[(eq + 1)..].Trim() : null);
                }).ToList();
        }
        return parameterCache[function] = result;
    }

    private readonly Dictionary<string, IReadOnlyList<Parameter>?> parameterCache = new(StringComparer.Ordinal);

    private static int TopLevelEquals(string s)
    {
        int depth = 0;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c is '(' or '[' or '{' or '<') depth++;
            else if (c is ')' or ']' or '}' or '>') depth--;
            else if (c == '=' && depth == 0 && (i + 1 >= s.Length || s[i + 1] != '=')) return i;
        }
        return -1;
    }

    /// <summary>The '(' that matches the ')' at <paramref name="close"/>, or -1.</summary>
    private static int MatchOpenBracket(string s, int close)
    {
        int depth = 0;
        for (int i = close; i >= 0; i--)
        {
            if (s[i] == ')') depth++;
            else if (s[i] == '(' && --depth == 0) return i;
        }
        return -1;
    }

    /// <summary>
    /// Whether a function of the program makes graphics API calls (gl*, glfw*, vk*, a Shader class method), itself
    /// or through the program's other functions it calls (Render → DrawLevel → DrawObject → DrawSprite).
    /// </summary>
    public bool CallsApi(string function)
    {
        if (callsApi.TryGetValue(function, out var known)) return known;
        callsApi[function] = false; // a cycle (recursion) counts as no call until proven otherwise
        bool result = false;
        if (FunctionBody(function) is { } body)
        {
            result = ApiCallRe.IsMatch(body);
            if (!result)
                foreach (Match m in CalledRe.Matches(body))
                {
                    var callee = m.Groups[1].Value;
                    if (callee != function && Functions.ContainsKey(callee) && CallsApi(callee))
                    {
                        result = true;
                        break;
                    }
                }
        }
        return callsApi[function] = result;
    }

    private readonly Dictionary<string, bool> callsApi = new(StringComparer.Ordinal);
    // glGetError is a query the program's own code may ask anywhere (learnopengl's glCheckError_): not a call to follow.
    private static readonly Regex ApiCallRe = new(@"\b(?!glGetError\b)(?:gl[A-Z]\w*|glfw[A-Z]\w*|vk[A-Z]\w*)\s*\(|\.\s*(?:use|setFloat|setInt|setBool|setVec2|setVec3|setVec4|setMat2|setMat3|setMat4)\s*\(", RegexOptions.CultureInvariant);
    private static readonly Regex CalledRe = new(@"(?<![\w.>])([A-Za-z_]\w*)\s*\(", RegexOptions.CultureInvariant);

    public bool Calls(string caller, string callee) => FunctionBody(caller) is { } body && CallRe(callee).IsMatch(body);

    /// <summary>
    /// The initializer of a variable's declaration: "{ … }" for name[] = { … }, name = { … } and name{ … }, or the
    /// expression of name = expr; (the last declaration in the file wins). Null when not found.
    /// </summary>
    public string? Initializer(string name)
    {
        // The source does not change: each name is looked up once (the C++ runner asks for the same names often).
        if (initializers.TryGetValue(name, out var cached)) return cached;
        return initializers[name] = FindInitializer(name);
    }

    private readonly Dictionary<string, string?> initializers = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string?> declaredTypes = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<(string Target, string Field, string Value, int Offset)>> fieldAssignments = new(StringComparer.Ordinal);

    private string? FindInitializer(string name)
    {
        var re = new Regex(@"(?<![\w.>])" + Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)*(?<eq>=\s*)?(?<brace>\{)?(?<paren>\()?", RegexOptions.CultureInvariant);
        string? found = null, foundBraces = null;
        foreach (Match m in re.Matches(Code))
        {
            // Must be a declaration: preceded by a type (an identifier, '>', '*' or '&' and whitespace).
            int j = m.Index - 1;
            while (j >= 0 && Code[j] is ' ' or '\t' or '\n') j--;
            // (or a comma: the second declarator of const uint32_t W = 1024, H = 1024;)
            if (j < 0 || !(char.IsLetterOrDigit(Code[j]) || Code[j] is '_' or '>' or '*' or '&' or ',')) continue;
            // "return name;", "else name = …" are not declarations.
            int k = j;
            while (k >= 0 && (char.IsLetterOrDigit(Code[k]) || Code[k] == '_')) k--;
            var word = Code[(k + 1)..(j + 1)];
            if (word is "return" or "else" or "case" or "delete" or "new" or "throw") continue;
            if (m.Groups["paren"].Success && !m.Groups["eq"].Success && !m.Groups["brace"].Success)
            {
                // Type name(args); – a constructor call: glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
                int open = m.Index + m.Length - 1;
                int close = MatchBracket(Code, open);
                int typeEnd = j + 1, typeStart = typeEnd;
                while (typeStart > 0 && (char.IsLetterOrDigit(Code[typeStart - 1]) || Code[typeStart - 1] is '_' or ':')) typeStart--;
                if (close > 0 && close + 1 < Code.Length && Code[(close + 1)..].TrimStart().StartsWith(';')) found = Code[typeStart..typeEnd] + Code[open..(close + 1)];
                continue;
            }
            if (m.Groups["brace"].Success)
            {
                int open = m.Index + m.Length - 1;
                int close = MatchBracket(Code, open);
                if (close > 0) foundBraces = Code[open..(close + 1)];
            }
            else if (m.Groups["eq"].Success)
            {
                int from = m.Index + m.Length, end = StatementEnd(from);
                // const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;: this declarator's value ends at a comma.
                int depth = 0;
                for (int q = from; q < end; q++)
                {
                    char ch = Code[q];
                    if (ch is '(' or '{' or '[' or '<') depth++;
                    else if (ch is ')' or '}' or ']' or '>') depth--;
                    else if (ch == ',' && depth == 0) { end = q; break; }
                }
                found = Code[from..end].Trim();
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
        if (declaredTypes.TryGetValue(name, out var cached)) return cached;
        return declaredTypes[name] = FindDeclaredType(name);
    }

    private string? FindDeclaredType(string name)
    {
        // "Type name" / "Type* name" / "std::vector<T> name" followed by = ; { ( [ , ): the first declaration in the
        // file. Found from the name backwards (a regex trying a type at every identifier is slow on a long program).
        foreach (Match m in Regex.Matches(Code, Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)*[=;{(\[,)]", RegexOptions.CultureInvariant))
        {
            int j = m.Index - 1;
            // At least one whitespace right before the name, after an optional * or &.
            if (j < 0 || !char.IsWhiteSpace(Code[j])) continue;
            while (j >= 0 && char.IsWhiteSpace(Code[j])) j--;
            if (j >= 0 && Code[j] is '*' or '&')
            {
                j--;
                while (j >= 0 && char.IsWhiteSpace(Code[j])) j--;
            }
            if (j < 0) continue;
            int typeEnd = j + 1;
            if (Code[j] == '>')
            {
                // A template's arguments: back to the matching '<' (no ; = ( ) { } inside).
                int depth = 0;
                for (; j >= 0; j--)
                {
                    char ch = Code[j];
                    if (ch is ';' or '=' or '(' or ')' or '{' or '}') { j = -1; break; }
                    if (ch == '>') depth++;
                    else if (ch == '<' && --depth == 0) break;
                }
                if (j < 0) continue;
                j--;
                while (j >= 0 && char.IsWhiteSpace(Code[j])) j--;
            }
            int identEnd = j + 1;
            while (j >= 0 && (char.IsLetterOrDigit(Code[j]) || Code[j] is '_' or ':')) j--;
            int start = j + 1;
            while (start < identEnd && !(char.IsLetter(Code[start]) || Code[start] == '_')) start++;
            if (start >= identEnd) continue;
            var type = Code[start..typeEnd];
            if (type is "return" or "else" or "case" or "new" or "delete") continue;
            return Regex.Replace(type, @"\s+", "");
        }
        return null;
    }

    /// <summary>The first declaration's type, the slow way (kept to check the fast one).</summary>
    internal string? DeclaredTypeByRegex(string name)
    {
        var m = Regex.Match(Code, @"(?<type>[A-Za-z_][\w:]*(?:\s*<[^;=(){}]*>)?)\s*[*&]?\s+" + Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)*[=;{(\[,)]", RegexOptions.CultureInvariant);
        while (m.Success && m.Groups["type"].Value is "return" or "else" or "case" or "new" or "delete")
            m = m.NextMatch();
        return m.Success ? Regex.Replace(m.Groups["type"].Value, @"\s+", "") : null;
    }

    /// <summary>Assignments "target.field = value;" (also through -> and with a swizzle-like .x after the field).</summary>
    public IEnumerable<(string Target, string Field, string Value, int Offset)> FieldAssignments(string field)
    {
        if (!fieldAssignments.TryGetValue(field, out var list)) fieldAssignments[field] = list = FindFieldAssignments(field).ToList();
        return list;
    }

    private IEnumerable<(string Target, string Field, string Value, int Offset)> FindFieldAssignments(string field)
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
