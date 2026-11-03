namespace Codestead.Shell.Commands;

// awk: the recursive descent parser that builds the syntax tree.

public static partial class AwkCmd
{
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

        private AwkSyntaxError Unsupported(AwkUnsupported what, Tok? tok = null) =>
            new("syntax error", (tok ?? Tok).Pos, what);

        private AwkSyntaxError Unsupported(string key, params (string Name, object? Value)[] args) =>
            Unsupported(AwkUnsupported.Feature(key, args));

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
            if (Is("function", "kw") || Is("func", "kw")) throw Unsupported("awk.featureFunction");
            Expr? pattern = null;
            if (!Is("{"))
            {
                pattern = ParseExpr();
                if (Is(",")) throw Unsupported("awk.featureRangePattern");
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
                        throw Unsupported(AwkUnsupported.Keyword("getline"));
                    case "return":
                        throw Unsupported("awk.featureReturn");
                    case "nextfile":
                        throw Unsupported(AwkUnsupported.Keyword("nextfile"));
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
                    throw Unsupported("awk.featureOutputRedirect", ("statement", k), ("op", Tok.V));
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
                    if (Is("(") && Tok.Tight) throw Unsupported(AwkUnsupported.Feature("awk.featureFunctionCall", ("name", t.V)), t);
                    return new Expr.Var(t.V);
                }
                case "builtin":
                {
                    Next();
                    if (UnsupportedBuiltins.Contains(t.V)) throw Unsupported(AwkUnsupported.Feature("awk.featureBuiltin", ("name", t.V)), t);
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
                    if (t.V == "getline") throw Unsupported(AwkUnsupported.Keyword("getline"));
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
}
