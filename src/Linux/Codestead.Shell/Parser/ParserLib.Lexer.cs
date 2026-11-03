namespace Codestead.Shell;

// ParserLib: the tokenizer (lexer) that turns bash code into tokens, with its helpers.

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
}
