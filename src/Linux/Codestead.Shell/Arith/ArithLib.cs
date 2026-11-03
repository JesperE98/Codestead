namespace Codestead.Shell;

// Port of src/shell/arith.ts – integer arithmetic as in bash: $(( 1 + 2 )), (( i++ )), (( x > 3 )) etc.
// The original used JavaScript numbers (doubles, with 32-bit bitwise operators). Bash uses 64-bit
// integers, so this port uses long.

public static partial class ArithLib
{
    private abstract record ATok;
    private sealed record NumTok(long V) : ATok;
    private sealed record IdTok(string V) : ATok;
    private sealed record OpTok(string V) : ATok;

    private static readonly string[] Ops =
    {
        "**=", "<<=", ">>=", "&&", "||", "**", "++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "<=", ">=", "<<", ">>",
        "=", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", "?", ":", ",", "~", "&", "|", "^",
    };

    private static readonly Regex NumRe = new(@"^(0[xX][0-9a-fA-F]+|\d+)", RegexOptions.CultureInvariant);
    private static readonly Regex IdRe = new(@"^[A-Za-z_]\w*", RegexOptions.CultureInvariant);
    private static readonly Regex IntRe = new(@"^-?\d+\z", RegexOptions.CultureInvariant);
    private static readonly Regex NameRe = new(@"^[A-Za-z_]\w*\z", RegexOptions.CultureInvariant);

    private static List<ATok> Lex(string src)
    {
        var toks = new List<ATok>();
        int i = 0;
        while (i < src.Length)
        {
            char c = src[i];
            if (char.IsWhiteSpace(c))
            {
                i++;
                continue;
            }
            var rest = src[i..];
            var num = NumRe.Match(rest);
            if (num.Success)
            {
                var text = num.Groups[1].Value;
                long v = text.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
                    ? long.Parse(text[2..], NumberStyles.HexNumber, CultureInfo.InvariantCulture)
                    : long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : long.MaxValue;
                toks.Add(new NumTok(v));
                i += text.Length;
                continue;
            }
            var id = IdRe.Match(rest);
            if (id.Success)
            {
                toks.Add(new IdTok(id.Value));
                i += id.Value.Length;
                continue;
            }
            var op = Ops.FirstOrDefault(o => rest.StartsWith(o, StringComparison.Ordinal));
            if (op is not null)
            {
                toks.Add(new OpTok(op));
                i += op.Length;
                continue;
            }
            throw new ArithError($"syntax error: invalid arithmetic operator (error token is \"{rest}\")");
        }
        return toks;
    }

    private static readonly Dictionary<string, (int Prec, bool Left)> Binary = new()
    {
        [","] = (1, true),
        ["||"] = (4, true),
        ["&&"] = (5, true),
        ["|"] = (6, true),
        ["^"] = (7, true),
        ["&"] = (8, true),
        ["=="] = (9, true),
        ["!="] = (9, true),
        ["<"] = (10, true),
        [">"] = (10, true),
        ["<="] = (10, true),
        [">="] = (10, true),
        ["<<"] = (11, true),
        [">>"] = (11, true),
        ["+"] = (12, true),
        ["-"] = (12, true),
        ["*"] = (13, true),
        ["/"] = (13, true),
        ["%"] = (13, true),
        ["**"] = (14, false),
    };

