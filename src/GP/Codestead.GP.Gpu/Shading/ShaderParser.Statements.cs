using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// Statements: blocks, declarations, assignments, if, for, return.
public sealed partial class ShaderParser
{
    private List<Stmt> Block()
    {
        Expect("{");
        var list = new List<Stmt>();
        while (!Accept("}"))
        {
            if (Peek.Kind == ShaderTokenKind.End) throw new ShaderSyntaxException("expected '}' at end of input", Peek.Line);
            list.AddRange(lenient ? StatementOrSkip() : Statement());
        }
        return list;
    }

    /// <summary>A statement, or – in C++ mode, when it does not parse – nothing, after skipping to its end.</summary>
    private List<Stmt> StatementOrSkip()
    {
        int start = pos;
        try
        {
            return Statement();
        }
        catch (ShaderSyntaxException)
        {
            pos = start;
            int depth = 0;
            while (Peek.Kind != ShaderTokenKind.End)
            {
                var t = Next();
                if (t.Is("(") || t.Is("{") || t.Is("[")) depth++;
                else if (t.Is(")") || t.Is("]")) depth--;
                else if (t.Is("}"))
                {
                    if (--depth <= 0) break;
                }
                else if (t.Is(";") && depth <= 0) break;
                if (depth < 0)
                {
                    pos--;
                    break;
                }
            }
            return [];
        }
    }

    private List<Stmt> BodyOrStatement() => Peek.Is("{") ? Block() : Statement();

    private List<Stmt> Statement()
    {
        int line = Peek.Line;
        if (Accept(";")) return [];
        if (Peek.Is("{")) return Block();
        if (Peek.Is("[")) // [unroll], [branch]
        {
            SkipBalanced("[", "]");
            return Statement();
        }
        if (Accept("return"))
        {
            Expr? value = Peek.Is(";") ? null : Expression();
            Expect(";");
            return [new Return(value, line)];
        }
        if (Accept("discard") || Accept("clip_discard"))
        {
            Expect(";");
            return [new Discard(line)];
        }
        if (Accept("if"))
        {
            Expect("(");
            var cond = Expression();
            Expect(")");
            var then = BodyOrStatement();
            List<Stmt>? otherwise = Accept("else") ? BodyOrStatement() : null;
            return [new If(cond, then, otherwise, line)];
        }
        if (lenient && Peek.Is("for") && RangeFor() is { } rangeFor) return [rangeFor];
        if (Accept("for"))
        {
            Expect("(");
            Stmt? init = null;
            if (!Accept(";"))
            {
                init = SimpleStatement().FirstOrDefault();
                Expect(";");
            }
            Expr? cond = Peek.Is(";") ? null : Expression();
            Expect(";");
            Stmt? step = Peek.Is(")") ? null : SimpleStatement().FirstOrDefault();
            Expect(")");
            return [new For(init, cond, step, BodyOrStatement(), line)];
        }
        var list = SimpleStatement();
        Expect(";");
        return list;
    }

    /// <summary>C++ range-based for: for (const Vertex&amp; vertex : vertices) …; null (and nothing read) when it is not one.</summary>
    private Stmt? RangeFor()
    {
        int start = pos, line = Peek.Line;
        Next();
        if (!Accept("(")) { pos = start; return null; }
        // Find a ':' at depth 0 before the closing ')'.
        int depth = 0, j = pos, colon = -1;
        while (PeekAt(j - pos).Kind != ShaderTokenKind.End)
        {
            var t = PeekAt(j - pos);
            if (t.Is("(")) depth++;
            else if (t.Is(")")) { if (depth == 0) break; depth--; }
            else if (t.Is(";")) break;
            else if (t.Is(":") && depth == 0) { colon = j; break; }
            j++;
        }
        if (colon < 0) { pos = start; return null; }
        // The loop variable: the last identifier before ':'.
        string? id = null;
        while (pos < colon)
        {
            var t = Next();
            if (t.Kind == ShaderTokenKind.Identifier) id = t.Text;
        }
        Expect(":");
        var container = Expression();
        Expect(")");
        var body = BodyOrStatement();
        return id is null ? null : new ForEach(id, container, body, line);
    }

