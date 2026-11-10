using System.Globalization;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// Expressions, by precedence: ?:, ||, &&, == !=, < > <= >=, + -, * / %, unary, postfix (calls, members, indexing).
public sealed partial class ShaderParser
{
    private Expr Expression()
    {
        var cond = Binary(0);
        if (!Accept("?")) return cond;
        var then = Expression();
        Expect(":");
        return new Conditional(cond, then, Expression(), cond.Line);
    }

    private static readonly string[][] Levels =
    {
        new[] { "||" },
        new[] { "&&" },
        new[] { "|" },
        new[] { "^" },
        new[] { "&" },
        new[] { "==", "!=" },
        new[] { "<", ">", "<=", ">=" },
        // << and >> (two tokens each: ">>" also closes templates), handled in Binary.
        new[] { "<<", ">>" },
        new[] { "+", "-" },
        new[] { "*", "/", "%" },
    };

    private Expr Binary(int level)
    {
        if (level == Levels.Length) return UnaryExpr();
        var left = Binary(level + 1);
        if (Levels[level][0] == "<<")
        {
            while (Peek.Kind == ShaderTokenKind.Symbol && Peek.Text is "<" or ">" && PeekAt(1).Kind == ShaderTokenKind.Symbol && PeekAt(1).Text == Peek.Text)
            {
                var first = Next();
                Next();
                left = new ShaderAst.Binary(first.Text + first.Text, left, Binary(level + 1), first.Line);
            }
            return left;
        }
        // a < b, but not the first half of a shift.
        while (Peek.Kind == ShaderTokenKind.Symbol && Levels[level].Contains(Peek.Text)
            && !(Peek.Text is "<" or ">" && PeekAt(1).Kind == ShaderTokenKind.Symbol && PeekAt(1).Text == Peek.Text))
        {
            var op = Next();
            left = new ShaderAst.Binary(op.Text, left, Binary(level + 1), op.Line);
        }
        return left;
    }

    private Expr UnaryExpr()
    {
        int line = Peek.Line;
        if (Peek.Kind == ShaderTokenKind.Symbol && Peek.Text is "-" or "+" or "!" or "~" or "++" or "--" or "&" or "*")
        {
            var op = Next().Text;
            var operand = UnaryExpr();
            // &x and *p (C++): the value itself is what matters to the simulator.
            // C++: &a[0] points at the whole array (memcpy(data, &a[0], …) copies all of it); other &x / *p are x / p.
            if (op == "&" && operand is IndexOf { At: Number { Value: 0 } } first) return first.Target;
            return op is "+" or "&" or "*" ? operand : new Unary(op, operand, line);
        }
        // C-style casts: (float)x, (void*)0, (GLfloat)x – and HLSL's (float3x3)m, (float3)v, which convert.
        if (Peek.Is("(") && PeekAt(1).Kind == ShaderTokenKind.Identifier && (PeekAt(2).Is(")") || (PeekAt(2).Is("*") && PeekAt(3).Is(")")))
            && (IsCastType(PeekAt(1).Text) || ShaderRunner.MatrixSize(PeekAt(1).Text) > 0 || ShaderRunner.ComponentCount(PeekAt(1).Text) > 1))
        {
            Next();
            var type = Next().Text;
            Accept("*");
            Expect(")");
            var operand = UnaryExpr();
            if (ScalarCast(type) is { } scalar) return new Call(scalar, [operand], line);
            return ShaderRunner.MatrixSize(type) > 0 || ShaderRunner.ComponentCount(type) > 1 ? new Call(type, [operand], line) : operand;
        }
        return Postfix(Primary());
    }

    private static bool IsCastType(string t) => t is "float" or "double" or "int" or "uint" or "unsigned" or "void" or "GLfloat" or "GLint" or "GLuint" or "GLsizei" or "uint32_t" or "int32_t" or "size_t" or "UINT" or "FLOAT" or "half" or "char";

    /// <summary>The conversion a cast to a number type makes: (float)i is float(i), (int)x is int(x), which cuts the fraction off.</summary>
    private static string? ScalarCast(string type) => type is "float" or "double" or "GLfloat" or "FLOAT" or "half" ? "float"
        : ShaderValue.IsIntType(type) ? "int" : null;

