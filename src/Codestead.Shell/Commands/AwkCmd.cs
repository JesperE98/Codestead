using System.Numerics;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/awk.ts – a small awk interpreter: tokenizer, recursive parser
// and a tree interpreter. Supports a useful subset of the language: pattern/action,
// BEGIN/END, fields, variables, arrays, if/while/for, print/printf and the most common
// builtin functions. Anything missing gives a syntax error from the parser.
//
// Values (TS: number | string | StrNum) are boxed as object: double, string or StrNum.

// ---------- Errors ----------

public partial class AwkSyntaxError : Exception
{
    public int Pos { get; }
    /// <summary>Set when the construct exists in real awk but not in the simulator.</summary>
    public (string Sv, string En)? Unsupported { get; }

    public AwkSyntaxError(string message, int pos, (string Sv, string En)? unsupported = null) : base(message)
    {
        Pos = pos;
        Unsupported = unsupported;
    }
}

public partial class AwkFatal : Exception
{
    public AwkFatal(string message) : base(message) { }
}

// ---------- Syntax tree ----------

public abstract partial class Expr
{
    public sealed class Num(double v) : Expr { public double V { get; } = v; }
    public sealed class Str(string v) : Expr { public string V { get; } = v; }
    public sealed class Re(string src) : Expr { public string Src { get; } = src; }
    public sealed class Var(string name) : Expr { public string Name { get; } = name; }
    public sealed class Field(Expr e) : Expr { public Expr E { get; } = e; }
    public sealed class Idx(string name, List<Expr> subs) : Expr { public string Name { get; } = name; public List<Expr> Subs { get; } = subs; }
    public sealed class Assign(string op, Expr target, Expr e) : Expr { public string Op { get; } = op; public Expr Target { get; } = target; public Expr E { get; } = e; }
    public sealed class Cond(Expr c, Expr a, Expr b) : Expr { public Expr C { get; } = c; public Expr A { get; } = a; public Expr B { get; } = b; }
    /// <summary>k: "and" | "or"</summary>
    public sealed class Logic(string k, Expr a, Expr b) : Expr { public string K { get; } = k; public Expr A { get; } = a; public Expr B { get; } = b; }
    /// <summary>k: "not" | "neg" | "pos"</summary>
    public sealed class Unary(string k, Expr e) : Expr { public string K { get; } = k; public Expr E { get; } = e; }
    public sealed class Bin(string op, Expr a, Expr b) : Expr { public string Op { get; } = op; public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Cmp(string op, Expr a, Expr b) : Expr { public string Op { get; } = op; public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Match(bool neg, Expr a, Expr re) : Expr { public bool Neg { get; } = neg; public Expr A { get; } = a; public new Expr Re { get; } = re; }
    public sealed class Concat(Expr a, Expr b) : Expr { public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Incr(string op, bool prefix, Expr target) : Expr { public string Op { get; } = op; public bool Prefix { get; } = prefix; public Expr Target { get; } = target; }
    public sealed class Call(string name, List<Expr> args) : Expr { public string Name { get; } = name; public List<Expr> Args { get; } = args; }
    public sealed class In(List<Expr> subs, string arr) : Expr { public List<Expr> Subs { get; } = subs; public string Arr { get; } = arr; }
    public sealed class Group(List<Expr> list) : Expr { public List<Expr> List { get; } = list; }
}

public abstract partial class Stmt
{
    /// <summary>k: "print" | "printf"</summary>
    public sealed class Print(string k, List<Expr> args) : Stmt { public string K { get; } = k; public List<Expr> Args { get; } = args; }
    public sealed class ExprStmt(Expr e) : Stmt { public Expr E { get; } = e; }
    public sealed class Block(List<Stmt> body) : Stmt { public List<Stmt> Body { get; } = body; }
    public sealed class If(Expr c, Stmt then, Stmt? @else) : Stmt { public Expr C { get; } = c; public Stmt Then { get; } = then; public Stmt? Else { get; } = @else; }
    public sealed class While(Expr c, Stmt body) : Stmt { public Expr C { get; } = c; public Stmt Body { get; } = body; }
    public sealed class Do(Expr c, Stmt body) : Stmt { public Expr C { get; } = c; public Stmt Body { get; } = body; }
    public sealed class For(Stmt? init, Expr? c, Stmt? step, Stmt body) : Stmt { public Stmt? Init { get; } = init; public Expr? C { get; } = c; public Stmt? Step { get; } = step; public Stmt Body { get; } = body; }
    public sealed class ForIn(string v, string arr, Stmt body) : Stmt { public string V { get; } = v; public string Arr { get; } = arr; public Stmt Body { get; } = body; }
    /// <summary>k: "next" | "break" | "continue"</summary>
    public sealed class Jump(string k) : Stmt { public string K { get; } = k; }
    public sealed class Exit(Expr? e) : Stmt { public Expr? E { get; } = e; }
    public sealed class Delete(string arr, List<Expr>? subs) : Stmt { public string Arr { get; } = arr; public List<Expr>? Subs { get; } = subs; }
}

public partial class Rule
{
    /// <summary>"BEGIN", "END", an <see cref="Expr"/> or null (every record).</summary>
    public object? Pattern { get; set; }
    public List<Stmt>? Action { get; set; }
}

public partial class AwkInput
{
    public string Name { get; set; } = "";
    public string Content { get; set; } = "";
}

public partial class AwkIO
{
    public required Action<string> Out { get; init; }
    /// <summary>Reads a file; returns null (and prints the error itself) if that failed.</summary>
    public required Func<string, AwkInput?> ReadInput { get; init; }
    /// <summary>Like mawk: toupper/tolower only change a-z (not å, ä, ö).</summary>
    public bool AsciiCase { get; init; }
}

public static partial class AwkCmd
{
    // ---------- Tokenizer ----------

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

