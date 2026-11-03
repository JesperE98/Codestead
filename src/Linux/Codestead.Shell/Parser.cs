using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Port of src/shell/parser.ts – parses bash code into a syntax tree (AST):
// quotes, \-escapes, pipes, redirection, ; && || &, and compound commands
// such as if/elif/else, for, while/until, case, functions, { ...; }, ( ... ) and (( ... )).
// Variables, $(...) and wildcards are expanded later by the shell.

public partial class Part
{
    /// <summary>Raw text. Unquoted and "double-quoted" parts still contain $VAR, $(...) etc.</summary>
    public string Text { get; set; } = "";
    /// <summary>"none", "single" or "double".</summary>
    public string Quoted { get; set; } = "none";

    public Part() { }
    public Part(string text, string quoted)
    {
        Text = text;
        Quoted = quoted;
    }
}

public partial class Word
{
    public List<Part> Parts { get; set; } = new();
    public string Raw { get; set; } = "";

    public Word() { }
    public Word(List<Part> parts, string raw)
    {
        Parts = parts;
        Raw = raw;
    }
}

public partial class Redirect
{
    /// <summary>&gt; &gt;&gt; &lt; 2&gt; 2&gt;&gt; 2&gt;&amp;1 &gt;&amp;2 &amp;&gt; &lt;&lt; &lt;&lt;- &lt;&lt;&lt;</summary>
    public string Op { get; set; } = "";
    public Word? Target { get; set; }
    /// <summary>The text of a here-document (&lt;&lt; END ... END).</summary>
    public string? Body { get; set; }
    /// <summary>Should $VAR be expanded in the here-document? (Not if the end word is quoted.)</summary>
    public bool? Expand { get; set; }
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(SimpleNode), "simple")]
[JsonDerivedType(typeof(PipelineNode), "pipeline")]
[JsonDerivedType(typeof(AndOrNode), "andor")]
[JsonDerivedType(typeof(ListNode), "list")]
[JsonDerivedType(typeof(IfNode), "if")]
[JsonDerivedType(typeof(ForNode), "for")]
[JsonDerivedType(typeof(CForNode), "cfor")]
[JsonDerivedType(typeof(WhileNode), "while")]
[JsonDerivedType(typeof(CaseNode), "case")]
[JsonDerivedType(typeof(GroupNode), "group")]
[JsonDerivedType(typeof(ArithNode), "arith")]
[JsonDerivedType(typeof(FuncDefNode), "funcdef")]
public abstract partial class Node
{
    /// <summary>The TypeScript discriminator: "simple", "pipeline", "andor", "list", "if", ...</summary>
    [JsonIgnore] public abstract string Type { get; }
}

/// <summary>Compound commands that can have their own redirections.</summary>
public abstract partial class CompoundNode : Node
{
    public List<Redirect> Redirects { get; set; } = new();
}

public sealed partial class SimpleNode : Node
{
    [JsonIgnore] public override string Type => "simple";
    public List<Word> Words { get; set; } = new();
    public List<Redirect> Redirects { get; set; } = new();
}

public sealed partial class PipelineNode : Node
{
    [JsonIgnore] public override string Type => "pipeline";
    public List<Node> Commands { get; set; } = new();
    public bool Negate { get; set; }
}

public sealed partial class AndOrItem
{
    /// <summary>"&amp;&amp;" or "||".</summary>
    public string Op { get; set; } = "";
    public Node Node { get; set; } = null!;
}

public sealed partial class AndOrNode : Node
{
    [JsonIgnore] public override string Type => "andor";
    public Node First { get; set; } = null!;
    public List<AndOrItem> Rest { get; set; } = new();
}

public sealed partial class ListItem
{
    public Node Node { get; set; } = null!;
    public bool Background { get; set; }
}

public sealed partial class ListNode : Node
{
    [JsonIgnore] public override string Type => "list";
    public List<ListItem> Items { get; set; } = new();
}

