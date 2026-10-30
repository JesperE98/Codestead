namespace Codestead.Shell.Commands;

// Port of src/shell/commands/textproc.ts – text processing: tr, sed and awk.

public static partial class TextprocCmd
{
    private static void DimNote(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("textproc.simulator")}: {ctx.Sh.Msg(key, args)}){UtilCmd.Color.Reset}\n");

    /// <summary>[...s] – the code points of a string, each as a string.</summary>
    private static List<string> CodePoints(string s)
    {
        var list = new List<string>(s.Length);
        for (int i = 0; i < s.Length; i++)
        {
            if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
            {
                list.Add(s.Substring(i, 2));
                i++;
            }
            else list.Add(s[i].ToString());
        }
        return list;
    }

    private static int CodePointAt0(string c) =>
        c.Length >= 2 && char.IsSurrogatePair(c, 0) ? char.ConvertToUtf32(c, 0) : c[0];

    private static string FromCodePoint(int cp) =>
        cp is >= 0xD800 and <= 0xDFFF ? ((char)cp).ToString() : char.ConvertFromUtf32(cp);

    private static bool IsDigit(char? c) => c is >= '0' and <= '9';

    // =====================================================================
    // tr
    // =====================================================================

    private static readonly OrderedDictionary<string, string> TrClasses = BuildTrClasses();

    private static OrderedDictionary<string, string> BuildTrClasses()
    {
        var d = new OrderedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["upper"] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            ["lower"] = "abcdefghijklmnopqrstuvwxyz",
            ["digit"] = "0123456789",
            ["space"] = " \t\n\r\f\v",
            ["blank"] = " \t",
            ["punct"] = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
            ["xdigit"] = "0123456789ABCDEFabcdef",
        };
        d["alpha"] = d["upper"] + d["lower"];
        d["alnum"] = d["digit"] + d["alpha"];
        return d;
    }

    private sealed class TrError(string message) : Exception(message);

    private static readonly Dictionary<string, string> TrEscapes = new(StringComparer.Ordinal)
    {
        ["n"] = "\n", ["t"] = "\t", ["r"] = "\r", ["f"] = "\f", ["v"] = "\v", ["a"] = "\x07", ["b"] = "\b", ["\\"] = "\\",
    };

    /// <summary>Expands a tr set: ranges (a-z), classes ([:upper:]) and escapes (\n).</summary>
    public static List<string> ExpandTrSet(string spec)
    {
        var chars = CodePoints(spec);
        var o = new List<string>();
        int i = 0;
        string At(int k) => k < chars.Count ? chars[k] : "";
        string ReadChar()
        {
            var c = chars[i++];
            if (c != "\\" || i >= chars.Count) return c;
            var n = chars[i++];
            if (TrEscapes.TryGetValue(n, out var mapped)) return mapped;
            if (n.Length == 1 && n[0] is >= '0' and <= '7')
            {
                var oct = n;
                while (oct.Length < 3 && At(i) is [>= '0' and <= '7']) oct += chars[i++];
                return ((char)Convert.ToInt32(oct, 8)).ToString();
            }
            return n;
        }
        while (i < chars.Count)
        {
            if (chars[i] == "[" && At(i + 1) == ":")
            {
                var rest = string.Concat(chars.Skip(i));
                int end = rest.IndexOf(":]", StringComparison.Ordinal);
                if (end > 0)
                {
                    var name = rest.Slice(2, end);
                    var cls = TrClasses.Get(name);
                    if (cls is null) throw new TrError($"invalid character class '{name}'");
                    o.AddRange(CodePoints(cls));
                    i += CodePoints(rest.Slice(0, end + 2)).Count;
                    continue;
                }
            }
            var c = ReadChar();
            if (At(i) == "-" && i + 1 < chars.Count)
            {
                i++;
                var d = ReadChar();
                int from = CodePointAt0(c);
                int to = CodePointAt0(d);
                if (to < from) throw new TrError($"range-endpoints of '{c}-{d}' are in reverse collating sequence order");
                for (int cp = from; cp <= to; cp++) o.Add(FromCodePoint(cp));
                continue;
            }
            o.Add(c);
        }
        return o;
    }

    private static readonly Regex TrShortFlagsRe = new("^-[a-zA-Z]+\\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Tr = new()
    {
        Name = "tr",
        Summary = "Byter ut eller tar bort tecken",
        Man = """
NAMN
       tr - översätt (translate), ta bort eller pressa ihop tecken

SYNOPSIS
       tr [-c] [-d] [-s] MÄNGD1 [MÄNGD2]

BESKRIVNING
       Läser standard input, byter varje tecken i MÄNGD1 mot tecknet på
       samma plats i MÄNGD2 och skriver resultatet till standard output.
       tr läser bara från standard input – aldrig från filer. Använd en pipe
       eller <.

       Mängder skrivs som vanliga tecken, intervall eller klasser:
       a-z  A-Z  0-9           intervall
       [:upper:] [:lower:]     stora / små bokstäver
       [:digit:] [:space:]     siffror / blanktecken
       [:alpha:] [:alnum:] [:punct:]
       \n  \t                  ny rad, tabb

       Obs! tr arbetar med enskilda byte, så a-z och [:lower:] omfattar
       inte å, ä och ö.

FLAGGOR
       -d    ta bort (delete) alla tecken i MÄNGD1
       -s    pressa ihop (squeeze) upprepade tecken till ett
       -c    använd komplementet till MÄNGD1 (alla tecken som INTE finns där)

EXEMPEL
       echo hej | tr a-z A-Z            HEJ
       echo $PATH | tr ':' '\n'         en katalog per rad
       tr -d '0-9' < fil.txt            ta bort alla siffror
       echo "a   b    c" | tr -s ' '    a b c
""",
        Run = ctx =>
        {
            var flags = new HashSet<string>();
            var ops = new List<string>();
            int i = 0;
            var longFlags = new Dictionary<string, string> { ["--delete"] = "d", ["--squeeze-repeats"] = "s", ["--complement"] = "c" };
            for (; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "--")
                {
                    i++;
                    break;
                }
                if (longFlags.TryGetValue(a, out var lf))
                {
                    flags.Add(lf);
                    continue;
                }
                if (TrShortFlagsRe.IsMatch(a))
                {
                    foreach (var c in a[1..])
                    {
                        if (!"dscC".Contains(c))
                        {
                            ctx.Err($"tr: invalid option -- '{c}'\nTry 'tr --help' for more information.\n");
                            return 1;
                        }
                        flags.Add(c == 'C' ? "c" : c.ToString());
                    }
                    continue;
                }
                if (a.StartsWith("--", StringComparison.Ordinal))
                {
                    ctx.Err($"tr: unrecognized option '{a}'\nTry 'tr --help' for more information.\n");
                    return 1;
                }
                ops.Add(a);
            }
            ops.AddRange(ctx.Args.Skip(i));

            bool del = flags.Contains("d");
            bool squeeze = flags.Contains("s");
            int Usage(string msg)
            {
                ctx.Err($"tr: {msg}\nTry 'tr --help' for more information.\n");
                return 1;
            }
            if (ops.Count == 0) return Usage("missing operand");
            if (del && !squeeze && ops.Count > 1)
                return Usage($"extra operand '{ops[1]}'\nOnly one string may be given when deleting without squeezing repeated characters.");
            if (del && squeeze && ops.Count < 2)
                return Usage($"missing operand after '{ops[0]}'\nTwo strings must be given when both deleting and squeezing repeats.");
            if (!del && !squeeze && ops.Count < 2) return Usage($"missing operand after '{ops[0]}'\nTwo strings must be given when translating.");
            if (ops.Count > 2) return Usage($"extra operand '{ops[2]}'");

            List<string> set1;
            List<string> set2;
            try
            {
                set1 = ExpandTrSet(ops[0]);
                set2 = ops.Count > 1 ? ExpandTrSet(ops[1]) : new List<string>();
            }
            catch (TrError e)
            {
                ctx.Err($"tr: {e.Message}\n");
                return 1;
            }
            var in1 = new HashSet<string>(set1, StringComparer.Ordinal);
            bool complement = flags.Contains("c");
            bool InSet1(string c) => complement ? !in1.Contains(c) : in1.Contains(c);
            bool translating = !del && ops.Count == 2;
            if (translating && set2.Count == 0)
            {
                ctx.Err("tr: when not truncating set1, string2 must be non-empty\n");
                return 1;
            }
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            if (translating && !complement)
                for (int idx = 0; idx < set1.Count; idx++) map[set1[idx]] = set2[Math.Min(idx, set2.Count - 1)];
            var squeezeSet = new HashSet<string>(del || translating ? set2 : set1, StringComparer.Ordinal);
            bool SqueezeTest(string c) => del || translating ? squeezeSet.Contains(c) : InSet1(c);

            var o = new StringBuilder();
            var last = "";
            foreach (var ch in CodePoints(ctx.Stdin ?? ""))
            {
                var c = ch;
                if (del && InSet1(c)) continue;
                if (translating)
                {
                    if (complement)
                    {
                        if (InSet1(c)) c = set2[^1];
                    }
                    else c = map.TryGetValue(c, out var mc) ? mc : c;
                }
                if (squeeze && c == last && SqueezeTest(c)) continue;
                o.Append(c);
                last = c;
            }
            ctx.Out(o.ToString());
            return 0;
        },
    };

    // =====================================================================
    // sed
    // =====================================================================

    private sealed class SedError(string message) : Exception(message);
    private sealed class SedUnsupported(string message) : Exception(message);

    /// <summary>A compiled regex together with its JavaScript source (re.source).</summary>
    private sealed class SedRe(string source, Regex re)
    {
        public string Source { get; } = source;
        public Regex Re { get; } = re;
    }

    /// <summary>kind: "line" (N), "step" (First, Step), "last" or "re" (Re).</summary>
    private sealed class SedAddr
    {
        public required string Kind { get; init; }
        public double N { get; init; }
        public double First { get; init; }
        public double Step { get; init; }
        public SedRe? Re { get; init; }
    }

    /// <summary>A part of the replacement: literal text, a group (\1, &amp;) or a case operation (\U \L \E \u \l).</summary>
    private sealed class ReplPart
    {
        public string? Text { get; init; }
        public int? Group { get; init; }
        public char? CaseOp { get; init; }
    }

    private sealed class SedCommand
    {
        public SedAddr? A1 { get; set; }
        public SedAddr? A2 { get; set; }
        public bool Neg { get; set; }
        public string Name { get; set; } = "";
        // s:
        public SedRe? Re { get; set; }
        public List<ReplPart>? Repl { get; set; }
        public bool Global { get; set; }
        public double Nth { get; set; }
        public bool Print { get; set; }
        // y:
        public Dictionary<string, string>? Map { get; set; }
        // a, i, c:
        public string? Text { get; set; }
        // q, Q:
        public double ExitCode { get; set; }
        /// <summary>Whether a range is in progress.</summary>
        public bool Active { get; set; }
    }

    private sealed class SedState
    {
        public SedRe? LastRe { get; set; }
    }

    private const string SedUnsupportedCmds = "nNDPhHgGxbtTlrRwWeFzv:{}";

    private static void ParseSedScript(string script, int exprNo, bool ere, SedState state, List<SedCommand> cmds)
    {
        int i = 0;
        char? At(int k) => k >= 0 && k < script.Length ? script[k] : null;
        SedError Fail(string msg) => new($"-e expression #{exprNo}, char {Math.Max(i, 1)}: {msg}");
        void SkipSpace()
        {
            while (At(i) == ' ' || At(i) == '\t') i++;
        }
        void EndOfCmd()
        {
            SkipSpace();
            var c = At(i);
            if (c is null || c == ';' || c == '\n') return;
            if (c == '#')
            {
                while (i < script.Length && script[i] != '\n') i++;
                return;
            }
            if (c == '}') throw new SedUnsupported("{ }");
            throw Fail("extra characters after command");
        }
        // Reads up to the (unescaped) delimiter. \delimiter becomes the delimiter itself.
        string ReadDelimited(char delim, string what)
        {
            var s = new StringBuilder();
            while (i < script.Length && script[i] != delim)
            {
                if (script[i] == '\n' && delim != '\n') throw Fail(what);
                if (script[i] == '\\' && i + 1 < script.Length)
                {
                    char n = script[i + 1];
                    if (n == delim) s.Append(delim);
                    else s.Append('\\').Append(n);
                    i += 2;
                    continue;
                }
                s.Append(script[i++]);
            }
            if (i >= script.Length) throw Fail(what);
            i++;
            return s.ToString();
        }
        SedRe MakeRe(string src, string flags, string what)
        {
            if (src == "")
            {
                if (state.LastRe is null) throw Fail("no previous regular expression");
                return new SedRe(state.LastRe.Source, RegexCmd.NewRegExp(state.LastRe.Source, flags));
            }
            try
            {
                var source = RegexCmd.ToJsRegex(src, ere);
                var re = new SedRe(source, RegexCmd.NewRegExp(source, flags));
                state.LastRe = re;
                return re;
            }
            catch (ArgumentException)
            {
                throw Fail($"Invalid {what}");
            }
        }
        string ReadDigits()
        {
            var n = new StringBuilder();
            while (IsDigit(At(i))) n.Append(script[i++]);
            return n.ToString();
        }
        SedAddr? ReadAddr()
        {
            var c = At(i);
            if (IsDigit(c))
            {
                var n = ReadDigits();
                if (At(i) == '~')
                {
                    // GNU extension: first~step, e.g. 1~2 = every other line.
                    i++;
                    var step = ReadDigits();
                    return new SedAddr { Kind = "step", First = Js.Number(n), Step = Js.Number(step == "" ? "0" : step) };
                }
                if (Js.Number(n) == 0) throw Fail("invalid usage of line address 0");
                return new SedAddr { Kind = "line", N = Js.Number(n) };
            }
            if (c == '$')
            {
                i++;
                return new SedAddr { Kind = "last" };
            }
            if (c == '/' || c == '\\')
            {
                i++;
                var delim = c == '/' ? '/' : At(i++);
                if (delim is null) throw Fail("unexpected end of expression");
                var src = ReadDelimited(delim.Value, "unterminated address regex");
                var flags = "";
                while (At(i) == 'I' || At(i) == 'M')
                {
                    if (At(i) == 'I') flags = "i";
                    i++;
                }
                return new SedAddr { Kind = "re", Re = MakeRe(src, flags, "regular expression") };
            }
            return null;
        }

        while (i < script.Length)
        {
            while (i < script.Length && (char.IsWhiteSpace(script[i]) || script[i] == '\uFEFF' || script[i] == ';')) i++;
            if (i >= script.Length) break;
            if (script[i] == '#')
            {
                while (i < script.Length && script[i] != '\n') i++;
                continue;
            }
            var cmd = new SedCommand();
            cmd.A1 = ReadAddr();
            if (cmd.A1 is not null && At(i) == ',')
            {
                i++;
                SkipSpace();
                cmd.A2 = ReadAddr();
                if (cmd.A2 is null) throw Fail("unexpected `,'");
            }
            SkipSpace();
            if (At(i) == '!')
            {
                cmd.Neg = true;
                i++;
                SkipSpace();
                if (At(i) == '!') throw Fail("multiple `!'s");
            }
            if (i >= script.Length || script[i] == ';' || script[i] == '\n') throw Fail("missing command");
            if (cmd.A1 is null && script[i] == ',') throw Fail("unexpected `,'");
            char name = script[i++];
            cmd.Name = name.ToString();
            switch (name)
            {
                case 's':
                {
                    var delim = At(i++);
                    if (delim is null || delim == '\n' || delim == '\\') throw Fail("unterminated `s' command");
                    var pat = ReadDelimited(delim.Value, "unterminated `s' command");
                    var rawRepl = ReadDelimited(delim.Value, "unterminated `s' command");
                    var flags = "";
                    cmd.Nth = 1;
                    bool nthSet = false;
                    for (; ; )
                    {
                        var f = At(i);
                        if (f == 'g') cmd.Global = true;
                        else if (f == 'p') cmd.Print = true;
                        else if (f == 'i' || f == 'I') flags = "i";
                        else if (IsDigit(f))
                        {
                            var n = ReadDigits();
                            if (Js.Number(n) == 0) throw Fail("number option to `s' command may not be zero");
                            if (nthSet) throw Fail("multiple number options to `s' command");
                            cmd.Nth = Js.Number(n);
                            nthSet = true;
                            continue;
                        }
                        else if (f == 'w' || f == 'e' || f == 'm' || f == 'M') throw new SedUnsupported($"s///{f}");
                        else break;
                        i++;
                    }
                    var c = At(i);
                    if (c is not null && !" \t;\n#}".Contains(c.Value)) throw Fail("unknown option to `s'");
                    EndOfCmd();
                    cmd.Re = MakeRe(pat, "g" + flags, "regular expression");
                    int groups = RegexCmd.GroupCount(cmd.Re.Re);
                    var parts = new List<ReplPart>();
                    var lit = new StringBuilder();
                    void Flush()
                    {
                        if (lit.Length > 0) parts.Add(new ReplPart { Text = lit.ToString() });
                        lit.Clear();
                    }
                    for (int j = 0; j < rawRepl.Length; j++)
                    {
                        char ch = rawRepl[j];
                        if (ch == '&')
                        {
                            Flush();
                            parts.Add(new ReplPart { Group = 0 });
                        }
                        else if (ch == '\\' && j + 1 < rawRepl.Length)
                        {
                            char n = rawRepl[++j];
                            if (n is >= '0' and <= '9')
                            {
                                if (n - '0' > groups) throw Fail($"invalid reference \\{n} on `s' command's RHS");
                                Flush();
                                parts.Add(new ReplPart { Group = n - '0' });
                            }
                            else if ("ULEul".Contains(n))
                            {
                                Flush();
                                parts.Add(new ReplPart { CaseOp = n });
                            }
                            else lit.Append(n == 'n' ? '\n' : n == 't' ? '\t' : n);
                        }
                        else lit.Append(ch);
                    }
                    Flush();
                    cmd.Repl = parts;
                    break;
                }
                case 'y':
                {
                    var delim = At(i++);
                    if (delim is null || delim == '\n' || delim == '\\') throw Fail("unterminated `y' command");
                    static string Unesc(string s) => YEscRe.Replace(s, m => m.Groups[1].Value switch
                    {
                        "n" => "\n",
                        "t" => "\t",
                        var c => c,
                    });
                    var from = CodePoints(Unesc(ReadDelimited(delim.Value, "unterminated `y' command")));
                    var to = CodePoints(Unesc(ReadDelimited(delim.Value, "unterminated `y' command")));
                    if (from.Count != to.Count) throw Fail("strings for `y' command are different lengths");
                    cmd.Map = new Dictionary<string, string>(StringComparer.Ordinal);
                    for (int k = 0; k < from.Count; k++) cmd.Map[from[k]] = to[k];
                    EndOfCmd();
                    break;
                }
                case 'd':
                case 'p':
                case '=':
                    EndOfCmd();
                    break;
                case 'q':
                case 'Q':
                {
                    if (cmd.A2 is not null) throw Fail("command only uses one address");
                    SkipSpace();
                    var n = ReadDigits();
                    cmd.ExitCode = n != "" ? Js.Number(n) : 0;
                    EndOfCmd();
                    break;
                }
                case 'a':
                case 'i':
                case 'c':
                {
                    // The GNU one-line variant: "a text", "a\text" or "a\" + newline + text.
                    SkipSpace();
                    if (At(i) == '\\')
                    {
                        i++;
                        if (At(i) == '\n') i++;
                    }
                    var text = new StringBuilder();
                    while (i < script.Length && script[i] != '\n')
                    {
                        if (script[i] == '\\' && i + 1 < script.Length)
                        {
                            char n = script[i + 1];
                            text.Append(n == 'n' ? '\n' : n == 't' ? '\t' : n);
                            i += 2;
                        }
                        else text.Append(script[i++]);
                    }
                    if (text.Length == 0) throw Fail("expected \\ after `a', `c' or `i'");
                    cmd.Text = text.ToString();
                    break;
                }
                default:
                    if (SedUnsupportedCmds.Contains(name)) throw new SedUnsupported(name.ToString());
                    i--;
                    throw Fail($"unknown command: `{name}'");
            }
            cmds.Add(cmd);
        }
    }

    private static readonly Regex YEscRe = new("\\\\([^\n\r\u2028\u2029])", RegexOptions.CultureInvariant);

    private static string? Substitute(string ps, SedCommand cmd)
    {
        var re = cmd.Re!.Re;
        int count = 0;
        var o = new StringBuilder();
        int last = 0;
        bool did = false;
        foreach (System.Text.RegularExpressions.Match m in re.Matches(ps))
        {
            count++;
            bool take = cmd.Global ? count >= cmd.Nth : count == cmd.Nth;
            if (!take) continue;
            o.Append(ps, last, m.Index - last).Append(BuildReplacement(cmd.Repl!, m));
            last = m.Index + m.Length;
            did = true;
            if (!cmd.Global) break;
        }
        return did ? o.Append(ps, last, ps.Length - last).ToString() : null;
    }

    private static string BuildReplacement(List<ReplPart> parts, System.Text.RegularExpressions.Match m)
    {
        var o = new StringBuilder();
        char? mode = null;
        char? once = null;
        void Add(string s)
        {
            if (s == "") return;
            if (mode == 'U') s = AwkCmd.JsUpper(s);
            else if (mode == 'L') s = AwkCmd.JsLower(s);
            if (once is not null)
            {
                var first = s[0].ToString();
                s = (once == 'u' ? AwkCmd.JsUpper(first) : AwkCmd.JsLower(first)) + s[1..];
                once = null;
            }
            o.Append(s);
        }
        foreach (var p in parts)
        {
            if (p.Text is not null) Add(p.Text);
            else if (p.Group is int g) Add(g < m.Groups.Count && m.Groups[g].Success ? m.Groups[g].Value : "");
            else if (p.CaseOp is 'u' or 'l') once = p.CaseOp;
            else mode = p.CaseOp == 'E' ? null : p.CaseOp;
        }
        return o.ToString();
    }

    private sealed class SedRun
    {
        public bool Quit { get; set; }
        public double ExitCode { get; set; }
    }

    /// <summary>Runs the sed program on a stream of lines.</summary>
    private static void RunSedStream(List<SedCommand> cmds, string content, bool quiet, Action<string> @out, SedRun run)
    {
        var lines = UtilCmd.SplitLines(content);
        bool missingNewline = content != "" && !content.EndsWith('\n');
        int lastNo = lines.Count;
        foreach (var c in cmds) c.Active = false;

        bool Test(SedAddr a, int n, string ps)
        {
            if (a.Kind == "line") return n == a.N;
            if (a.Kind == "last") return n == lastNo;
            if (a.Kind == "step") return a.Step > 0 ? n >= a.First && (n - a.First) % a.Step == 0 : n == a.First;
            return a.Re!.Re.IsMatch(ps);
        }
        bool Matches(SedCommand cmd, int n, string ps)
        {
            bool m;
            if (cmd.A1 is null) m = true;
            else if (cmd.A2 is null) m = Test(cmd.A1, n, ps);
            else if (!cmd.Active)
            {
                m = Test(cmd.A1, n, ps);
                if (m)
                {
                    var a2 = cmd.A2;
                    cmd.Active = !(a2.Kind == "line" ? a2.N <= n : a2.Kind == "last" ? n == lastNo : false);
                }
            }
            else
            {
                m = true;
                var a2 = cmd.A2;
                if (a2.Kind == "line" ? n >= a2.N : a2.Kind == "last" ? n == lastNo : Test(a2, n, ps)) cmd.Active = false;
            }
            return cmd.Neg ? !m : m;
        }

        for (int idx = 0; idx < lines.Count; idx++)
        {
            int n = idx + 1;
            var ps = lines[idx];
            bool deleted = false;
            var appended = new List<string>();
            foreach (var cmd in cmds)
            {
                if (!Matches(cmd, n, ps)) continue;
                if (cmd.Name == "s")
                {
                    var r = Substitute(ps, cmd);
                    if (r is not null)
                    {
                        ps = r;
                        if (cmd.Print) @out(ps + "\n");
                    }
                }
                else if (cmd.Name == "y")
                {
                    ps = string.Concat(CodePoints(ps).Select(c => cmd.Map!.TryGetValue(c, out var t) ? t : c));
                }
                else if (cmd.Name == "p")
                {
                    @out(ps + "\n");
                }
                else if (cmd.Name == "=")
                {
                    @out(n + "\n");
                }
                else if (cmd.Name == "a")
                {
                    appended.Add(cmd.Text!);
                }
                else if (cmd.Name == "i")
                {
                    @out(cmd.Text! + "\n");
                }
                else if (cmd.Name == "c")
                {
                    if (cmd.A2 is null || cmd.Neg || !cmd.Active) @out(cmd.Text! + "\n");
                    deleted = true;
                    break;
                }
                else if (cmd.Name == "d")
                {
                    deleted = true;
                    break;
                }
                else if (cmd.Name == "q" || cmd.Name == "Q")
                {
                    run.Quit = true;
                    run.ExitCode = cmd.ExitCode;
                    if (cmd.Name == "Q") deleted = true;
                    break;
                }
            }
            if (!deleted && !quiet) @out(ps + (n == lastNo && missingNewline && appended.Count == 0 ? "" : "\n"));
            foreach (var a in appended) @out(a + "\n");
            if (run.Quit) return;
        }
    }

    private static int ExitCodeOf(double d) => double.IsNaN(d) ? 0 : (int)Math.Clamp(d, int.MinValue, int.MaxValue);

    private static readonly CommandDef Sed = new()
    {
        Name = "sed",
        Summary = "Strömeditor: byter ut, tar bort och skriver ut rader",
        Man = """
NAMN
       sed - strömeditor (stream editor) för att filtrera och ändra text

SYNOPSIS
       sed [FLAGGA]... SKRIPT [FIL]...
       sed [FLAGGA]... -e SKRIPT [-e SKRIPT]... [FIL]...

BESKRIVNING
       sed läser filer (eller standard input) rad för rad, kör SKRIPT på
       varje rad och skriver ut resultatet. Filen ändras inte – om du inte
       använder -i.

       Ett skript består av kommandon, valfritt med en ADRESS framför som
       väljer vilka rader kommandot gäller. Flera kommandon skiljs åt med ;
       eller ges med flera -e.

FLAGGOR
       -n        skriv bara ut det som p-kommandot ber om
       -E, -r    utökade reguljära uttryck (som grep -E)
       -i[SUFFIX]
                 ändra filen på plats (in-place). Med SUFFIX sparas en
                 säkerhetskopia, t.ex. -i.bak
       -e SKRIPT lägg till SKRIPT (kan anges flera gånger)

KOMMANDON
       s/MÖNSTER/ERSÄTTNING/FLAGGOR
                 byt ut (substitute). FLAGGOR: g = alla träffar på raden,
                 i = skiftlägesokänsligt, p = skriv ut raden, N = bara
                 träff nummer N. I ERSÄTTNING betyder & hela träffen och
                 \1 ... \9 grupperna \( \) (eller ( ) med -E).
                 Vilket tecken som helst kan avgränsa: s|/usr|/opt|
       d         ta bort raden (delete)
       p         skriv ut raden (print) – oftast tillsammans med -n
       q         avsluta (quit) efter den här raden
       y/abc/xyz/   byt tecken mot tecken
       =         skriv ut radnumret
       a TEXT, i TEXT, c TEXT
                 lägg till text efter / före raden, eller ersätt raden

ADRESSER
       5         rad 5
       1~2       varannan rad (första~steg)
       $         sista raden
       /regex/   rader som matchar
       2,4       rad 2 till 4
       /a/,/b/   från en rad som matchar a till nästa som matchar b
       ADRESS!   alla rader UTOM de som matchar

EXEMPEL
       sed 's/ERROR/FEL/' server.log
       sed -n '5,8p' server.log
       sed '/^#/d' inställningar.conf
       sed -i 's/gammal/ny/g' fil.txt
       sed -E 's/([0-9]+)-([0-9]+)/\2-\1/' datum.txt

SIMULATORN
       Stöder s, d, p, q, Q, y, =, a, i och c. Kommandon som arbetar med
       hållutrymmet (h, H, g, G, x), hopp (b, t) och { } stöds inte.
""",
        Run = ctx =>
        {
            var scripts = new List<string>();
            var operands = new List<string>();
            bool quiet = false;
            bool ere = false;
            string? inPlace = null;
            int Bad(string msg)
            {
                ctx.Err($"sed: {msg}\nUsage: sed [OPTION]... {{script-only-if-no-other-script}} [input-file]...\n");
                return 1;
            }
            var args = ctx.Args;
            for (int k = 0; k < args.Count; k++)
            {
                var a = args[k];
                if (a == "--")
                {
                    operands.AddRange(args.Skip(k + 1));
                    break;
                }
                if (a.StartsWith("--", StringComparison.Ordinal))
                {
                    int eq = a.IndexOf('=');
                    var key = eq >= 0 ? a[..eq] : a;
                    string? val = eq >= 0 ? a[(eq + 1)..] : null;
                    if (key == "--quiet" || key == "--silent") quiet = true;
                    else if (key == "--regexp-extended") ere = true;
                    else if (key == "--in-place") inPlace = val ?? "";
                    else if (key == "--expression")
                    {
                        var v = val ?? (++k < args.Count ? args[k] : null);
                        if (v is null) return Bad("option '--expression' requires an argument");
                        scripts.Add(v);
                    }
                    else return Bad($"unrecognized option '{a}'");
                    continue;
                }
                if (a.StartsWith('-') && a.Length > 1)
                {
                    for (int j = 1; j < a.Length; j++)
                    {
                        char c = a[j];
                        if (c == 'n') quiet = true;
                        else if (c == 'E' || c == 'r') ere = true;
                        else if (c == 's' || c == 'u') continue;
                        else if (c == 'i')
                        {
                            inPlace = a[(j + 1)..];
                            break;
                        }
                        else if (c == 'e' || c == 'f')
                        {
                            var rest = a[(j + 1)..];
                            var v = rest != "" ? rest : (++k < args.Count ? args[k] : null);
                            if (v is null) return Bad($"option requires an argument -- '{c}'");
                            if (c == 'e') scripts.Add(v);
                            else
                            {
                                try
                                {
                                    var text = ctx.Sh.Vfs.ReadFile(ctx.Sh.Resolve(v), ctx.Sh.CurrentUser());
                                    scripts.Add(text.EndsWith('\n') ? text[..^1] : text);
                                }
                                catch (FsError e)
                                {
                                    ctx.Err($"sed: couldn't open file {v}: {e.Message}\n");
                                    return 1;
                                }
                            }
                            break;
                        }
                        else return Bad($"invalid option -- '{c}'");
                    }
                    continue;
                }
                operands.Add(a);
            }
            if (scripts.Count == 0)
            {
                if (operands.Count == 0)
                {
                    ctx.Err(
                        "Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\n" +
                        "  -n, --quiet, --silent\n                 suppress automatic printing of pattern space\n" +
                        "  -e script, --expression=script\n                 add the script to the commands to be executed\n" +
                        "  -i[SUFFIX], --in-place[=SUFFIX]\n                 edit files in place (makes backup if SUFFIX supplied)\n" +
                        "  -E, -r, --regexp-extended\n                 use extended regular expressions in the script\n");
                    return 1;
                }
                scripts.Add(operands[0]);
                operands.RemoveAt(0);
            }

            var cmds = new List<SedCommand>();
            var state = new SedState();
            try
            {
                for (int k = 0; k < scripts.Count; k++) ParseSedScript(scripts[k], k + 1, ere, state, cmds);
            }
            catch (SedError e)
            {
                ctx.Err($"sed: {e.Message}\n");
                return 1;
            }
            catch (SedUnsupported e)
            {
                ctx.Err($"sed: unsupported command: `{e.Message}'\n");
                DimNote(ctx, "textproc.sedUnsupported", ("command", e.Message));
                return 1;
            }

            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var run = new SedRun();
            int code = 0;

            if (inPlace is not null)
            {
                if (operands.Count == 0)
                {
                    ctx.Err("sed: no input files\n");
                    return 1;
                }
                foreach (var f in operands)
                {
                    var path = sh.Resolve(f);
                    var node = sh.Vfs.TryLookup(path, user);
                    if (node?.Type == "dir")
                    {
                        ctx.Err($"sed: couldn't edit {f}: not a regular file\n");
                        code = 4;
                        continue;
                    }
                    string content;
                    try
                    {
                        content = sh.Vfs.ReadFile(path, user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: can't read {f}: {e.Message}\n");
                        code = 2;
                        continue;
                    }
                    var result = new StringBuilder();
                    RunSedStream(cmds, content, quiet, s => result.Append(s), run);
                    try
                    {
                        if (inPlace != "") sh.Vfs.WriteFile(sh.Resolve(f + inPlace), content, user);
                        sh.Vfs.WriteFile(path, result.ToString(), user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: couldn't open temporary file {VfsLib.Dirname(path)}/sedXyZ12a: {e.Message}\n");
                        code = 4;
                    }
                    if (run.Quit) break;
                }
                return run.Quit ? ExitCodeOf(run.ExitCode) : code;
            }

            // Without -i every file is read as one long stream.
            var all = new StringBuilder();
            foreach (var f in operands.Count > 0 ? operands : new List<string> { "-" })
            {
                string text;
                if (f == "-") text = ctx.Stdin ?? "";
                else
                {
                    var path = sh.Resolve(f);
                    if (sh.Vfs.TryLookup(path, user)?.Type == "dir")
                    {
                        ctx.Err($"sed: read error on {f}: Is a directory\n");
                        code = 2;
                        continue;
                    }
                    try
                    {
                        text = sh.Vfs.ReadFile(path, user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: can't read {f}: {e.Message}\n");
                        code = 2;
                        continue;
                    }
                }
                if (all.Length > 0 && all[^1] != '\n') all.Append('\n');
                all.Append(text);
            }
            RunSedStream(cmds, all.ToString(), quiet, s => ctx.Out(s), run);
            return run.Quit ? ExitCodeOf(run.ExitCode) : code;
        },
    };

    // =====================================================================
    // awk
    // =====================================================================


    private static readonly CommandDef Awk = new()
    {
        Name = "awk",
        Summary = "Bearbetar text kolumn för kolumn (ett litet programspråk)",
        Man = """
NAMN
       awk - mönsterstyrt språk för att bearbeta text i kolumner

SYNOPSIS
       awk [-F AVGRÄNSARE] [-v VAR=VÄRDE] 'PROGRAM' [FIL]...
       awk [-F AVGRÄNSARE] -f PROGRAMFIL [FIL]...

BESKRIVNING
       awk läser filer (eller standard input) rad för rad och delar upp
       varje rad i fält. Fälten heter $1, $2, ... och hela raden $0.
       Standard är att fälten skiljs åt av mellanslag och tabbar.

       Ett PROGRAM består av par: MÖNSTER { ÅTGÄRD }
       Åtgärden körs för varje rad som matchar mönstret. Utan mönster körs
       den för alla rader; utan åtgärd skrivs raden ut.

FLAGGOR
       -F TECKEN   fältavgränsare, t.ex. -F: eller -F,
       -v VAR=VÄRDE
                   sätt en variabel innan programmet startar
       -f FIL      läs programmet från FIL

MÖNSTER
       BEGIN { ... }      körs en gång innan första raden
       END { ... }        körs en gång efter sista raden
       /regex/            rader som matchar
       $3 > 10            jämförelser: == != < <= > >=
       $1 ~ /^a/          fält som matchar (!~ = matchar inte)
       NR > 1 && $2 == "x"    && (och), || (eller), ! (inte)

ÅTGÄRDER
       print $1, $3       komma ger mellanslag (OFS) mellan fälten
       printf "%-10s %5.1f\n", $1, $2
       summa += $3        variabler behöver inte deklareras
       antal[$1]++        arrayer med text som index
       if (...) ... else ...   while (...) ...   for (i = 1; i <= NF; i++) ...
       for (nyckel in antal) ...   next   exit

INBYGGDA VARIABLER
       NR    radnummer         NF    antal fält på raden
       $NF   sista fältet      FS / OFS   fältavgränsare in / ut
       FILENAME              filen som läses

FUNKTIONER
       length(s)  substr(s, start, antal)  index(s, t)  split(s, arr, sep)
       sub(/re/, "ny")  gsub(/re/, "ny")  match(s, /re/)  sprintf(...)
       toupper(s)  tolower(s)  int(x)  sqrt(x)

EXEMPEL
       awk '{print $1}' fil.txt
       awk -F: '{print $1, $7}' /etc/passwd
       awk -F, 'NR > 1 {summa += $3} END {print summa}' betyg.csv
       awk '$3 > 50 {print NR": "$0}' data.txt
       ls -l | awk '{print $5, $NF}'

SIMULATORN
       Egna funktioner (function), getline, omdirigering av utdata
       (print > fil) och intervallmönster stöds inte.
""",
        Run = ctx =>
        {
            var args = ctx.Args;
            var assigns = new List<(string Name, string Value)>();
            string? fs = null;
            string? program = null;
            var label = "cmd. line";
            int Usage()
            {
                ctx.Err("Usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nUsage: awk [POSIX or GNU style options] [--] 'program' file ...\n");
                return 2;
            }
            int k = 0;
            for (; k < args.Count; k++)
            {
                var a = args[k];
                if (a == "--")
                {
                    k++;
                    break;
                }
                if (!a.StartsWith('-') || a == "-") break;
                char opt = a[1];
                if (opt == 'F' || opt == 'v' || opt == 'f')
                {
                    var v = a.Length > 2 ? a[2..] : (++k < args.Count ? args[k] : null);
                    if (v is null)
                    {
                        ctx.Err($"awk: option requires an argument -- {opt}\n");
                        return Usage();
                    }
                    if (opt == 'F') fs = v;
                    else if (opt == 'v')
                    {
                        int eq = v.IndexOf('=');
                        if (eq < 1)
                        {
                            ctx.Err($"awk: `{v}' argument to `-v' not in `var=value' form\n");
                            return Usage();
                        }
                        assigns.Add((v[..eq], v[(eq + 1)..]));
                    }
                    else
                    {
                        try
                        {
                            program = ctx.Sh.Vfs.ReadFile(ctx.Sh.Resolve(v), ctx.Sh.CurrentUser());
                            label = v;
                        }
                        catch (FsError e)
                        {
                            ctx.Err($"awk: fatal: can't open source file `{v}' for reading: {e.Message}\n");
                            return 2;
                        }
                    }
                    continue;
                }
                ctx.Err($"awk: {(a.StartsWith("--", StringComparison.Ordinal) ? $"unrecognized option '{a}'" : $"invalid option -- '{opt}'")}\n");
                return Usage();
            }
            var operands = args.Slice(k);
            if (program is null)
            {
                if (operands.Count == 0) return Usage();
                program = operands[0];
                operands.RemoveAt(0);
            }

            List<Rule> rules;
            try
            {
                rules = AwkCmd.ParseAwk(program);
            }
            catch (AwkSyntaxError e)
            {
                var before = program[..Math.Min(e.Pos, program.Length)];
                int lineNo = before.Count(c => c == '\n') + 1;
                int lineStart = before.LastIndexOf('\n') + 1;
                int lineEnd = program.IndexOf('\n', lineStart);
                var srcLine = lineEnd < 0 ? program[lineStart..] : program[lineStart..lineEnd];
                var prefix = $"awk: {label}:{lineNo}: ";
                ctx.Err($"{prefix}{srcLine}\n{prefix}{" ".Repeat(e.Pos - lineStart)}^ {e.Message}\n");
                if (e.Unsupported is { } u)
                    DimNote(ctx, "textproc.awkUnsupported", ("feature", u.Describe(ctx.Sh)), ("note", ctx.Sh.Msg("textproc.awkNote")));
                else
                    DimNote(ctx, "textproc.awkNote");
                return 1;
            }

            var sh = ctx.Sh;
            var interp = new AwkInterpreter(rules, new AwkIO
            {
                // Debian and Ubuntu have mawk, which does not change å, ä and ö.
                AsciiCase = sh.Distro.Family == "debian",
                Out = s => ctx.Out(s),
                ReadInput = op =>
                {
                    var path = sh.Resolve(op);
                    if (sh.Vfs.TryLookup(path, sh.CurrentUser())?.Type == "dir")
                    {
                        ctx.Err($"awk: warning: command line argument `{op}' is a directory: skipped\n");
                        return null;
                    }
                    try
                    {
                        return new AwkInput { Name = op, Content = sh.Vfs.ReadFile(path, sh.CurrentUser()) };
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"awk: fatal: cannot open file `{op}' for reading: {e.Message}\n");
                        throw new AwkFatal("__reported__");
                    }
                },
            });
            if (fs is not null) interp.Assign("FS", fs == "t" ? "\t" : fs);
            foreach (var (name, value) in assigns) interp.Assign(name, value);
            try
            {
                return interp.Run(operands, ctx.Stdin ?? "");
            }
            catch (AwkFatal e)
            {
                if (e.Message == "__reported__") return 2;
                if (e.Message == "__steps__")
                {
                    ctx.Err($"awk: {label}: fatal: program stopped\n");
                    DimNote(ctx, "textproc.awkTooManySteps");
                }
                else ctx.Err($"awk: {label}:1: fatal: {e.Message}\n");
                return 2;
            }
        },
    };

    public static List<CommandDef> All { get; } = new() { Tr, Sed, Awk };
}