    // ---------- Parser ----------

    private static readonly HashSet<string> AssignOps = new(StringComparer.Ordinal) { "=", "+=", "-=", "*=", "/=", "%=", "^=" };
    internal static bool IsLvalue(Expr e) => e is Expr.Var or Expr.Field or Expr.Idx;

    private sealed class AwkParser(List<Tok> toks)
    {
        private int p;
        /// <summary>Inside the arguments to print: ">" means redirection, not comparison.</summary>
        private bool noGt;

        private Tok Tok => toks[p];
        private bool Is(string v, string t = "op") => Tok.T == t && Tok.V == v;
        private Tok Next() => toks[p++];

        private AwkSyntaxError Fail(Tok? tok = null)
        {
            tok ??= Tok;
            if (tok.T is "eof" or "nl") return new AwkSyntaxError("unexpected newline or end of string", tok.Pos);
            return new AwkSyntaxError("syntax error", tok.Pos);
        }

        private AwkSyntaxError Unsupported(string sv, string en, Tok? tok = null) =>
            new("syntax error", (tok ?? Tok).Pos, (sv, en));

        private Tok Expect(string v)
        {
            if (!Is(v)) throw Fail();
            return Next();
        }

        private void SkipNl()
        {
            while (Tok.T == "nl") p++;
        }

        private void SkipTerms()
        {
            while (Tok.T == "nl" || Is(";")) p++;
        }

        public List<Rule> Program()
        {
            var rules = new List<Rule>();
            SkipTerms();
            while (Tok.T != "eof")
            {
                rules.Add(ParseRule());
                SkipTerms();
            }
            return rules;
        }

        private Rule ParseRule()
        {
            if (Is("BEGIN", "kw") || Is("END", "kw"))
            {
                var pat = Next().V;
                if (!Is("{")) throw Fail();
                return new Rule { Pattern = pat, Action = ParseBlock() };
            }
            if (Is("function", "kw") || Is("func", "kw")) throw Unsupported("egna funktioner (function)", "user-defined functions (function)");
            Expr? pattern = null;
            if (!Is("{"))
            {
                pattern = ParseExpr();
                if (Is(",")) throw Unsupported("intervallmönster (/start/,/slut/)", "range patterns (/start/,/end/)");
            }
            if (Is("{")) return new Rule { Pattern = pattern, Action = ParseBlock() };
            if (Tok.T != "nl" && !Is(";") && Tok.T != "eof") throw Fail();
            return new Rule { Pattern = pattern, Action = null };
        }

        private List<Stmt> ParseBlock()
        {
            Expect("{");
            var body = new List<Stmt>();
            for (; ; )
            {
                SkipTerms();
                if (Is("}")) break;
                if (Tok.T == "eof") throw Fail();
                body.Add(ParseStmt());
            }
            Next();
            return body;
        }

        /// <summary>After a simple statement: ; or newline, or } / end which is not consumed.</summary>
        private void EndSimple()
        {
            if (Is(";") || Tok.T == "nl")
            {
                Next();
                return;
            }
            if (Is("}") || Tok.T == "eof") return;
            throw Fail();
        }

        private Stmt Body()
        {
            SkipNl();
            if (Is(";"))
            {
                Next();
                return new Stmt.Block(new List<Stmt>());
            }
            return ParseStmt();
        }