    private static readonly HashSet<string> Assign = new() { "=", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=" };

    private static long B(bool v) => v ? 1 : 0;

    private static long Pow(long a, long b)
    {
        if (b < 0) throw new ArithError("exponent less than 0 (error token is \"" + b + "\")");
        long result = 1;
        for (long k = 0; k < b; k++) result = unchecked(result * a);
        return result;
    }

    private static long ApplyBinary(string op, long a, long b)
    {
        switch (op)
        {
            case "+": return unchecked(a + b);
            case "-": return unchecked(a - b);
            case "*": return unchecked(a * b);
            case "/":
            case "%":
                if (b == 0) throw new ArithError("division by 0 (error token is \"0\")");
                return op == "/" ? a / b : a % b;
            case "**": return Pow(a, b);
            case "<<": return a << (int)b;
            case ">>": return a >> (int)b;
            case "<": return B(a < b);
            case ">": return B(a > b);
            case "<=": return B(a <= b);
            case ">=": return B(a >= b);
            case "==": return B(a == b);
            case "!=": return B(a != b);
            case "&": return a & b;
            case "|": return a | b;
            case "^": return a ^ b;
            case "&&": return B(a != 0 && b != 0);
            case "||": return B(a != 0 || b != 0);
            case ",": return b;
        }
        throw new ArithError($"unknown operator {op}");
    }

    public static long EvalArith(string src, ArithVars vars)
    {
        var toks = Lex(src);
        int i = 0;
        ATok? Peek() => i < toks.Count ? toks[i] : null;
        bool IsOp(string v) => i < toks.Count && toks[i] is OpTok o && o.V == v;

        long VarValue(string name)
        {
            var raw = (vars.Get(name) ?? "").Trim();
            if (raw == "") return 0;
            if (IntRe.IsMatch(raw)) return long.TryParse(raw, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var n) ? n : 0;
            if (NameRe.IsMatch(raw)) return VarValue(raw);
            return EvalArith(raw, vars);
        }

        long ParseExpr(int minPrec)
        {
            // Assignment: name = expression
            var t = Peek();
            if (t is IdTok id && i + 1 < toks.Count && toks[i + 1] is OpTok aop && Assign.Contains(aop.V))
            {
                i += 2;
                var right = ParseExpr(2);
                var value = aop.V == "=" ? right : ApplyBinary(aop.V[..^1], VarValue(id.V), right);
                vars.Set(id.V, value.ToString(CultureInfo.InvariantCulture));
                return value;
            }
            var left = ParseUnary();
            for (; ; )
            {
                if (Peek() is not OpTok op) break;
                if (op.V == "?" && minPrec <= 3)
                {
                    i++;
                    var a = ParseExpr(1);
                    if (!IsOp(":")) throw new ArithError("`:' expected for conditional expression");
                    i++;
                    var b = ParseExpr(3);
                    left = left != 0 ? a : b;
                    continue;
                }
                if (!Binary.TryGetValue(op.V, out var info) || info.Prec < minPrec) break;
                i++;
                var rhs = ParseExpr(info.Left ? info.Prec + 1 : info.Prec);
                left = ApplyBinary(op.V, left, rhs);
            }
            return left;
        }

        long ParseUnary()
        {
            var t = Peek();
            if (t is null) throw new ArithError("syntax error: operand expected");
            if (t is OpTok op)
            {
                if (op.V == "(")
                {
                    i++;
                    var v = ParseExpr(1);
                    if (!IsOp(")")) throw new ArithError("missing `)'");
                    i++;
                    return v;
                }
                if (op.V == "++" || op.V == "--")
                {
                    i++;
                    if (Peek() is not IdTok id) throw new ArithError("syntax error: operand expected");
                    i++;
                    var v = VarValue(id.V) + (op.V == "++" ? 1 : -1);
                    vars.Set(id.V, v.ToString(CultureInfo.InvariantCulture));
                    return v;
                }
                i++;
                var u = ParseUnary();
                return op.V switch
                {
                    "-" => -u,
                    "+" => u,
                    "!" => B(u == 0),
                    "~" => ~u,
                    _ => throw new ArithError($"syntax error: operand expected (error token is \"{op.V}\")"),
                };
            }
            i++;
            if (t is NumTok num) return num.V;
            var name = ((IdTok)t).V;
            // Variable, possibly followed by ++/--
            var value = VarValue(name);
            if (IsOp("++") || IsOp("--"))
            {
                vars.Set(name, (value + (IsOp("++") ? 1 : -1)).ToString(CultureInfo.InvariantCulture));
                i++;
            }
            return value;
        }

        if (toks.Count == 0) return 0;
        var result = ParseExpr(1);
        if (i < toks.Count)
        {
            var t = toks[i];
            var text = t switch { NumTok n => n.V.ToString(CultureInfo.InvariantCulture), IdTok d => d.V, OpTok o => o.V, _ => "" };
            throw new ArithError($"syntax error in expression (error token is \"{text}\")");
        }
        return result;
    }
}
