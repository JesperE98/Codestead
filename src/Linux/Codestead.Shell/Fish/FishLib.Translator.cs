namespace Codestead.Shell;

// FishLib: the translator that turns fish tokens into bash code.

public static partial class FishLib
{
    private sealed class Block
    {
        /// <summary>"if", "for", "while", "function", "begin" or "switch".</summary>
        public string Kind { get; init; } = "";
        public int Cases { get; set; }
    }

    private sealed class FishTranslator
    {
        private string output = "";
        private string? pending;
        private bool needSep;
        private readonly List<Block> blocks = new();
        private readonly string lang;

        public FishTranslator(string lang) => this.lang = lang;

        public string Translate(string text)
        {
            var toks = Lex(text);
            var stmt = new List<FTok>();
            foreach (var t in toks)
            {
                if (t.T == "op" && (t.Op == ";" || t.Op == "&"))
                {
                    if (stmt.Count > 0) Statement(stmt);
                    else if (t.Op == "&") throw FishError("Unexpected '&' found");
                    if (t.Op == "&" && stmt.Count > 0)
                    {
                        output += " &";
                        needSep = false;
                    }
                    stmt = new List<FTok>();
                }
                else
                {
                    stmt.Add(t);
                }
            }
            if (stmt.Count > 0) Statement(stmt);
            if (blocks.Count > 0)
            {
                throw FishError($"Missing end to balance this {blocks[^1].Kind} block", true);
            }
            return output;
        }

        private void Emit(string code)
        {
            if (pending is not null)
            {
                output += pending + " ";
                pending = null;
            }
            else if (needSep)
            {
                output += "; ";
            }
            else if (output != "" && !output.EndsWith(' '))
            {
                output += " ";
            }
            output += code;
            needSep = true;
        }

        private void Open(string kind, string header, string after)
        {
            Emit(header);
            blocks.Add(new Block { Kind = kind, Cases = 0 });
            pending = after;
        }

        private void Statement(List<FTok> toks)
        {
            var kw = Bare(toks.At(0));
            var rest = toks.Slice(1);
            switch (kw)
            {
                case "if":
                    Open("if", $"if {Commands(rest)}", "; then");
                    return;
                case "while":
                    Open("while", $"while {Commands(rest)}", "; do");
                    return;
                case "else":
                {
                    var top = blocks.At(-1);
                    if (top?.Kind != "if") throw FishError("'else' builtin not inside of if block");
                    if (Bare(rest.At(0)) == "if")
                    {
                        Emit($"elif {Commands(rest.Slice(1))}");
                        pending = "; then";
                    }
                    else
                    {
                        Emit("else");
                        pending = "";
                        if (rest.Count > 0) Statement(rest);
                    }
                    return;
                }
                case "for":
                {
                    var name = Bare(rest.At(0));
                    if (string.IsNullOrEmpty(name) || !IdentRe.IsMatch(name)) throw FishError("for: Variable name '' is not valid. See `help identifiers`.");
                    if (Bare(rest.At(1)) != "in") throw FishError("for: Expected 'in'");
                    Open("for", $"for {name} in {Words(rest.Slice(2))}".TrimEnd(), "; do");
                    return;
                }
                case "function":
                    FunctionHeader(rest);
                    return;
                case "begin":
                    Open("begin", "{", "");
                    if (rest.Count > 0) Statement(rest);
                    return;
                case "switch":
                    Open("switch", $"case {Words(rest)} in", "");
                    return;
                case "case":
                {
                    var top = blocks.At(-1);
                    if (top?.Kind != "switch") throw FishError("case: 'case' builtin not inside of switch block");
                    var patterns = rest.Where(t => t.T == "word").Select(t => Unquote(t.Raw)).ToList();
                    var joined = string.Join("|", patterns);
                    output += (top.Cases++ > 0 ? " ;; " : " ") + (joined != "" ? joined : "\"\"") + ")";
                    pending = "";
                    needSep = false;
                    return;
                }
                case "end":
                {
                    if (blocks.Count == 0) throw FishError("'end' outside of a block");
                    var top = blocks[^1];
                    blocks.RemoveAt(blocks.Count - 1);
                    if (pending is not null)
                    {
                        // Empty block – bash needs at least one command.
                        if (top.Kind != "switch") Emit("true");
                        pending = null;
                    }
                    var close = top.Kind switch
                    {
                        "if" => "fi",
                        "for" => "done",
                        "while" => "done",
                        "function" => "}",
                        "begin" => "}",
                        _ => "esac",
                    };
                    if (top.Kind == "switch")
                    {
                        output += top.Cases > 0 ? " ;; esac" : " esac";
                        needSep = true;
                    }
                    else
                    {
                        Emit(close);
                    }
                    // Redirections and pipes after end: "end < file", "end | sort".
                    if (rest.Count > 0) output += " " + Commands(rest, false);
                    return;
                }
                case "and":
                case "or":
                    if (output == "") throw FishError($"'{kw}' must follow a command");
                    if (rest.Count == 0) throw FishError($"Missing command after '{kw}'");
                    output += (kw == "and" ? " && " : " || ") + Commands(rest);
                    return;
            }
            Emit(Commands(toks));
        }