        private Stmt ParseStmt()
        {
            var t = Tok;
            if (Is("{")) return new Stmt.Block(ParseBlock());
            if (t.T == "kw")
            {
                switch (t.V)
                {
                    case "if":
                    {
                        Next();
                        Expect("(");
                        var c = ParseExpr();
                        Expect(")");
                        var then = Body();
                        int save = p;
                        SkipTerms();
                        if (Is("else", "kw"))
                        {
                            Next();
                            return new Stmt.If(c, then, Body());
                        }
                        p = save;
                        return new Stmt.If(c, then, null);
                    }
                    case "while":
                    {
                        Next();
                        Expect("(");
                        var c = ParseExpr();
                        Expect(")");
                        return new Stmt.While(c, Body());
                    }
                    case "do":
                    {
                        Next();
                        var body = Body();
                        SkipTerms();
                        if (!Is("while", "kw")) throw Fail();
                        Next();
                        Expect("(");
                        var c = ParseExpr();
                        Expect(")");
                        EndSimple();
                        return new Stmt.Do(c, body);
                    }
                    case "for":
                    {
                        Next();
                        Expect("(");
                        var t1 = toks[p];
                        var t2 = p + 1 < toks.Count ? toks[p + 1] : null;
                        var t3 = p + 2 < toks.Count ? toks[p + 2] : null;
                        var t4 = p + 3 < toks.Count ? toks[p + 3] : null;
                        if (t1.T == "name" && t2 is { T: "kw", V: "in" } && t3 is { T: "name" } && t4 is { T: "op", V: ")" })
                        {
                            p += 4;
                            return new Stmt.ForIn(t1.V, t3.V, Body());
                        }
                        var init = Is(";") ? null : Simple();
                        Expect(";");
                        SkipNl();
                        var c = Is(";") ? null : ParseExpr();
                        Expect(";");
                        SkipNl();
                        var step = Is(")") ? null : Simple();
                        Expect(")");
                        return new Stmt.For(init, c, step, Body());
                    }
                    case "next":
                    case "break":
                    case "continue":
                        Next();
                        EndSimple();
                        return new Stmt.Jump(t.V);
                    case "exit":
                    {
                        Next();
                        var e = Is(";") || Is("}") || Tok.T == "nl" || Tok.T == "eof" ? null : ParseExpr();
                        EndSimple();
                        return new Stmt.Exit(e);
                    }
                    case "delete":
                    {
                        Next();
                        if (Tok.T != "name") throw Fail();
                        var arr = Next().V;
                        List<Expr>? subs = null;
                        if (Is("[")) subs = Subscripts();
                        EndSimple();
                        return new Stmt.Delete(arr, subs);
                    }
                    case "getline":
                        throw Unsupported("getline", "getline");
                    case "return":
                        throw Unsupported("egna funktioner (return)", "user-defined functions (return)");
                    case "nextfile":
                        throw Unsupported("nextfile", "nextfile");
                }
            }
            var s = Simple();
            EndSimple();
            return s;
        }

        /// <summary>print, printf or an expression (without the trailing ;).</summary>
        private Stmt Simple()
        {
            if (Is("print", "kw") || Is("printf", "kw"))
            {
                var k = Next().V;
                var args = new List<Expr>();
                bool AtEnd() => Is(";") || Is("}") || Tok.T == "nl" || Tok.T == "eof";
                if (!AtEnd() && !Is(">") && !Is(">>") && !Is("|"))
                {
                    bool saved = noGt;
                    noGt = true;
                    args = new List<Expr> { ParseExpr() };
                    while (Is(","))
                    {
                        Next();
                        SkipNl();
                        args.Add(ParseExpr());
                    }
                    noGt = saved;
                }
                if (args.Count == 1 && args[0] is Expr.Group g) args = g.List;
                if (Is(">") || Is(">>") || Is("|"))
                    throw Unsupported($"omdirigering av utdata ({k} {Tok.V} ...)", $"output redirection ({k} {Tok.V} ...)");
                if (k == "printf" && args.Count == 0) throw Fail();
                return new Stmt.Print(k, args);
            }
            return new Stmt.ExprStmt(ParseExpr());
        }

        private List<Expr> Subscripts()
        {
            Expect("[");
            bool saved = noGt;
            noGt = false;
            var subs = new List<Expr> { ParseExpr() };
            while (Is(","))
            {
                Next();
                subs.Add(ParseExpr());
            }
            noGt = saved;
            Expect("]");
            return subs;
        }

        public Expr ParseExpr() => Ternary();

        private Expr Ternary()
        {
            var c = Or();
            if (Is("?"))
            {
                Next();
                SkipNl();
                var a = Ternary();
                SkipNl();
                Expect(":");
                SkipNl();
                var b = Ternary();
                return new Expr.Cond(c, a, b);
            }
            if (Tok.T == "op" && AssignOps.Contains(Tok.V) && IsLvalue(c))
            {
                var op = Next().V;
                SkipNl();
                return new Expr.Assign(op, c, Ternary());
            }
            return c;
        }

        private Expr Or()
        {
            var a = And();
            while (Is("||"))
            {
                Next();
                SkipNl();
                a = new Expr.Logic("or", a, And());
            }
            return a;
        }

        private Expr And()
        {
            var a = InExpr();
            while (Is("&&"))
            {
                Next();
                SkipNl();
                a = new Expr.Logic("and", a, InExpr());
            }
            return a;
        }

        private Expr InExpr()
        {
            var a = MatchExpr();
            while (Is("in", "kw"))
            {
                Next();
                if (Tok.T != "name") throw Fail();
                a = new Expr.In(a is Expr.Group g ? g.List : new List<Expr> { a }, Next().V);
            }
            return a;
        }

        private Expr MatchExpr()
        {
            var a = CmpExpr();
            while (Is("~") || Is("!~"))
            {
                bool neg = Next().V == "!~";
                a = new Expr.Match(neg, a, CmpExpr());
            }
            return a;
        }

        private Expr CmpExpr()
        {
            var a = Concat();
            if (Tok.T == "op" && (Tok.V is "<" or "<=" or "==" or "!=" or ">=" || (!noGt && Tok.V == ">")))
            {
                var op = Next().V;
                return new Expr.Cmp(op, a, Concat());
            }
            return a;
        }

        /// <summary>Can the next token start a new operand? Then it is string concatenation ("a" b).</summary>
        private bool StartsOperand()
        {
            var t = Tok;
            if (t.T is "num" or "str" or "name" or "builtin") return true;
            return t.T == "op" && (t.V == "$" || t.V == "(");
        }