    private Expr Postfix(Expr e)
    {
        while (true)
        {
            int line = Peek.Line;
            if (Accept("."))
            {
                var field = Identifier();
                if (Peek.Is("(")) e = new Call("." + field, new List<Expr> { e }.Concat(CallArgs()).ToList(), line);
                else e = new Member(e, field, line);
            }
            else if (Accept("->"))
            {
                var field = Identifier();
                if (Peek.Is("(")) e = new Call("." + field, new List<Expr> { e }.Concat(CallArgs()).ToList(), line);
                else e = new Member(e, field, line);
            }
            else if (Accept("["))
            {
                var at = Expression();
                Expect("]");
                e = new IndexOf(e, at, line);
            }
            else if (Peek.Is("++") || Peek.Is("--"))
            {
                var op = Next().Text;
                e = new Unary("post" + op, e, line);
            }
            else return e;
        }
    }

    private List<Expr> CallArgs()
    {
        Expect("(");
        var args = new List<Expr>();
        if (Accept(")")) return args;
        do args.Add(Initializer());
        while (Accept(","));
        Expect(")");
        return args;
    }

    private Expr Primary()
    {
        var t = Peek;
        switch (t.Kind)
        {
            case ShaderTokenKind.Number:
                Next();
                return new Number(double.Parse(t.Text, CultureInfo.InvariantCulture), t.Line, t.Text.All(char.IsDigit));
            case ShaderTokenKind.String:
                Next();
                // Adjacent string literals are joined, as in C++.
                var text = t.Text;
                while (Peek.Kind == ShaderTokenKind.String) text += Next().Text;
                return new Call("string", [new Name(text, t.Line)], t.Line);
            case ShaderTokenKind.Identifier:
            {
                Next();
                // static_cast<float>(x) and friends.
                if (t.Text is "static_cast" or "reinterpret_cast" or "const_cast" && Peek.Is("<"))
                {
                    var castType = new List<string>();
                    Expect("<");
                    while (!Accept(">")) castType.Add(Next().Text);
                    Expect("(");
                    var inner = Expression();
                    Expect(")");
                    castType.RemoveAll(w => w is "const" or "unsigned" or "signed");
                    var to = castType.Count == 0 ? "int" : castType.Count == 1 ? castType[0] : "";
                    return t.Text == "static_cast" && ScalarCast(to) is { } scalar ? new Call(scalar, [inner], t.Line) : inner;
                }
                if (t.Text is "true" or "false") return new Number(t.Text == "true" ? 1 : 0, t.Line);
                // C++: new glm::mat4[amount] – an array of zeroed values.
                if (lenient && t.Text == "new" && Peek.Kind == ShaderTokenKind.Identifier)
                {
                    var type = TypeName();
                    if (Accept("["))
                    {
                        var count = Expression();
                        Expect("]");
                        return new Call("__newarray", [new Name(type, t.Line), count], t.Line);
                    }
                    return Peek.Is("(") ? new Call(type, CallArgs(), t.Line) : new Call(type, [], t.Line);
                }
                // vec2[](…) – an array constructor; float3x3(…) and friends are plain calls.
                if (Peek.Is("[") && PeekAt(1).Is("]") && PeekAt(2).Is("("))
                {
                    Next();
                    Next();
                    return new Call(t.Text, CallArgs(), t.Line, ArrayConstructor: true);
                }
                if (Peek.Is("(")) return new Call(t.Text, CallArgs(), t.Line);
                // C++ brace construction: glm::vec4{1, 0, 0, 1}, XMFLOAT4{…}
                if (Peek.Is("{") && char.IsLetter(t.Text[0]) && LooksLikeType(t.Text))
                {
                    var init = (InitList)Initializer();
                    return new Call(t.Text, init.Items, t.Line);
                }
                names.Add(t.Text);
                return new Name(t.Text, t.Line);
            }
            case ShaderTokenKind.Symbol when t.Is("("):
            {
                Next();
                var e = Expression();
                Expect(")");
                return e;
            }
            case ShaderTokenKind.Symbol when t.Is("{"):
                return Initializer();
            default:
                throw new ShaderSyntaxException(t.Kind == ShaderTokenKind.End ? "expected an expression at end of input" : $"expected an expression before '{t.Text}'", t.Line);
        }
    }

    private static bool LooksLikeType(string id) =>
        id.StartsWith("vec", StringComparison.Ordinal) || id.StartsWith("XMFLOAT", StringComparison.Ordinal) || id.StartsWith("float", StringComparison.Ordinal) || char.IsUpper(id[0]);
}