        /// <summary>function name [--argument-names a b] [--description text]</summary>
        private void FunctionHeader(List<FTok> rest)
        {
            var first = rest.At(0);
            var name = Bare(first) ?? (first?.T == "word" ? first.Raw : "");
            if (name == "" || name.StartsWith('-')) throw FishError("function: Expected function name");
            var argNames = new List<string>();
            string? mode = null; // "args" | "skip" | null
            foreach (var t in rest.Slice(1))
            {
                if (t.T != "word") continue;
                if (t.Raw == "--argument-names" || t.Raw == "-a") mode = "args";
                else if (t.Raw == "--description" || t.Raw == "-d" || t.Raw == "--wraps" || t.Raw == "-w") mode = "skip";
                else if (t.Raw.StartsWith('-')) mode = null;
                else if (mode == "args") argNames.Add(t.Raw);
                else if (mode == "skip") mode = null;
            }
            Open("function", $"{name}() {{", "");
            for (int i = 0; i < argNames.Count; i++) Emit($"local {argNames[i]}=\"${{{i + 1}}}\"");
        }

        /// <summary>One or more commands with | &amp;&amp; || between them.</summary>
        private string Commands(List<FTok> toks, bool cmdPos = true)
        {
            var parts = new List<string>();
            var words = new List<string>();
            bool first = cmdPos;
            string? cmdName = null;
            bool assignOnly = true;
            string assignWord = "";
            void Flush()
            {
                if (cmdPos && words.Count > 0 && assignOnly && assignWord != "")
                {
                    var m = AssignWordRe.Match(assignWord);
                    var name = m.Groups[1].Value;
                    var value = m.Groups[2].Value;
                    var shown = value != "" ? $" {value}" : "";
                    throw FishError(
                        $"Unsupported use of '='. In fish, please use 'set {name}{shown}'.\n{assignWord}\n" +
                        (assignWord.Length > 1 ? $"^{"~".Repeat(assignWord.Length - 2)}^" : "^"));
                }
                parts.Add(string.Join(" ", words));
                words = new List<string>();
                first = true;
                assignOnly = true;
                assignWord = "";
                cmdName = null;
            }
            foreach (var t in toks)
            {
                if (t.T == "op")
                {
                    Flush();
                    parts.Add(t.Op);
                    continue;
                }
                if (first)
                {
                    // Variable assignments before the command (X=1 command) work in fish 3.1+.
                    if (AssignPrefixRe.IsMatch(t.Raw))
                    {
                        if (assignWord == "") assignWord = t.Raw;
                        words.Add(Word(t.Raw));
                        continue;
                    }
                    first = false;
                    assignOnly = false;
                    if (t.Raw == "not" || t.Raw == "!")
                    {
                        words.Add("!");
                        first = true;
                        continue;
                    }
                    if (BashOnly.Contains(t.Raw))
                    {
                        throw FishError(
                            $"Unknown command: {t.Raw}\n{Dim}{ShellI18n.Msg(lang, "fish.bashSyntax")}{Reset}");
                    }
                    cmdName = t.Raw;
                    if (FishBuiltins.TryGetValue(t.Raw, out var builtin))
                    {
                        words.Add(builtin);
                        continue;
                    }
                    words.Add(Word(t.Raw));
                    continue;
                }
                if (cmdName == "read" && ReadScopeRe.IsMatch(t.Raw)) continue;
                if (cmdName == "read" && t.Raw == "-P")
                {
                    words.Add("-p");
                    continue;
                }
                if (cmdName == "alias" && words.Count == 2 && !words[1].Contains('='))
                {
                    // fish: alias ll 'ls -l'  ->  alias ll='ls -l'
                    words[1] += "=" + Word(t.Raw);
                    continue;
                }
                words.Add(Word(t.Raw));
            }
            Flush();
            return string.Join(" ", parts).Trim();
        }

