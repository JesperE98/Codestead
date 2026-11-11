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
        // (unsigned char)y, (unsigned int)x: the second word is the type.
        if (Peek.Is("(") && PeekAt(1).Is("unsigned") && PeekAt(2).Kind == ShaderTokenKind.Identifier && (PeekAt(3).Is(")") || PeekAt(3).Is("*") && PeekAt(4).Is(")")))
        {
            Next();
            Next();
            var word = Next().Text;
            bool pointer = Accept("*");
            Expect(")");
            var operand = UnaryExpr();
            if (pointer) return operand;
            return new Call("int", [operand], line);
        }
        // C-style casts: (float)x, (void*)0, (GLfloat)x – and HLSL's (float3x3)m, (float3)v, which convert.
        if (Peek.Is("(") && PeekAt(1).Kind == ShaderTokenKind.Identifier && (PeekAt(2).Is(")") || (PeekAt(2).Is("*") && PeekAt(3).Is(")")))
            && (IsCastType(PeekAt(1).Text) || ShaderRunner.MatrixSize(PeekAt(1).Text) > 0 || ShaderRunner.ComponentCount(PeekAt(1).Text) > 1))
        {
            Next();
            var type = Next().Text;
            bool pointer = Accept("*");
            Expect(")");
            var operand = UnaryExpr();
            // A pointer cast ((char*) mapped + offset, (void*)0): the address itself.
            if (pointer) return operand;
            // (uint64_t) handle: a 64-bit integer that holds an object handle (vkSetDebugUtilsObjectNameEXT's
            // objectHandle) – the value itself, so a handle stays the handle.
            if (type is "uint64_t" or "int64_t" or "uintptr_t" or "intptr_t" or "UINT64" or "UINT_PTR") return operand;
            if (ScalarCast(type) is { } scalar) return new Call(scalar, [operand], line);
            return ShaderRunner.MatrixSize(type) > 0 || ShaderRunner.ComponentCount(type) > 1 ? new Call(type, [operand], line) : operand;
        }
        // C++: a cast to a type of the program ((Direction)best_match, (GameState)1): the value itself. "(name)" then a
        // name or a number cannot be anything else.
        if (lenient && Peek.Is("(") && PeekAt(1).Kind == ShaderTokenKind.Identifier && PeekAt(2).Is(")")
            && (PeekAt(3).Kind is ShaderTokenKind.Identifier or ShaderTokenKind.Number || PeekAt(3).Is("(") && char.IsUpper(PeekAt(1).Text[0])))
        {
            Next();
            Next();
            Next();
            return UnaryExpr();
        }
        return Postfix(Primary());
    }

    private static bool IsCastType(string t) => t is "float" or "double" or "int" or "uint" or "unsigned" or "void" or "GLfloat" or "GLint" or "GLuint" or "GLsizei" or "uint32_t" or "int32_t" or "size_t" or "UINT" or "FLOAT" or "half" or "char"
        or "uint64_t" or "int64_t" or "uintptr_t" or "intptr_t" or "UINT64" or "UINT_PTR" or "uint16_t" or "uint8_t";

    /// <summary>The conversion a cast to a number type makes: (float)i is float(i), (int)x is int(x), which cuts the fraction off.</summary>
    private static string? ScalarCast(string type) => type is "float" or "double" or "GLfloat" or "FLOAT" or "half" ? "float"
        : ShaderValue.IsIntType(type) ? "int" : null;

    /// <summary>std::numeric_limits&lt;type&gt;::max(), lowest(), min(), epsilon(), infinity() as a number.</summary>
    private static Number NumericLimit(string type, string which, int line)
    {
        bool isFloat = type is "float" or "GLfloat", isDouble = type is "double" or "long double";
        if (isFloat || isDouble)
        {
            double max = isFloat ? float.MaxValue : double.MaxValue;
            return new Number(which switch
            {
                "max" => max,
                "lowest" => -max,
                "min" => isFloat ? 1.17549435e-38 : 2.2250738585072014e-308,
                "epsilon" => isFloat ? 1.1920929e-07 : 2.220446049250313e-16,
                "infinity" => double.PositiveInfinity,
                "quiet_NaN" or "signaling_NaN" => double.NaN,
                _ => 0,
            }, line);
        }
        var (lo, hi) = type switch
        {
            "unsigned int" or "unsigned" or "uint32_t" or "GLuint" or "UINT" => (0.0, uint.MaxValue),
            "unsigned short" or "uint16_t" => (0.0, ushort.MaxValue),
            "unsigned char" or "uint8_t" => (0.0, byte.MaxValue),
            "short" or "int16_t" => (short.MinValue, short.MaxValue),
            "char" or "int8_t" => (sbyte.MinValue, sbyte.MaxValue),
            "long long" or "int64_t" => (long.MinValue, (double)long.MaxValue),
            "size_t" or "uint64_t" or "unsigned long long" => (0.0, (double)ulong.MaxValue),
            _ => (int.MinValue, int.MaxValue),
        };
        return new Number(which is "max" ? hi : which is "min" or "lowest" ? lo : 0, line, Integer: true);
    }

    /// <summary>&lt;types&gt;( ahead: a template's arguments (names, ::, commas, * and &amp;), then a call.</summary>
    private bool TemplateCallAhead()
    {
        int depth = 0;
        for (int i = 0; i < 24; i++)
        {
            var t = PeekAt(i);
            if (t.Is("<")) depth++;
            else if (t.Is(">"))
            {
                if (--depth == 0) return PeekAt(i + 1).Is("(");
            }
            else if (!(t.Kind == ShaderTokenKind.Identifier || t.Is("::") || t.Is(",") || t.Is("*") || t.Is("&") || t.Kind == ShaderTokenKind.Number)) return false;
        }
        return false;
    }

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
                return new Call(StringLiteral, [new Name(text, t.Line)], t.Line);
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
                // sizeof(unsigned int), sizeof(unsigned char): a type of two words.
                if (t.Text == "sizeof" && Peek.Is("(") && (PeekAt(1).Is("unsigned") || PeekAt(1).Is("signed")))
                {
                    Next();
                    Next();
                    var word = Peek.Kind == ShaderTokenKind.Identifier && !Peek.Is(")") ? Next().Text : "int";
                    Expect(")");
                    return new Call("sizeof", [new Name(word is "char" ? "uint8_t" : word is "short" ? "uint16_t" : word is "long" ? "uint32_t" : "unsigned", t.Line)], t.Line);
                }
                // C++: std::numeric_limits<float>::max() and friends – the limits of a number type.
                if (lenient && t.Text == "numeric_limits" && Peek.Is("<"))
                {
                    Expect("<");
                    var limitType = new List<string>();
                    while (!Accept(">")) limitType.Add(Next().Text);
                    Expect("::");
                    var which = Identifier();
                    if (Accept("(")) Expect(")");
                    return NumericLimit(string.Join(" ", limitType), which, t.Line);
                }
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
                // C++: a template's arguments before a call – std::pair<char, Character>(c, ch), std::make_pair<…>(…).
                if (lenient && Peek.Is("<") && TemplateCallAhead())
                {
                    int depth = 0;
                    var inside = new List<ShaderToken>();
                    do
                    {
                        if (Peek.Is("<")) depth++;
                        else if (Peek.Is(">")) depth--;
                        var token = Next();
                        if (depth > 0 && !(depth == 1 && token.Is("<"))) inside.Add(token);
                    } while (depth > 0);
                    // std::get<1>(collision): the element of a tuple (or pair) by its index.
                    if (t.Text == "get" && inside is [{ Kind: ShaderTokenKind.Number } index] && Peek.Is("("))
                        return new Call(TupleGet, [new Number(double.Parse(index.Text, System.Globalization.CultureInfo.InvariantCulture), t.Line), .. CallArgs()], t.Line);
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
                // C++: an assignment as a value – while ((errorCode = glGetError()) != GL_NO_ERROR).
                if (lenient && Peek.Is("="))
                {
                    Next();
                    e = new Call("__assign", [e, Expression()], t.Line);
                }
                Expect(")");
                return e;
            }
            case ShaderTokenKind.Symbol when t.Is("{"):
                return Initializer();
            case ShaderTokenKind.Symbol when lenient && t.Is("["):
                return LambdaExpr();
            default:
                throw new ShaderSyntaxException(t.Kind == ShaderTokenKind.End ? "expected an expression at end of input" : $"expected an expression before '{t.Text}'", t.Line);
        }
    }

    /// <summary>C++: [captures](Type a, Type b) -> R { body } – captures and types are not needed here.</summary>
    private Expr LambdaExpr()
    {
        int line = Next().Line;
        for (int depth = 1; depth > 0 && Peek.Kind != ShaderTokenKind.End;)
        {
            var c = Next();
            if (c.Is("[")) depth++;
            else if (c.Is("]")) depth--;
        }
        var parameters = new List<string>();
        if (Accept("("))
        {
            string? last = null;
            for (int depth = 1; Peek.Kind != ShaderTokenKind.End;)
            {
                var p = Next();
                if (p.Is("(")) depth++;
                else if (p.Is(")") && --depth == 0) break;
                if (depth == 1 && p.Is(","))
                {
                    if (last is not null) parameters.Add(last);
                    last = null;
                }
                else if (p.Kind == ShaderTokenKind.Identifier) last = p.Text;
            }
            if (last is not null && last != "void") parameters.Add(last);
        }
        while (!Peek.Is("{") && Peek.Kind != ShaderTokenKind.End) Next(); // mutable, -> R
        return new Lambda(parameters, Block(), line);
    }

    private static bool LooksLikeType(string id) =>
        id.StartsWith("vec", StringComparison.Ordinal) || id.StartsWith("XMFLOAT", StringComparison.Ordinal) || id.StartsWith("float", StringComparison.Ordinal) || char.IsUpper(id[0]);
}