public sealed partial class IfClause
{
    public Node Cond { get; set; } = null!;
    public Node Body { get; set; } = null!;
}

public sealed partial class IfNode : CompoundNode
{
    [JsonIgnore] public override string Type => "if";
    public List<IfClause> Clauses { get; set; } = new();
    public Node? ElseBody { get; set; }
}

public sealed partial class ForNode : CompoundNode
{
    [JsonIgnore] public override string Type => "for";
    public string Name { get; set; } = "";
    public List<Word>? Words { get; set; }
    public Node Body { get; set; } = null!;
}

public sealed partial class CForNode : CompoundNode
{
    [JsonIgnore] public override string Type => "cfor";
    public string Init { get; set; } = "";
    public string Cond { get; set; } = "";
    public string Step { get; set; } = "";
    public Node Body { get; set; } = null!;
}

public sealed partial class WhileNode : CompoundNode
{
    [JsonIgnore] public override string Type => "while";
    public bool Until { get; set; }
    public Node Cond { get; set; } = null!;
    public Node Body { get; set; } = null!;
}

public sealed partial class CaseItem
{
    public List<Word> Patterns { get; set; } = new();
    public Node? Body { get; set; }
}

public sealed partial class CaseNode : CompoundNode
{
    [JsonIgnore] public override string Type => "case";
    public Word Word { get; set; } = null!;
    public List<CaseItem> Items { get; set; } = new();
}

public sealed partial class GroupNode : CompoundNode
{
    [JsonIgnore] public override string Type => "group";
    public Node Body { get; set; } = null!;
    public bool Subshell { get; set; }
}

public sealed partial class ArithNode : CompoundNode
{
    [JsonIgnore] public override string Type => "arith";
    public string Expr { get; set; } = "";
}

public sealed partial class FuncDefNode : Node
{
    [JsonIgnore] public override string Type => "funcdef";
    public string Name { get; set; } = "";
    public Node Body { get; set; } = null!;
}

public partial class ParseError : Exception
{
    /// <summary>True when the code is only incomplete (e.g. missing "done") – the shell then shows "> " and waits for more.</summary>
    public bool Incomplete { get; }

    public ParseError(string message, bool incomplete = false) : base(message) => Incomplete = incomplete;
}

/// <summary>A token: "word", "op", "arith" or "hdbody" (see the T property).</summary>
public abstract partial class Tok
{
    public abstract string T { get; }
}

public sealed partial class WordTok(Word w) : Tok
{
    public override string T => "word";
    public Word W { get; } = w;
}

public sealed partial class OpTok(string v) : Tok
{
    public override string T => "op";
    public string V { get; } = v;
}

public sealed partial class ArithTok(string expr) : Tok
{
    public override string T => "arith";
    public string Expr { get; } = expr;
}

public sealed partial class HdBodyTok(string body, bool quoted) : Tok
{
    public override string T => "hdbody";
    public string Body { get; } = body;
    public bool Quoted { get; } = quoted;
}

public static partial class ParserLib
{
    private static readonly HashSet<string> Redirs = new() { ">", ">>", "<", "2>", "2>>", "2>&1", ">&2", "&>", "<<", "<<-", "<<<" };
    // The order matters: longer operators first.
    private static readonly string[] Ops = { "2>&1", "1>&2", ">&2", "2>>", "2>", "&>", "&&", "||", ";;", "<<<", "<<-", "<<", ">>", "|", ">", "<", ";", "&", "(", ")" };

    public static bool IsRedir(string op) => Redirs.Contains(op);