        private Expr Concat()
        {
            var a = Additive();
            while (StartsOperand()) a = new Expr.Concat(a, Additive());
            return a;
        }

        private Expr Additive()
        {
            var a = Mul();
            while (Is("+") || Is("-"))
            {
                var op = Next().V;
                a = new Expr.Bin(op, a, Mul());
            }
            return a;
        }

        private Expr Mul()
        {
            var a = UnaryExpr();
            while (Is("*") || Is("/") || Is("%"))
            {
                var op = Next().V;
                a = new Expr.Bin(op, a, UnaryExpr());
            }
            return a;
        }

        private Expr UnaryExpr()
        {
            if (Is("!"))
            {
                Next();
                return new Expr.Unary("not", UnaryExpr());
            }
            if (Is("-"))
            {
                Next();
                return new Expr.Unary("neg", UnaryExpr());
            }
            if (Is("+"))
            {
                Next();
                return new Expr.Unary("pos", UnaryExpr());
            }
            return Pow();
        }

        private Expr Pow()
        {
            var a = Postfix();
            if (Is("^"))
            {
                Next();
                // Right associative: 2^3^2 = 2^9. Also allows 2^-1.
                Expr b;
                if (Is("-"))
                {
                    Next();
                    b = new Expr.Unary("neg", Pow());
                }
                else b = Pow();
                return new Expr.Bin("^", a, b);
            }
            return a;
        }

        private Expr Postfix()
        {
            if (Is("++") || Is("--"))
            {
                var tok = Next();
                var target = Postfix();
                if (!IsLvalue(target)) throw Fail(tok);
                return new Expr.Incr(tok.V, true, target);
            }
            var e = Primary();
            if (IsLvalue(e) && (Is("++") || Is("--"))) return new Expr.Incr(Next().V, false, e);
            return e;
        }

        private Expr Primary()
        {
            var t = Tok;
            switch (t.T)
            {
                case "num":
                    Next();
                    return new Expr.Num(t.N);
                case "str":
                    Next();
                    return new Expr.Str(t.V);
                case "ere":
                    Next();
                    return new Expr.Re(t.V);
                case "name":
                {
                    Next();
                    if (Is("[")) return new Expr.Idx(t.V, Subscripts());
                    if (Is("(") && Tok.Tight) throw Unsupported($"egna funktioner ({t.V}(...))", $"user-defined functions ({t.V}(...))", t);
                    return new Expr.Var(t.V);
                }
                case "builtin":
                {
                    Next();
                    if (UnsupportedBuiltins.Contains(t.V)) throw Unsupported($"funktionen {t.V}()", $"the function {t.V}()", t);
                    if (!Is("("))
                    {
                        if (t.V == "length") return new Expr.Call("length", new List<Expr>());
                        throw Fail();
                    }
                    Next();
                    bool saved = noGt;
                    noGt = false;
                    var args = new List<Expr>();
                    SkipNl();
                    if (!Is(")"))
                    {
                        args.Add(ParseExpr());
                        while (Is(","))
                        {
                            Next();
                            SkipNl();
                            args.Add(ParseExpr());
                        }
                    }
                    noGt = saved;
                    Expect(")");
                    return new Expr.Call(t.V, args);
                }
                case "kw":
                    if (t.V == "getline") throw Unsupported("getline", "getline");
                    throw Fail();
                case "op":
                    if (t.V == "$")
                    {
                        Next();
                        Expr e;
                        if (Is("++") || Is("--")) e = Postfix();
                        else if (Is("-"))
                        {
                            Next();
                            e = new Expr.Unary("neg", Primary());
                        }
                        else e = Primary();
                        return new Expr.Field(e);
                    }
                    if (t.V == "(")
                    {
                        Next();
                        bool saved = noGt;
                        noGt = false;
                        var list = new List<Expr> { ParseExpr() };
                        while (Is(","))
                        {
                            Next();
                            SkipNl();
                            list.Add(ParseExpr());
                        }
                        noGt = saved;
                        Expect(")");
                        return list.Count == 1 ? list[0] : new Expr.Group(list);
                    }
                    if (t.V is "-" or "+" or "!") return UnaryExpr();
                    if (t.V is "++" or "--") return Postfix();
                    break;
            }
            throw Fail();
        }
    }

    public static List<Rule> ParseAwk(string src) => new AwkParser(Tokenize(src)).Program();

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

    // ---------- JavaScript number formatting (exact, like V8) ----------

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

// ---------- The interpreter ----------

public partial class AwkInterpreter
{
    private sealed class NextSignal : Exception { }
    private sealed class BreakSignal : Exception { }
    private sealed class ContinueSignal : Exception { }
    private sealed class AwkExitSignal(int code) : Exception { public int Code { get; } = code; }

    private const int MaxSteps = 200_000;

    private readonly Dictionary<string, object> vars = new(StringComparer.Ordinal);
    private readonly Dictionary<string, OrderedDictionary<string, object>> arrays = new(StringComparer.Ordinal);
    private string record = "";
    private List<string> fields = new();
    private int nf;
    private readonly Dictionary<string, Regex> regexCache = new(StringComparer.Ordinal);
    private int steps;
    private readonly List<Rule> rules;
    private readonly AwkIO io;

