namespace Codestead.Shell;

// Port of src/shell/parser.ts – parses bash code into a syntax tree (AST):
// quotes, \-escapes, pipes, redirection, ; && || &, and compound commands
// such as if/elif/else, for, while/until, case, functions, { ...; }, ( ... ) and (( ... )).
// Variables, $(...) and wildcards are expanded later by the shell.

internal sealed class Parser(List<Tok> toks)
{
    private int i;
    private static readonly string[] StopWords = { "then", "elif", "else", "fi", "do", "done", "esac", "}" };

    private Tok? Peek() => i < toks.Count ? toks[i] : null;
    private Tok? At(int idx) => idx < toks.Count ? toks[idx] : null;

    private bool IsOp(string v, Tok? t) => t is OpTok o && o.V == v;
    private bool IsOp(string v) => IsOp(v, Peek());

    private ParseError Unexpected(Tok? t)
    {
        if (t is null) return new ParseError("syntax error: unexpected end of file", true);
        var what = t switch
        {
            OpTok o => o.V == "\n" ? "newline" : o.V,
            ArithTok => "((",
            HdBodyTok => "newline",
            WordTok w => w.W.Raw,
            _ => "",
        };
        return new ParseError($"syntax error near unexpected token `{what}'");
    }

    private ParseError Unexpected() => Unexpected(Peek());

    private void SkipNewlines()
    {
        while (IsOp("\n")) i++;
    }

    private void ExpectWord(string name)
    {
        SkipNewlines();
        if (!ParserLib.IsReserved(Peek(), name)) throw Unexpected();
        i++;
    }

    private bool AtStop(string[] stops)
    {
        var t = Peek();
        if (t is null) return true;
        if (t is OpTok o) return stops.Contains(o.V);
        return ParserLib.IsReserved(t, stops);
    }

    public Node ParseProgram()
    {
        var list = ParseList(Array.Empty<string>());
        if (Peek() is not null) throw Unexpected();
        return list;
    }

    /// <summary>A sequence of commands separated by ; &amp; or newline, up to a stop word.</summary>
    public Node ParseList(string[] stops)
    {
        var items = new List<ListItem>();
        for (; ; )
        {
            SkipNewlines();
            if (AtStop(stops)) break;
            if (IsOp(";") || IsOp("&")) throw Unexpected();
            var node = ParseAndOr();
            bool background = false;
            if (IsOp("&"))
            {
                background = true;
                i++;
            }
            else if (IsOp(";") || IsOp("\n"))
            {
                i++;
            }
            else if (!AtStop(stops))
            {
                throw Unexpected();
            }
            items.Add(new ListItem { Node = node, Background = background });
        }
        return new ListNode { Items = items };
    }

    private Node ParseAndOr()
    {
        var first = ParsePipeline();
        var rest = new List<AndOrItem>();
        while (IsOp("&&") || IsOp("||"))
        {
            var op = ((OpTok)toks[i++]).V;
            SkipNewlines();
            if (Peek() is null) throw new ParseError("syntax error: unexpected end of file", true);
            rest.Add(new AndOrItem { Op = op, Node = ParsePipeline() });
        }
        return rest.Count > 0 ? new AndOrNode { First = first, Rest = rest } : first;
    }

    private Node ParsePipeline()
    {
        bool negate = false;
        if (ParserLib.IsReserved(Peek(), "!"))
        {
            negate = true;
            i++;
        }
        var commands = new List<Node> { ParseCommand() };
        while (IsOp("|"))
        {
            i++;
            SkipNewlines();
            if (Peek() is null) throw new ParseError("syntax error: unexpected end of file", true);
            commands.Add(ParseCommand());
        }
        return commands.Count == 1 && !negate ? commands[0] : new PipelineNode { Commands = commands, Negate = negate };
    }

    private List<Redirect> ParseRedirects()
    {
        var redirects = new List<Redirect>();
        for (; ; )
        {
            var t = Peek();
            if (t is not OpTok op || !ParserLib.IsRedir(op.V)) return redirects;
            i++;
            if (op.V == "2>&1" || op.V == ">&2" || op.V == "1>&2")
            {
                redirects.Add(new Redirect { Op = op.V == "2>&1" ? "2>&1" : ">&2" });
                continue;
            }
            var target = Peek();
            if (target is not WordTok tw) throw Unexpected(target);
            i++;
            if (op.V == "<<" || op.V == "<<-")
            {
                var body = Peek();
                if (body is not HdBodyTok hb) throw new ParseError("here-document has no body", true);
                i++;
                redirects.Add(new Redirect { Op = op.V, Target = tw.W, Body = hb.Body, Expand = !hb.Quoted });
                continue;
            }
            redirects.Add(new Redirect { Op = op.V, Target = tw.W });
        }
    }