    /// <summary>
    /// Finds the index of the closing parenthesis matching the one at <paramref name="open"/>.
    /// Skips quotes and nested parentheses. Returns -1 if it is missing.
    /// </summary>
    public static int FindClosingParen(string input, int open)
    {
        int depth = 0;
        for (int i = open; i < input.Length; i++)
        {
            char c = input[i];
            if (c == '\\')
            {
                i++;
            }
            else if (c == '\'')
            {
                int j = input.IndexOf('\'', i + 1);
                if (j < 0) return -1;
                i = j;
            }
            else if (c == '"')
            {
                i++;
                while (i < input.Length && input[i] != '"')
                {
                    if (input[i] == '\\') i++;
                    i++;
                }
                if (i >= input.Length) return -1;
            }
            else if (c == '(')
            {
                depth++;
            }
            else if (c == ')')
            {
                depth--;
                if (depth == 0) return i;
            }
        }
        return -1;
    }

    /// <summary>If input[i] starts $( $(( ${ or `...`: returns the index after the end. Otherwise -1.</summary>
    private static int SkipExpansion(string input, int i)
    {
        if (i < input.Length && input[i] == '`')
        {
            int j = i + 1;
            while (j < input.Length && input[j] != '`')
            {
                if (input[j] == '\\') j++;
                j++;
            }
            if (j >= input.Length) throw new ParseError("unexpected EOF while looking for matching ``'", true);
            return j + 1;
        }
        if (i >= input.Length || input[i] != '$') return -1;
        if (i + 1 < input.Length && input[i + 1] == '(')
        {
            int j = FindClosingParen(input, i + 1);
            if (j < 0) throw new ParseError("unexpected EOF while looking for matching `)'", true);
            return j + 1;
        }
        if (i + 1 < input.Length && input[i + 1] == '{')
        {
            int j = input.IndexOf('}', i + 2);
            if (j < 0) throw new ParseError("unexpected EOF while looking for matching `}'", true);
            return j + 1;
        }
        return -1;
    }

    private sealed class WordBuf
    {
        public List<Part> Parts = new();
        public string Raw = "";
        public string Cur = "";
    }

    private static readonly Regex DoubleBracket = new(@"^\[\[\s", RegexOptions.CultureInvariant);