        private string Words(List<FTok> toks) => string.Join(" ", toks.Select(t => t.T == "word" ? Word(t.Raw) : t.Op));

        /// <summary>Translates a word: (command), $argv, $status, {$VAR} …</summary>
        private string Word(string raw)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < raw.Length;)
            {
                char c = raw[i];
                if (c == '\\')
                {
                    sb.Append(raw.Slice(i, i + 2));
                    i += 2;
                }
                else if (c == '\'')
                {
                    int j = ClosingQuote(raw, i);
                    // fish allows \' inside single quotes – bash does not.
                    sb.Append('\'').Append(raw.Slice(i + 1, j).Replace("\\'", "'\\''").Replace("\\\\", "\\")).Append('\'');
                    i = j + 1;
                }
                else if (c == '"')
                {
                    int j = ClosingQuote(raw, i);
                    sb.Append('"').Append(Dollars(raw.Slice(i + 1, j), true)).Append('"');
                    i = j + 1;
                }
                else if (c == '(')
                {
                    int j = ClosingParen(raw, i);
                    sb.Append("$(").Append(Sub(raw.Slice(i + 1, j))).Append(')');
                    i = j + 1;
                }
                else if (c == '{' && BracedVarRe.IsMatch(raw.Slice(i)))
                {
                    var name = BracedVarRe.Match(raw.Slice(i)).Groups[1].Value;
                    sb.Append(Variable(name, "", false));
                    i += name.Length + 3;
                }
                else if (c == '$')
                {
                    var (text, len) = Dollar(raw.Slice(i), false);
                    sb.Append(text);
                    i += len;
                }
                else
                {
                    sb.Append(c);
                    i++;
                }
            }
            return sb.ToString();
        }

        /// <summary>Text inside double quotes: only $ expressions are translated.</summary>
        private string Dollars(string text, bool quoted)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < text.Length;)
            {
                if (text[i] == '\\')
                {
                    sb.Append(text.Slice(i, i + 2));
                    i += 2;
                }
                else if (text[i] == '$')
                {
                    var (t, len) = Dollar(text.Slice(i), quoted);
                    sb.Append(t);
                    i += len;
                }
                else
                {
                    sb.Append(text[i++]);
                }
            }
            return sb.ToString();
        }

        /// <summary>A $ expression at the start of s. Returns (bash text, number of characters).</summary>
        private (string Text, int Len) Dollar(string s, bool quoted)
        {
            var next = s.CharAt(1);
            if (next == "(")
            {
                if (s.CharAt(2) == "(") throw FishError("$((...)) is not supported. In fish, please use 'math'.");
                int j = ClosingParen(s, 1);
                return ("$(" + Sub(s.Slice(2, j)) + ")", j + 1);
            }
            if (next == "{")
            {
                var bm = BashBracketRe.Match(s);
                var name = bm.Success ? bm.Groups[1].Value : "VAR";
                throw FishError($"Variables cannot be bracketed. In fish, please use {{${name}}}.");
            }
            if (next != "" && DollarErrors.TryGetValue(next, out var error)) throw FishError(error);
            var m = DollarVarRe.Match(s);
            if (!m.Success) return ("$", 1);
            return (Variable(m.Groups[1].Value, m.Groups[2].Success ? m.Groups[2].Value : "", quoted), m.Length);
        }

        private static string Variable(string name, string index, bool quoted)
        {
            if (name == "argv")
                return index != "" ? (Js.Number(index) > 0 ? $"${{{index}}}" : $"$(__fish_index {index} \"$@\")") : quoted ? "$*" : "$@";
            if (name == "status") return "$?";
            if (name == "fish_pid") return "$$";
            if (index != "") return $"$(__fish_index {index} ${{{name}}})";
            return $"${{{name}}}";
        }

        /// <summary>Code inside (…): translated on its own.</summary>
        private string Sub(string code) => new FishTranslator(lang).Translate(code);
    }
}
