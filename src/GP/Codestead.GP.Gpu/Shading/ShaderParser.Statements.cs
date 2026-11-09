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
            list.AddRange(Statement());
        }
        return list;
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
            return PeekAt(j).Kind == ShaderTokenKind.Identifier;
        }
        return PeekAt(i + 1).Kind == ShaderTokenKind.Identifier;
    }

    /// <summary>A declaration, an assignment or an expression – without the ';'.</summary>
    private List<Stmt> SimpleStatement()
    {
        int line = Peek.Line;
        if (LooksLikeDeclaration())
        {
            while (Peek.Kind == ShaderTokenKind.Identifier && Qualifiers.Contains(Peek.Text)) Next();
            var type = TypeName();
            var list = new List<Stmt>();
            do
            {
                var id = Identifier();
                int size = ArraySuffix();
                Expr? value = null;
                if (Accept("=")) value = Initializer();
                else if (Peek.Is("{")) value = Initializer(); // C++: Type name{ … }
                else if (Peek.Is("(") && !type.StartsWith("vec", StringComparison.Ordinal)) value = new Call(type, CallArgs(), line); // C++: Type name(args)
                list.Add(new Declare(type, id, value, line, size != 0));
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