    public static List<Tok> Tokenize(string input, bool noOps = false)
    {
        var toks = new List<Tok>();
        WordBuf? word = null;

        WordBuf Begin() => word ??= new WordBuf();
        void Flush(WordBuf w)
        {
            if (w.Cur != "")
            {
                w.Parts.Add(new Part(w.Cur, "none"));
                w.Cur = "";
            }
        }
        // Here-documents waiting for the next newline: index of the end word's token.
        var heredocs = new List<(int Index, bool Strip)>();
        var bodies = new Dictionary<int, (string Body, bool Quoted)>();
        void End()
        {
            if (word is not null)
            {
                Flush(word);
                var prev = toks.Count > 0 ? toks[^1] : null;
                if (prev is OpTok op && (op.V == "<<" || op.V == "<<-")) heredocs.Add((toks.Count, op.V == "<<-"));
                toks.Add(new WordTok(new Word(word.Parts, word.Raw)));
                word = null;
            }
        }
        bool AtCommandStart()
        {
            var last = toks.Count > 0 ? toks[^1] : null;
            return last is null
                || (last is OpTok o && !Redirs.Contains(o.V))
                || (last is WordTok w && (w.W.Raw is "do" or "then" or "else" or "{" or "for"));
        }

        int i = 0;
        while (i < input.Length)
        {
            char c = input[i];
            if (c == ' ' || c == '\t' || c == '\r')
            {
                End();
                i++;
                continue;
            }
            if (c == '\n')
            {
                End();
                if (!noOps) toks.Add(new OpTok("\n"));
                i++;
                // Read pending here-documents: the lines up to the end word.
                while (heredocs.Count > 0)
                {
                    var (index, strip) = heredocs[0];
                    heredocs.RemoveAt(0);
                    var delimWord = ((WordTok)toks[index]).W;
                    var delim = string.Concat(delimWord.Parts.Select(p => p.Text));
                    var quoted = delimWord.Parts.Any(p => p.Quoted != "none");
                    var lines = new List<string>();
                    for (; ; )
                    {
                        if (i >= input.Length) throw new ParseError($"here-document delimited by end-of-file (wanted `{delim}')", true);
                        int nl = input.IndexOf('\n', i);
                        var line = input[i..(nl < 0 ? input.Length : nl)];
                        i = nl < 0 ? input.Length : nl + 1;
                        if (strip) line = line.TrimStart('\t');
                        if (line == delim) break;
                        lines.Add(line);
                    }
                    bodies[index] = (string.Concat(lines.Select(l => l + "\n")), quoted);
                }
                continue;
            }
            if (word is null && c == '#')
            {
                while (i < input.Length && input[i] != '\n') i++;
                continue;
            }

            // [[ ... ]]: inside, && || < > ( ) are ordinary words interpreted by [[ itself.
            if (!noOps && word is null && DoubleBracket.IsMatch(input.Slice(i, i + 3)) && AtCommandStart())
            {
                int j = input.IndexOf("]]", i + 2, StringComparison.Ordinal);
                if (j < 0) throw new ParseError("unexpected EOF while looking for matching `]]'", true);
                var inner = Tokenize(input[(i + 2)..j], true);
                toks.Add(new WordTok(new Word(new List<Part> { new("[[", "none") }, "[[")));
                toks.AddRange(inner);
                toks.Add(new WordTok(new Word(new List<Part> { new("]]", "none") }, "]]")));
                i = j + 2;
                continue;
            }

            // (( arithmetic )) as its own command, e.g. ((i++)) or for ((i=0; i<3; i++))
            if (!noOps && word is null && string.CompareOrdinal(input, i, "((", 0, 2) == 0 && AtCommandStart())
            {
                int j = FindClosingParen(input, i);
                if (j < 0 || input[j - 1] != ')') throw new ParseError("unexpected EOF while looking for matching `))'", true);
                toks.Add(new ArithTok(input[(i + 2)..(j - 1)]));
                i = j + 1;
                continue;
            }

            bool matchedOp = false;
            if (!noOps)
            {
                foreach (var op in Ops)
                {
                    // "2>" only counts as an operator at the start of a word (otherwise "file2>x" = "file2" + ">").
                    if ((op.StartsWith('2') || op.StartsWith('1')) && word is not null) continue;
                    if (string.CompareOrdinal(input, i, op, 0, op.Length) == 0 && i + op.Length <= input.Length)
                    {
                        End();
                        toks.Add(new OpTok(op));
                        i += op.Length;
                        matchedOp = true;
                        break;
                    }
                }
            }
            if (matchedOp) continue;

            if (c == '\'')
            {
                var w = Begin();
                Flush(w);
                int j = input.IndexOf('\'', i + 1);
                if (j < 0) throw new ParseError("unexpected EOF while looking for matching `''", true);
                w.Parts.Add(new Part(input[(i + 1)..j], "single"));
                w.Raw += input[i..(j + 1)];
                i = j + 1;
                continue;
            }

            if (c == '"')
            {
                var w = Begin();
                Flush(w);
                int j = i + 1;
                var buf = "";
                while (j < input.Length && input[j] != '"')
                {
                    if (input[j] == '\\' && j + 1 < input.Length && "\"\\$`".Contains(input[j + 1]))
                    {
                        // An escaped character inside "..." becomes literal (is not expanded).
                        if (buf != "") w.Parts.Add(new Part(buf, "double"));
                        buf = "";
                        w.Parts.Add(new Part(input[j + 1].ToString(), "single"));
                        j += 2;
                        continue;
                    }
                    int k2 = SkipExpansion(input, j);
                    if (k2 > 0)
                    {
                        buf += input[j..k2];
                        j = k2;
                        continue;
                    }
                    buf += input[j];
                    j++;
                }
                if (j >= input.Length) throw new ParseError("unexpected EOF while looking for matching `\"'", true);
                w.Parts.Add(new Part(buf, "double"));
                w.Raw += input[i..(j + 1)];
                i = j + 1;
                continue;
            }

            if (c == '\\')
            {
                var w = Begin();
                if (i + 1 < input.Length && input[i + 1] == '\n')
                {
                    // Line continuation
                    i += 2;
                    continue;
                }
                if (i + 1 < input.Length)
                {
                    Flush(w);
                    w.Parts.Add(new Part(input[i + 1].ToString(), "single"));
                    w.Raw += input[i..(i + 2)];
                }
                i += 2;
                continue;
            }

            int k = SkipExpansion(input, i);
            if (k > 0)
            {
                var w = Begin();
                w.Cur += input[i..k];
                w.Raw += input[i..k];
                i = k;
                continue;
            }

            var wb = Begin();
            wb.Cur += c;
            wb.Raw += c;
            i++;
        }
        End();
        if (heredocs.Count > 0)
        {
            var delim = ((WordTok)toks[heredocs[0].Index]).W.Raw;
            throw new ParseError($"here-document delimited by end-of-file (wanted `{delim}')", true);
        }
        if (bodies.Count == 0) return toks;
        var result = new List<Tok>();
        for (int idx = 0; idx < toks.Count; idx++)
        {
            result.Add(toks[idx]);
            if (bodies.TryGetValue(idx, out var b)) result.Add(new HdBodyTok(b.Body, b.Quoted));
        }
        return result;
    }