    private bool LooksLikeDeclaration()
    {
        int i = 0;
        while (PeekAt(i).Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(PeekAt(i).Text)) i++;
        if (PeekAt(i).Kind != ShaderTokenKind.Identifier) return false;
        // type<...> name
        if (PeekAt(i + 1).Is("<"))
        {
            int depth = 0, j = i + 1;
            do
            {
                if (PeekAt(j).Is("<")) depth++;
                else if (PeekAt(j).Is(">")) depth--;
                j++;
            } while (depth > 0 && PeekAt(j).Kind != ShaderTokenKind.End);
            while (PeekAt(j).Is("::") && PeekAt(j + 1).Kind == ShaderTokenKind.Identifier) j += 2;
            return PeekAt(j).Kind == ShaderTokenKind.Identifier || lenient && PointerDeclarator(j);
        }
        int k = i + 1;
        while (PeekAt(k).Is("::") && PeekAt(k + 1).Kind == ShaderTokenKind.Identifier) k += 2;
        return PeekAt(k).Kind == ShaderTokenKind.Identifier || lenient && PointerDeclarator(k);
    }

    /// <summary>C++: "* name =", "** name;", "&amp; name =" after a type – a pointer or reference declaration.</summary>
    private bool PointerDeclarator(int j)
    {
        int stars = 0;
        while (PeekAt(j).Is("*") || PeekAt(j).Is("&") || PeekAt(j).Is("**"))
        {
            j++;
            stars++;
        }
        if (stars == 0 || PeekAt(j).Kind != ShaderTokenKind.Identifier) return false;
        var after = PeekAt(j + 1);
        return after.Is("=") || after.Is(";") || after.Is(",") || after.Is("[");
    }

    /// <summary>A declaration, an assignment or an expression – without the ';'.</summary>
    private List<Stmt> SimpleStatement()
    {
        int line = Peek.Line;
        if (LooksLikeDeclaration())
        {
            while (Peek.Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(Peek.Text)) Next();
            var type = TypeName();
            // std::array<T, N>: an array of N T.
            Expr? sizeExpr = null;
            if (lenient && type == "array" && templateArgs.Count == 2 && templateArgs[0].Count >= 1)
            {
                type = templateArgs[0][^1].Text;
                var sizeTokens = templateArgs[1];
                sizeExpr = sizeTokens.Count == 1 && sizeTokens[0].Kind == ShaderTokenKind.Number
                    ? new Number(double.Parse(sizeTokens[0].Text, System.Globalization.CultureInfo.InvariantCulture), line)
                    : sizeTokens.Count == 1 ? new Name(sizeTokens[0].Text, line) : null;
            }
            // std::vector<T> name = { … }: an array of T (its elements filled like a C++ aggregate).
            bool vectorOf = false;
            if (lenient && type == "vector" && templateArgs.Count == 1 && templateArgs[0].Count >= 1)
            {
                type = templateArgs[0][^1].Text;
                vectorOf = true;
            }
            var list = new List<Stmt>();
            do
            {
                while (lenient && (Peek.Is("*") || Peek.Is("&") || Peek.Is("**"))) Next();
                var id = Identifier();
                int size = ArraySuffix();
                Expr? value = null;
                if (Accept("=")) value = Initializer();
                else if (Peek.Is("{")) value = Initializer(); // C++: Type name{ … }
                else if (Peek.Is("(")) value = new Call(type, CallArgs(), line); // C++: Type name(args)
                // An empty std::vector<T>: an array with no elements yet (push_back adds them).
                var declSize = sizeExpr ?? (vectorOf && value is null ? new Number(0, line) : null);
                list.Add(new Declare(type, id, value, line, size != 0 || declSize is not null || vectorOf && value is InitList, Math.Max(0, size), declSize));
            } while (Accept(","));
            return list;
        }
        var target = Expression();
        foreach (var op in new[] { "=", "+=", "-=", "*=", "/=" })
            if (Accept(op)) return [new Assign(target, op, Initializer(), line)];
        return [new ExprStmt(target, line)];
    }

    /// <summary>An expression or a { … } initializer list.</summary>
    private Expr Initializer()
    {
        int line = Peek.Line;
        if (!Accept("{")) return Expression();
        var items = new List<Expr>();
        while (!Accept("}"))
        {
            items.Add(Initializer());
            if (!Accept(",")) { Expect("}"); break; }
        }
        return new InitList(items, line);
    }
}