    private Node ParseCommand()
    {
        var t = Peek();
        if (t is null) throw new ParseError("syntax error: unexpected end of file", true);
        if (t is ArithTok at)
        {
            i++;
            return new ArithNode { Expr = at.Expr, Redirects = ParseRedirects() };
        }
        if (t is OpTok op)
        {
            if (op.V == "(")
            {
                i++;
                var body = ParseList(new[] { ")" });
                if (!IsOp(")")) throw Unexpected();
                i++;
                return new GroupNode { Body = body, Subshell = true, Redirects = ParseRedirects() };
            }
            if (!ParserLib.IsRedir(op.V)) throw Unexpected();
        }
        if (ParserLib.IsReserved(t, "if")) return ParseIf();
        if (ParserLib.IsReserved(t, "for")) return ParseFor();
        if (ParserLib.IsReserved(t, "while", "until")) return ParseWhile();
        if (ParserLib.IsReserved(t, "case")) return ParseCase();
        if (ParserLib.IsReserved(t, "function"))
        {
            i++;
            var name = Peek();
            if (name is not WordTok nw) throw Unexpected();
            i++;
            if (IsOp("("))
            {
                i++;
                if (!IsOp(")")) throw Unexpected();
                i++;
            }
            return ParseFuncBody(nw.W.Raw);
        }
        if (ParserLib.IsReserved(t, "{"))
        {
            i++;
            var body = ParseList(new[] { "}" });
            ExpectWord("}");
            return new GroupNode { Body = body, Subshell = false, Redirects = ParseRedirects() };
        }
        if (t is WordTok && ParserLib.IsReserved(t, StopWords)) throw Unexpected();
        // name() { ... }
        if (t is WordTok fw && IsOp("(", At(i + 1)) && IsOp(")", At(i + 2)))
        {
            i += 3;
            return ParseFuncBody(fw.W.Raw);
        }
        return ParseSimple();
    }

    private static readonly Regex ValidFuncName = new(@"^[A-Za-z_][\w-]*\z", RegexOptions.CultureInvariant);
    private static readonly Regex ValidVarName = new(@"^[A-Za-z_]\w*\z", RegexOptions.CultureInvariant);

    private Node ParseFuncBody(string name)
    {
        if (!ValidFuncName.IsMatch(name)) throw new ParseError($"`{name}': not a valid identifier");
        SkipNewlines();
        var body = ParseCommand();
        return new FuncDefNode { Name = name, Body = body };
    }

    private Node ParseSimple()
    {
        var words = new List<Word>();
        var redirects = new List<Redirect>();
        for (; ; )
        {
            var t = Peek();
            if (t is null) break;
            if (t is WordTok w)
            {
                words.Add(w.W);
                i++;
                continue;
            }
            if (t is OpTok o && ParserLib.IsRedir(o.V))
            {
                redirects.AddRange(ParseRedirects());
                continue;
            }
            break;
        }
        if (words.Count == 0 && redirects.Count == 0) throw Unexpected();
        return new SimpleNode { Words = words, Redirects = redirects };
    }

    private Node ParseIf()
    {
        i++; // if
        var clauses = new List<IfClause>();
        Node? elseBody = null;
        for (; ; )
        {
            var cond = ParseList(new[] { "then" });
            ExpectWord("then");
            var body = ParseList(new[] { "elif", "else", "fi" });
            clauses.Add(new IfClause { Cond = cond, Body = body });
            if (ParserLib.IsReserved(Peek(), "elif"))
            {
                i++;
                continue;
            }
            if (ParserLib.IsReserved(Peek(), "else"))
            {
                i++;
                elseBody = ParseList(new[] { "fi" });
            }
            ExpectWord("fi");
            break;
        }
        return new IfNode { Clauses = clauses, ElseBody = elseBody, Redirects = ParseRedirects() };
    }

    private Node ParseDoBody()
    {
        SkipNewlines();
        if (IsOp(";")) i++;
        ExpectWord("do");
        var body = ParseList(new[] { "done" });
        ExpectWord("done");
        return body;
    }

    private Node ParseFor()
    {
        i++; // for
        var t = Peek();
        if (t is ArithTok at)
        {
            i++;
            var parts = at.Expr.Split(';');
            if (parts.Length != 3) throw new ParseError("syntax error: arithmetic expression required");
            var cbody = ParseDoBody();
            return new CForNode { Init = parts[0], Cond = parts[1], Step = parts[2], Body = cbody, Redirects = ParseRedirects() };
        }
        if (t is not WordTok wt || !ValidVarName.IsMatch(wt.W.Raw)) throw Unexpected(t);
        i++;
        var name = wt.W.Raw;
        List<Word>? words = null;
        SkipNewlines();
        if (ParserLib.IsReserved(Peek(), "in"))
        {
            i++;
            words = new List<Word>();
            while (Peek() is WordTok w)
            {
                words.Add(w.W);
                i++;
            }
            if (!IsOp(";") && !IsOp("\n")) throw Unexpected();
            i++;
        }
        var body = ParseDoBody();
        return new ForNode { Name = name, Words = words, Body = body, Redirects = ParseRedirects() };
    }

    private Node ParseWhile()
    {
        bool until = ParserLib.IsReserved(Peek(), "until");
        i++;
        var cond = ParseList(new[] { "do" });
        var body = ParseDoBody();
        return new WhileNode { Until = until, Cond = cond, Body = body, Redirects = ParseRedirects() };
    }

    private Node ParseCase()
    {
        i++; // case
        var w = Peek();
        if (w is not WordTok ww) throw Unexpected(w);
        i++;
        ExpectWord("in");
        var items = new List<CaseItem>();
        for (; ; )
        {
            SkipNewlines();
            if (ParserLib.IsReserved(Peek(), "esac")) break;
            if (Peek() is null) throw new ParseError("syntax error: unexpected end of file", true);
            if (IsOp("(")) i++;
            var patterns = new List<Word>();
            for (; ; )
            {
                var p = Peek();
                if (p is not WordTok pw) throw Unexpected(p);
                patterns.Add(pw.W);
                i++;
                if (IsOp("|"))
                {
                    i++;
                    continue;
                }
                break;
            }
            if (!IsOp(")")) throw Unexpected();
            i++;
            var body = (ListNode)ParseList(new[] { ";;", "esac" });
            items.Add(new CaseItem { Patterns = patterns, Body = body.Items.Count > 0 ? body : null });
            if (IsOp(";;")) i++;
        }
        ExpectWord("esac");
        return new CaseNode { Word = ww.W, Items = items, Redirects = ParseRedirects() };
    }
}