    /// <summary>A word the shell treats as reserved (if, then, do ...) – only when completely unquoted.</summary>
    internal static bool IsReserved(Tok? t, params string[] names) =>
        t is WordTok w && w.W.Parts.Count == 1 && w.W.Parts[0].Quoted == "none" && names.Contains(w.W.Raw);

    public static Node Parse(string input) => new Parser(Tokenize(input)).ParseProgram();

    /// <summary>Turns a glob pattern (*, ?, [abc]) into a regex. With anyChar, * also matches "/" (as in case).</summary>
    public static Regex GlobToRegex(string seg, bool anyChar = false)
    {
        var star = anyChar ? ".*" : "[^/]*";
        var one = anyChar ? "." : "[^/]";
        var re = new StringBuilder();
        for (int i = 0; i < seg.Length; i++)
        {
            char c = seg[i];
            if (c == '\\' && i + 1 < seg.Length)
            {
                re.Append(EscapeRegex(seg[++i].ToString()));
            }
            else if (c == '*')
            {
                re.Append(star);
            }
            else if (c == '?')
            {
                re.Append(one);
            }
            else if (c == '[')
            {
                int j = i + 2 <= seg.Length ? seg.IndexOf(']', i + 2) : -1;
                if (j < 0)
                {
                    re.Append("\\[");
                }
                else
                {
                    var cls = seg[(i + 1)..j];
                    if (cls.StartsWith('!')) cls = "^" + cls[1..];
                    re.Append('[').Append(cls.Replace("\\", "\\\\")).Append(']');
                    i = j;
                }
            }
            else
            {
                re.Append(EscapeRegex(c.ToString()));
            }
        }
        // \z instead of $: in .NET, $ would also match before a final newline.
        return new Regex($"^(?:{re})\\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    }

    public static bool HasUnescapedGlob(string seg)
    {
        for (int i = 0; i < seg.Length; i++)
        {
            if (seg[i] == '\\')
            {
                i++;
                continue;
            }
            if (seg[i] == '*' || seg[i] == '?' || seg[i] == '[') return true;
        }
        return false;
    }

    private static readonly Regex GlobChars = new(@"[*?[\]\\]", RegexOptions.CultureInvariant);
    private static readonly Regex Escaped = new(@"\\(.)", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex RegexChars = new(@"[.*+?^${}()|[\]\\/]", RegexOptions.CultureInvariant);

    public static string EscapeGlob(string text) => GlobChars.Replace(text, m => "\\" + m.Value);

    public static string UnescapeGlob(string text) => Escaped.Replace(text, "$1");

    public static string EscapeRegex(string text) => RegexChars.Replace(text, m => m.Value == "/" ? "/" : "\\" + m.Value);
}

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
