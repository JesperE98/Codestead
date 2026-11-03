namespace Codestead.Shell.Commands;

// awk: the tokenizer.

public static partial class AwkCmd
{
    private sealed class Tok
    {
        public required string T { get; init; }
        public required string V { get; init; }
        public double N { get; init; }
        public int Pos { get; init; }
        /// <summary>A '(' directly after a name, without space.</summary>
        public bool Tight { get; init; }
    }

    private static readonly HashSet<string> Keywords = new(StringComparer.Ordinal)
    {
        "BEGIN", "END", "if", "else", "while", "for", "in", "do", "break", "continue", "next", "nextfile",
        "exit", "print", "printf", "getline", "function", "func", "delete", "return",
    };

    private static readonly HashSet<string> Builtins = new(StringComparer.Ordinal)
    {
        "length", "substr", "index", "split", "sub", "gsub", "match", "sprintf", "toupper", "tolower", "int",
        "sqrt", "exp", "log", "sin", "cos", "atan2", "rand", "srand", "system", "close", "fflush",
    };
    private static readonly HashSet<string> UnsupportedBuiltins = new(StringComparer.Ordinal) { "system", "close", "fflush" };

    private static readonly string[] Ops =
    {
        "**=", "+=", "-=", "*=", "/=", "%=", "^=", "==", "<=", ">=", "!=", "++", "--", "&&", "||", ">>", "!~", "**",
        "{", "}", "(", ")", "[", "]", ";", ",", "+", "-", "*", "/", "%", "^", "!", ">", "<", "|", "?", ":", "~", "$", "=",
    };

    private static bool IsOctal(string c) => c.Length == 1 && c[0] is >= '0' and <= '7';

    /// <summary>Turns escape sequences in a string into characters (\n, \t, \\, \" ...).</summary>
    public static string UnescapeAwk(string s)
    {
        var o = new StringBuilder();
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c != '\\' || i + 1 >= s.Length)
            {
                o.Append(c);
                continue;
            }
            char n = s[++i];
            switch (n)
            {
                case 'n': o.Append('\n'); break;
                case 't': o.Append('\t'); break;
                case 'r': o.Append('\r'); break;
                case 'a': o.Append('\x07'); break;
                case 'b': o.Append('\b'); break;
                case 'f': o.Append('\f'); break;
                case 'v': o.Append('\v'); break;
                case '\\': o.Append('\\'); break;
                case '"': o.Append('"'); break;
                case '/': o.Append('/'); break;
                default:
                    if (n is >= '0' and <= '7')
                    {
                        var oct = n.ToString();
                        while (oct.Length < 3 && IsOctal(s.CharAt(i + 1))) oct += s[++i];
                        o.Append((char)Convert.ToInt32(oct, 8));
                    }
                    else o.Append(n);
                    break;
            }
        }
        return o.ToString();
    }

    private static readonly Regex NumTokRe = new(@"^([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?", RegexOptions.CultureInvariant);
    private static readonly Regex NameTokRe = new(@"^[A-Za-z_][A-Za-z0-9_]*", RegexOptions.CultureInvariant);

    private static List<Tok> Tokenize(string src)
    {
        var toks = new List<Tok>();
        int i = 0;
        bool RegexAllowed()
        {
            var p = toks.Count > 0 ? toks[^1] : null;
            if (p is null) return true;
            if (p.T is "num" or "str" or "ere" or "name" or "builtin") return false;
            return !(p.T == "op" && p.V is ")" or "]" or "$" or "++" or "--");
        }
        while (i < src.Length)
        {
            char c = src[i];
            if (c == ' ' || c == '\t' || c == '\r')
            {
                i++;
                continue;
            }
            if (c == '\\' && src.CharAt(i + 1) == "\n")
            {
                i += 2;
                continue;
            }
            if (c == '#')
            {
                while (i < src.Length && src[i] != '\n') i++;
                continue;
            }
            if (c == '\n')
            {
                toks.Add(new Tok { T = "nl", V = "\n", Pos = i });
                i++;
                continue;
            }
            int start = i;
            if (c is >= '0' and <= '9' || (c == '.' && src.CharAt(i + 1) is [>= '0' and <= '9']))
            {
                var m = NumTokRe.Match(src[i..]);
                toks.Add(new Tok { T = "num", V = m.Value, N = Js.Number(m.Value), Pos = start });
                i += m.Value.Length;
                continue;
            }
            if (c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or '_')
            {
                var w = NameTokRe.Match(src[i..]).Value;
                i += w.Length;
                var t = Keywords.Contains(w) ? "kw" : Builtins.Contains(w) ? "builtin" : "name";
                toks.Add(new Tok { T = t, V = w, Pos = start });
                if (src.CharAt(i) == "(")
                {
                    toks.Add(new Tok { T = "op", V = "(", Pos = i, Tight = true });
                    i++;
                }
                continue;
            }
            if (c == '"')
            {
                int j = i + 1;
                var raw = new StringBuilder();
                while (j < src.Length && src[j] != '"')
                {
                    if (src[j] == '\n') throw new AwkSyntaxError("unterminated string", start);
                    if (src[j] == '\\' && j + 1 < src.Length)
                    {
                        raw.Append(src[j]).Append(src[j + 1]);
                        j += 2;
                    }
                    else raw.Append(src[j++]);
                }
                if (j >= src.Length) throw new AwkSyntaxError("unterminated string", start);
                toks.Add(new Tok { T = "str", V = UnescapeAwk(raw.ToString()), Pos = start });
                i = j + 1;
                continue;
            }
            if (c == '/' && RegexAllowed())
            {
                int j = i + 1;
                var raw = new StringBuilder();
                bool inBracket = false;
                while (j < src.Length && (src[j] != '/' || inBracket))
                {
                    if (src[j] == '\n') throw new AwkSyntaxError("unterminated regexp", start);
                    if (src[j] == '\\' && j + 1 < src.Length)
                    {
                        if (src[j + 1] == '/') raw.Append('/');
                        else raw.Append(src[j]).Append(src[j + 1]);
                        j += 2;
                        continue;
                    }
                    if (src[j] == '[') inBracket = true;
                    else if (src[j] == ']') inBracket = false;
                    raw.Append(src[j++]);
                }
                if (j >= src.Length) throw new AwkSyntaxError("unterminated regexp", start);
                toks.Add(new Tok { T = "ere", V = raw.ToString(), Pos = start });
                i = j + 1;
                continue;
            }
            var op = Ops.FirstOrDefault(o => src.AsSpan(i).StartsWith(o, StringComparison.Ordinal));
            if (op is null) throw new AwkSyntaxError($"invalid char '{c}' in expression", start);
            toks.Add(new Tok { T = "op", V = op == "**" ? "^" : op == "**=" ? "^=" : op, Pos = start });
            i += op.Length;
        }
        toks.Add(new Tok { T = "eof", V = "", Pos = src.Length });
        return toks;
    }
}
