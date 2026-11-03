namespace Codestead.Shell.Commands;

// sed: the parsed script (addresses, commands) and the parser.

public static partial class TextprocCmd
{
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
}