    private static readonly Regex AssignOperandRe = new(@"^[A-Za-z_][A-Za-z0-9_]*=", RegexOptions.CultureInvariant);
    private static readonly Regex AssignFullRe = new(@"^([A-Za-z_][A-Za-z0-9_]*)=(.*)\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex IntKeyRe = new(@"^-?[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex SpaceSplitRe = new(@"[ \t\n]+", RegexOptions.CultureInvariant);

    public AwkInterpreter(List<Rule> rules, AwkIO io)
    {
        this.rules = rules;
        this.io = io;
        vars["FS"] = " ";
        vars["OFS"] = " ";
        vars["ORS"] = "\n";
        vars["RS"] = "\n";
        vars["NR"] = 0.0;
        vars["FNR"] = 0.0;
        vars["FILENAME"] = "";
        vars["SUBSEP"] = "\x1c";
        vars["RSTART"] = 0.0;
        vars["RLENGTH"] = -1.0;
        vars["CONVFMT"] = "%.6g";
        vars["OFMT"] = "%.6g";
    }

    private static double Num(object v) => AwkCmd.Num(v);
    private static string Str(object v) => AwkCmd.Str(v);
    private static bool Truthy(object v) => AwkCmd.Truthy(v);

    /// <summary>-v name=value and name=value among the file arguments.</summary>
    public void Assign(string name, string value) => vars[name] = new AwkCmd.StrNum(AwkCmd.UnescapeAwk(value));

    public int Run(List<string> operands, string stdin)
    {
        int code = 0;
        var begin = rules.Where(r => r.Pattern is "BEGIN").ToList();
        var end = rules.Where(r => r.Pattern is "END").ToList();
        var main = rules.Where(r => r.Pattern is not "BEGIN" and not "END").ToList();
        bool exited = false;
        try
        {
            foreach (var r in begin) ExecBody(r.Action!);
        }
        catch (AwkExitSignal e)
        {
            code = e.Code;
            exited = true;
        }
        if (!exited && (main.Count > 0 || end.Count > 0))
        {
            try
            {
                var files = operands.Where(o => !AssignOperandRe.IsMatch(o)).ToList();
                var sources = files.Count > 0 ? operands : operands.Append("-").ToList();
                foreach (var op in sources)
                {
                    var m = AssignFullRe.Match(op);
                    if (m.Success)
                    {
                        Assign(m.Groups[1].Value, m.Groups[2].Value);
                        continue;
                    }
                    var input = op == "-" ? new AwkInput { Name = "", Content = stdin } : io.ReadInput(op);
                    if (input is null)
                    {
                        code = 2;
                        continue;
                    }
                    vars["FILENAME"] = input.Name;
                    vars["FNR"] = 0.0;
                    foreach (var rec in Records(input.Content))
                    {
                        vars["NR"] = Num(vars["NR"]) + 1;
                        vars["FNR"] = Num(vars["FNR"]) + 1;
                        SetRecord(rec);
                        try
                        {
                            foreach (var r in main)
                            {
                                if (r.Pattern is not null && !Truthy(Ev((Expr)r.Pattern))) continue;
                                if (r.Action is not null) ExecBody(r.Action);
                                else io.Out(record + Str(vars["ORS"]));
                            }
                        }
                        catch (NextSignal)
                        {
                        }
                    }
                }
            }
            catch (AwkExitSignal e)
            {
                code = e.Code;
            }
        }
        try
        {
            foreach (var r in end) ExecBody(r.Action!);
        }
        catch (AwkExitSignal e)
        {
            code = e.Code;
        }
        return code;
    }

    private List<string> Records(string content)
    {
        var rs = Str(vars["RS"]);
        if (content == "") return new List<string>();
        if (rs == "\n" || rs == "")
        {
            var lines = content.Split('\n').ToList();
            if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
            return lines;
        }
        var recs = content.Split(rs[0]).ToList();
        if (recs[^1] == "" || recs[^1] == "\n") recs.RemoveAt(recs.Count - 1);
        return recs;
    }

    // ---------- Records and fields ----------

    private List<string> SplitFs(string s, string fs)
    {
        if (fs == " ")
        {
            var t = s.Trim();
            return t == "" ? new List<string>() : RegexCmd.JsSplit(t, SpaceSplitRe);
        }
        if (s == "") return new List<string>();
        if (fs.Length == 1 && fs != "\\") return s.Split(fs[0]).ToList();
        return RegexCmd.JsSplit(s, GetRegex(fs, ""));
    }

    private void SetRecord(string rec)
    {
        record = rec;
        var parts = SplitFs(rec, Str(vars["FS"]));
        fields = new List<string> { "" };
        fields.AddRange(parts);
        nf = parts.Count;
    }

    private void Rebuild() => record = string.Join(Str(vars["OFS"]), fields.Skip(1).Take(nf));

    private object GetField(double i)
    {
        if (i < 0) throw new AwkFatal($"attempt to access field {AwkCmd.JsString(i)}");
        if (i == 0) return new AwkCmd.StrNum(record);
        return i <= nf ? new AwkCmd.StrNum(fields[(int)i]) : AwkCmd.Uninit;
    }

    private void SetField(double i, string v)
    {
        if (i < 0) throw new AwkFatal($"attempt to access field {AwkCmd.JsString(i)}");
        if (i == 0)
        {
            SetRecord(v);
            return;
        }
        if (double.IsNaN(i))
        {
            Rebuild();
            return;
        }
        int idx = (int)Math.Min(i, int.MaxValue - 1);
        while (fields.Count <= idx) fields.Add("");
        fields[idx] = v;
        if (idx > nf) nf = idx;
        Rebuild();
    }

    // ---------- Variables ----------

    private object GetVar(string name)
    {
        if (name == "NF") return (double)nf;
        if (arrays.ContainsKey(name)) throw new AwkFatal($"attempt to use array `{name}' in a scalar context");
        return vars.TryGetValue(name, out var v) ? v : AwkCmd.Uninit;
    }

    private void SetVar(string name, object v)
    {
        if (arrays.ContainsKey(name)) throw new AwkFatal($"attempt to use array `{name}' in a scalar context");
        if (name == "NF")
        {
            double n = Math.Max(0, Math.Truncate(Num(v)));
            if (double.IsNaN(n)) n = 0;
            int ni = (int)Math.Min(n, int.MaxValue - 1);
            while (fields.Count <= ni) fields.Add("");
            nf = ni;
            Rebuild();
            return;
        }
        vars[name] = v;
    }

    private OrderedDictionary<string, object> GetArray(string name)
    {
        if (vars.ContainsKey(name) || name == "NF") throw new AwkFatal($"attempt to use scalar `{name}' as an array");
        if (!arrays.TryGetValue(name, out var a))
        {
            a = new OrderedDictionary<string, object>(StringComparer.Ordinal);
            arrays[name] = a;
        }
        return a;
    }

    private string Key(List<Expr> subs) => string.Join(Str(vars["SUBSEP"]), subs.Select(s => Str(Ev(s))));

    private object Get(Expr target)
    {
        switch (target)
        {
            case Expr.Var v:
                return GetVar(v.Name);
            case Expr.Field f:
                return GetField(Math.Truncate(Num(Ev(f.E))));
            case Expr.Idx x:
            {
                var a = GetArray(x.Name);
                var k = Key(x.Subs);
                if (!a.ContainsKey(k)) a[k] = AwkCmd.Uninit;
                return a[k];
            }
        }
        throw new AwkFatal("invalid assignment target");
    }

    private void Set(Expr target, object v)
    {
        if (target is Expr.Var var) SetVar(var.Name, v);
        else if (target is Expr.Field f) SetField(Math.Truncate(Num(Ev(f.E))), Str(v));
        else if (target is Expr.Idx x) GetArray(x.Name)[Key(x.Subs)] = v;
    }

    private Regex GetRegex(string src, string flags)
    {
        var key = flags + "/" + src;
        if (!regexCache.TryGetValue(key, out var re))
        {
            try
            {
                re = RegexCmd.NewRegExp(RegexCmd.ToJsRegex(src, true), flags);
            }
            catch (ArgumentException)
            {
                throw new AwkFatal($"invalid regexp: /{src}/");
            }
            regexCache[key] = re;
        }
        return re;
    }

    private Regex RegexOf(Expr e, string flags = "") => GetRegex(e is Expr.Re r ? r.Src : Str(Ev(e)), flags);

    // ---------- Statements ----------

    private void Tick()
    {
        if (++steps > MaxSteps) throw new AwkFatal("__steps__");
    }

    private void ExecBody(List<Stmt> body)
    {
        foreach (var s in body) Exec(s);
    }

    private void Exec(Stmt s)
    {
        Tick();
        switch (s)
        {
            case Stmt.Print { K: "print" } pr:
            {
                var ofs = Str(vars["OFS"]);
                var ors = Str(vars["ORS"]);
                var text = pr.Args.Count > 0
                    ? string.Join(ofs, pr.Args.Select(a =>
                    {
                        var v = Ev(a);
                        return v is double d && !(double.IsFinite(d) && Math.Floor(d) == d && Math.Abs(d) < 1e16)
                            ? AwkCmd.AwkSprintf(Str(vars["OFMT"]), new List<object> { d })
                            : Str(v);
                    }).ToList())
                    : record;
                io.Out(text + ors);
                return;
            }
            case Stmt.Print pf:
            {
                var vals = pf.Args.Select(Ev).ToList();
                io.Out(AwkCmd.AwkSprintf(Str(vals[0]), vals.Skip(1).ToList()));
                return;
            }
            case Stmt.ExprStmt es:
                Ev(es.E);
                return;
            case Stmt.Block b:
                ExecBody(b.Body);
                return;
            case Stmt.If i:
                if (Truthy(Ev(i.C))) Exec(i.Then);
                else if (i.Else is not null) Exec(i.Else);
                return;
            case Stmt.While w:
                while (Truthy(Ev(w.C)))
                    if (!LoopBody(w.Body)) break;
                return;
            case Stmt.Do d:
                do
                {
                    if (!LoopBody(d.Body)) break;
                } while (Truthy(Ev(d.C)));
                return;
            case Stmt.For f:
                if (f.Init is not null) Exec(f.Init);
                while (f.C is null || Truthy(Ev(f.C)))
                {
                    if (!LoopBody(f.Body)) break;
                    if (f.Step is not null) Exec(f.Step);
                }
                return;
            case Stmt.ForIn fi:
            {
                var keys = GetArray(fi.Arr).Keys.ToList();
                foreach (var k in keys)
                {
                    bool isNum = IntKeyRe.IsMatch(k);
                    SetVar(fi.V, new AwkCmd.StrNum(k, isNum));
                    if (!LoopBody(fi.Body)) break;
                }
                return;
            }
            case Stmt.Jump { K: "next" }:
                throw new NextSignal();
            case Stmt.Jump { K: "break" }:
                throw new BreakSignal();
            case Stmt.Jump:
                throw new ContinueSignal();
            case Stmt.Exit ex:
                throw new AwkExitSignal(ex.E is not null ? ToExitCode(Math.Truncate(Num(Ev(ex.E)))) : 0);
            case Stmt.Delete del:
                if (del.Subs is not null) GetArray(del.Arr).Remove(Key(del.Subs));
                else GetArray(del.Arr).Clear();
                return;
        }
    }

    private static int ToExitCode(double d) => double.IsNaN(d) ? 0 : (int)Math.Clamp(d, int.MinValue, int.MaxValue);

    /// <summary>Runs a loop body. Returns false on break.</summary>
    private bool LoopBody(Stmt body)
    {
        Tick();
        try
        {
            Exec(body);
        }
        catch (BreakSignal)
        {
            return false;
        }
        catch (ContinueSignal)
        {
        }
        return true;
    }

    // ---------- Expressions ----------

    private object Ev(Expr e)
    {
        switch (e)
        {
            case Expr.Num n:
                return n.V;
            case Expr.Str s:
                return s.V;
            case Expr.Re r:
                return GetRegex(r.Src, "").IsMatch(record) ? 1.0 : 0.0;
            case Expr.Var v:
                return GetVar(v.Name);
            case Expr.Field or Expr.Idx:
                return Get(e);
            case Expr.Group:
                throw new AwkFatal("invalid use of a parenthesized list");
            case Expr.Assign a:
            {
                var rhs = Ev(a.E);
                object val = rhs;
                if (a.Op != "=") val = Arith(a.Op[..^1], Num(Get(a.Target)), Num(rhs));
                Set(a.Target, val);
                return val;
            }
            case Expr.Cond c:
                return Truthy(Ev(c.C)) ? Ev(c.A) : Ev(c.B);
            case Expr.Logic { K: "and" } l:
                return Truthy(Ev(l.A)) && Truthy(Ev(l.B)) ? 1.0 : 0.0;
            case Expr.Logic l:
                return Truthy(Ev(l.A)) || Truthy(Ev(l.B)) ? 1.0 : 0.0;
            case Expr.Unary { K: "not" } u:
                return Truthy(Ev(u.E)) ? 0.0 : 1.0;
            case Expr.Unary { K: "neg" } u:
                return -Num(Ev(u.E));
            case Expr.Unary u:
                return Num(Ev(u.E));
            case Expr.Bin b:
                return Arith(b.Op, Num(Ev(b.A)), Num(Ev(b.B)));
            case Expr.Cmp c:
            {
                var a = Ev(c.A);
                var b = Ev(c.B);
                double d;
                if (AwkCmd.IsNumeric(a) && AwkCmd.IsNumeric(b)) d = Num(a) - Num(b);
                else
                {
                    int cmp = string.CompareOrdinal(Str(a), Str(b));
                    d = cmp < 0 ? -1 : cmp > 0 ? 1 : 0;
                }
                bool res = c.Op switch
                {
                    "<" => d < 0,
                    "<=" => d <= 0,
                    ">" => d > 0,
                    ">=" => d >= 0,
                    "==" => d == 0,
                    _ => d != 0,
                };
                return res ? 1.0 : 0.0;
            }
            case Expr.Match m:
            {
                bool ok = RegexOf(m.Re).IsMatch(Str(Ev(m.A)));
                return ok != m.Neg ? 1.0 : 0.0;
            }
            case Expr.Concat cc:
                return Str(Ev(cc.A)) + Str(Ev(cc.B));
            case Expr.Incr inc:
            {
                double old = Num(Get(inc.Target));
                double v = inc.Op == "++" ? old + 1 : old - 1;
                Set(inc.Target, v);
                return inc.Prefix ? v : old;
            }
            case Expr.In i:
            {
                var a = GetArray(i.Arr);
                return a.ContainsKey(Key(i.Subs)) ? 1.0 : 0.0;
            }
            case Expr.Call call:
                return Call(call.Name, call.Args);
        }
        throw new AwkFatal("invalid expression");
    }

    private static double Arith(string op, double a, double b)
    {
        switch (op)
        {
            case "+":
                return a + b;
            case "-":
                return a - b;
            case "*":
                return a * b;
            case "/":
                if (b == 0) throw new AwkFatal("division by zero attempted");
                return a / b;
            case "%":
                if (b == 0) throw new AwkFatal("division by zero attempted in `%'");
                return a % b;
            default:
                // a ** b (JS differs from Math.Pow for NaN exponents and ±1 ** ±Infinity).
                if (double.IsNaN(b)) return double.NaN;
                if (Math.Abs(a) == 1 && double.IsInfinity(b)) return double.NaN;
                return Math.Pow(a, b);
        }
    }

    private object Call(string name, List<Expr> args)
    {
        object Arg(int i) => Ev(args[i]);
        void Need(int min, int? max = null)
        {
            if (args.Count < min || args.Count > (max ?? min)) throw new AwkFatal($"{name}: called with {args.Count} arguments");
        }
        switch (name)
        {
            case "length":
            {
                Need(0, 1);
                if (args.Count == 0) return (double)record.Length;
                if (args[0] is Expr.Var a0 && arrays.TryGetValue(a0.Name, out var arr)) return (double)arr.Count;
                return (double)Str(Arg(0)).Length;
            }
            case "substr":
            {
                Need(2, 3);
                var s = Str(Arg(0));
                double m = AwkCmd.JsRound(Num(Arg(1)));
                double end = args.Count == 3 ? m + AwkCmd.JsRound(Num(Arg(2))) : double.PositiveInfinity;
                double from = double.IsNaN(m) ? double.NaN : Math.Max(m, 1);
                double to = double.IsNaN(end) ? double.NaN : Math.Min(end, s.Length + 1);
                return to > from ? s.Substring((int)from - 1, (int)to - (int)from) : "";
            }
            case "index":
                Need(2);
                return (double)(Str(Arg(0)).IndexOf(Str(Arg(1)), StringComparison.Ordinal) + 1);
            case "split":
            {
                Need(2, 3);
                var target = args[1];
                if (target is not Expr.Var tv) throw new AwkFatal("split: second argument is not an array");
                var s = Str(Arg(0));
                List<string> parts = args.Count == 3
                    ? args[2] is Expr.Re re
                        ? s == "" ? new List<string>() : RegexCmd.JsSplit(s, GetRegex(re.Src, ""))
                        : SplitFs(s, Str(Arg(2)))
                    : SplitFs(s, Str(vars["FS"]));
                var a = GetArray(tv.Name);
                a.Clear();
                for (int i = 0; i < parts.Count; i++) a[Js.Num(i + 1)] = new AwkCmd.StrNum(parts[i]);
                return (double)parts.Count;
            }
            case "sub":
            case "gsub":
            {
                Need(2, 3);
                Expr target = args.Count > 2 ? args[2] : new Expr.Field(new Expr.Num(0));
                if (!AwkCmd.IsLvalue(target)) throw new AwkFatal($"{name}: third argument is not a changeable object");
                var re = RegexOf(args[0], "g");
                var repl = Str(Arg(1));
                var s = Str(Get(target));
                int count = 0;
                var result = re.Replace(s, m =>
                {
                    if (name == "sub" && count > 0) return m.Value;
                    count++;
                    var o = new StringBuilder();
                    for (int i = 0; i < repl.Length; i++)
                    {
                        if (repl[i] == '\\' && i + 1 < repl.Length && (repl[i + 1] == '\\' || repl[i + 1] == '&'))
                        {
                            o.Append(repl[i + 1] == '&' ? '&' : '\\');
                            i++;
                        }
                        else if (repl[i] == '&') o.Append(m.Value);
                        else o.Append(repl[i]);
                    }
                    return o.ToString();
                });
                if (count > 0) Set(target, result);
                return (double)count;
            }
            case "match":
            {
                Need(2);
                var m = RegexOf(args[1]).Match(Str(Arg(0)));
                double start = m.Success ? m.Index + 1 : 0;
                vars["RSTART"] = start;
                vars["RLENGTH"] = m.Success ? (double)m.Length : -1.0;
                return start;
            }
            case "sprintf":
            {
                if (args.Count == 0) throw new AwkFatal("sprintf: no arguments");
                var vals = args.Select(Ev).ToList();
                return AwkCmd.AwkSprintf(Str(vals[0]), vals.Skip(1).ToList());
            }
            case "toupper":
            {
                Need(1);
                var s = Str(Arg(0));
                return io.AsciiCase ? new string(s.Select(c => c is >= 'a' and <= 'z' ? (char)(c - 32) : c).ToArray()) : AwkCmd.JsUpper(s);
            }
            case "tolower":
            {
                Need(1);
                var s = Str(Arg(0));
                return io.AsciiCase ? new string(s.Select(c => c is >= 'A' and <= 'Z' ? (char)(c + 32) : c).ToArray()) : AwkCmd.JsLower(s);
            }
            case "int":
                Need(1);
                return Math.Truncate(Num(Arg(0)));
            case "sqrt":
                Need(1);
                return Math.Sqrt(Num(Arg(0)));
            case "exp":
                Need(1);
                return Math.Exp(Num(Arg(0)));
            case "log":
                Need(1);
                return Math.Log(Num(Arg(0)));
            case "sin":
                Need(1);
                return Math.Sin(Num(Arg(0)));
            case "cos":
                Need(1);
                return Math.Cos(Num(Arg(0)));
            case "atan2":
                Need(2);
                return Math.Atan2(Num(Arg(0)), Num(Arg(1)));
            case "rand":
                return Js.Random();
            case "srand":
                return 0.0;
        }
        throw new AwkFatal($"function `{name}' not defined");
    }
}
