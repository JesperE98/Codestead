namespace Codestead.Shell;

// Shell: variables and expansion – $VAR, ${...}, $(...), $((...)), word splitting and wildcards.

public partial class Shell
{
    // ---------- Variables and expansion ----------

    public string? GetVar(string name)
    {
        if (name == "RANDOM") return ((int)Math.Floor(Js.Random() * 32768)).ToString(CultureInfo.InvariantCulture);
        if (name == "PWD") return Cwd;
        if (name == "UID") return CurrentUser().Uid.ToString(CultureInfo.InvariantCulture);
        if (name == "ZSH_VERSION" && ShellMode == "zsh") return ShellmodeLib.ZshVersion;
        if (name == "FISH_VERSION" && ShellMode == "fish") return ShellmodeLib.FishVersion(this);
        return Env.TryGetValue(name, out var v) ? v : null;
    }

    public void SetVar(string name, string value) => Env[name] = value;

    private static readonly Regex TrailingNewlines = new("\n+\\z", RegexOptions.CultureInvariant);

    /// <summary>Runs code and returns its output (for $(...) and `...`).</summary>
    private string CaptureOutput(string code, Sink io)
    {
        Node ast;
        try
        {
            ast = ParserLib.Parse(code);
        }
        catch (ParseError e)
        {
            io.Err($"bash: command substitution: {e.Message}\n");
            return "";
        }
        var buf = new StringBuilder();
        var saved = (Cwd, Env: Js.Copy(Env), Functions: Js.Copy(Functions));
        var savedPending = PendingQuestion;
        substDepth++;
        try
        {
            Exec(ast, new XIO(s => buf.Append(s), io.ErrFn, null, false));
        }
        catch (ExitSignal e)
        {
            LastExit = e.Code;
        }
        finally
        {
            substDepth--;
            int exit = LastExit;
            Cwd = saved.Cwd;
            Env = saved.Env;
            Functions = saved.Functions;
            LastExit = exit;
            PendingQuestion = savedPending;
        }
        return TrailingNewlines.Replace(buf.ToString(), "");
    }

    private static readonly Regex ParamNameRe = new(@"^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?])(.*)\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex ParamOpRe = new(@"^(:-|:=|:\+|:\?|-|=|\+|\?|##|#|%%|%)(.*)\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);

    /// <summary>${...}: ${NAME}, ${#NAME}, ${NAME:-default}, ${NAME%.txt} and more.</summary>
    private string ParamExpand(string inner, Sink io)
    {
        if (inner.StartsWith('#') && inner.Length > 1) return Js.CodePointLength(Special(inner[1..]) ?? "").ToString(CultureInfo.InvariantCulture);
        var m = ParamNameRe.Match(inner);
        if (!m.Success) throw new ExpansionError($"${{{inner}}}: bad substitution");
        var name = m.Groups[1].Value;
        var rest = m.Groups[2].Value;
        var value = Special(name);
        if (rest == "") return value ?? "";
        var op = ParamOpRe.Match(rest);
        if (!op.Success) throw new ExpansionError($"${{{inner}}}: bad substitution");
        var kind = op.Groups[1].Value;
        var arg = op.Groups[2].Value;
        string Word() => ExpandString(arg, io);
        bool unsetOrEmpty = kind.StartsWith(':') ? string.IsNullOrEmpty(value) : value is null;
        switch (kind)
        {
            case ":-":
            case "-":
                return unsetOrEmpty ? Word() : value!;
            case ":=":
            case "=":
                if (unsetOrEmpty) SetVar(name, Word());
                return Env.TryGetValue(name, out var assigned) ? assigned : "";
            case ":+":
            case "+":
                return unsetOrEmpty ? "" : Word();
            case ":?":
            case "?":
                if (unsetOrEmpty) throw new ExpansionError($"{name}: {(arg != "" ? arg : "parameter null or not set")}");
                return value!;
        }
        // Remove a prefix (#, ##) or suffix (%, %%) matching a pattern.
        var v = value ?? "";
        var re = ParserLib.GlobToRegex(ExpandString(arg, io), true);
        bool longest = kind.Length == 2;
        var cuts = Enumerable.Range(0, v.Length + 1).ToList();
        if (kind.StartsWith('#'))
        {
            foreach (var i in longest ? Enumerable.Reverse(cuts) : cuts) if (re.IsMatch(v[..i])) return v[i..];
        }
        else
        {
            foreach (var i in longest ? cuts : Enumerable.Reverse(cuts)) if (re.IsMatch(v[i..])) return v[..i];
        }
        return v;
    }

    private static readonly Regex DigitsRe = new("^[0-9]+\\z", RegexOptions.CultureInvariant);

    /// <summary>The value of an ordinary or special parameter ($1, $#, $? ...).</summary>
    private string? Special(string name)
    {
        var pos = positional.Count > 0 ? positional[^1] : new List<string> { ShellMode };
        if (DigitsRe.IsMatch(name))
        {
            return int.TryParse(name, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n < pos.Count ? pos[n] : null;
        }
        switch (name)
        {
            case "?":
                return LastExit.ToString(CultureInfo.InvariantCulture);
            case "#":
                return (pos.Count - 1).ToString(CultureInfo.InvariantCulture);
            case "@":
            case "*":
                return string.Join(" ", pos.Skip(1));
            case "$":
                return "4242";
            case "!":
                return LastBgPid is int bg ? bg.ToString(CultureInfo.InvariantCulture) : "";
            case "-":
                return "himBH";
        }
        return GetVar(name);
    }

    private sealed class Field
    {
        public string Value = "";
        public string Pattern = "";
        public bool HasGlob;
        public bool Touched;
    }

    private sealed class ScanEmit
    {
        public required Action<string> Literal;
        public required Action<string, bool> Expansion;
        public required Action<List<string>> Fields;
    }

    private static readonly Regex SplitRe = new("[ \t\n]+", RegexOptions.CultureInvariant);

    /// <summary>
    /// Expands a word into zero or more fields: ~, $VAR, ${...}, $(...), `...`, $((...)),
    /// word splitting of unquoted expansions, and wildcards.
    /// </summary>
    public List<string> ExpandWord(Word w, Sink? io = null, bool split = true, bool glob = true)
    {
        io ??= Sink.Null();
        var fields = new List<Field>();
        var cur = new Field();
        fields.Add(cur);
        void NewField()
        {
            cur = new Field();
            fields.Add(cur);
        }
        void Literal(string text, bool quoted)
        {
            cur.Value += text;
            cur.Pattern += quoted ? ParserLib.EscapeGlob(text) : text;
            if (!quoted && ParserLib.HasUnescapedGlob(text)) cur.HasGlob = true;
            cur.Touched = true;
        }
        // zsh does not split unquoted $variables at spaces (unless setopt shwordsplit).
        bool zshParams = ShellMode == "zsh" && !(ShellStack.Count > 0 && ShellStack[^1].Options.TryGetValue("shwordsplit", out var sws) && sws);
        void Expansion(string text, bool quoted, bool param)
        {
            if (param && zshParams && !quoted)
            {
                if (text != "") Literal(text, true);
                return;
            }
            if (quoted || !split)
            {
                Literal(text, quoted);
                return;
            }
            var pieces = SplitRe.Split(text);
            for (int idx = 0; idx < pieces.Length; idx++)
            {
                if (idx > 0 && cur.Touched) NewField();
                if (pieces[idx] != "") Literal(pieces[idx], false);
            }
        }

        try
        {
            for (int idx = 0; idx < w.Parts.Count; idx++)
            {
                var part = w.Parts[idx];
                if (part.Quoted == "single")
                {
                    Literal(part.Text, true);
                    continue;
                }
                var text = part.Text;
                bool quoted = part.Quoted == "double";
                if (idx == 0 && !quoted && (text == "~" || text.StartsWith("~/", StringComparison.Ordinal)))
                {
                    Literal(Home, true);
                    text = text[1..];
                }
                if (quoted && text != "$@") cur.Touched = true;
                Scan(text, io, new ScanEmit
                {
                    Literal = t => Literal(t, quoted),
                    Expansion = (t, param) => Expansion(t, quoted, param),
                    Fields = list =>
                    {
                        // "$@" becomes one field per argument.
                        if (!quoted)
                        {
                            Expansion(string.Join(" ", list), false, false);
                            return;
                        }
                        for (int i = 0; i < list.Count; i++)
                        {
                            if (i > 0) NewField();
                            Literal(list[i], true);
                        }
                    },
                });
            }
        }
        catch (ExpansionError e)
        {
            io.Err($"bash: {e.Message}\n");
            return new List<string>();
        }

        var result = new List<string>();
        foreach (var f in fields)
        {
            if (!f.Touched) continue;
            if (glob && f.HasGlob)
            {
                var matches = Glob(f.Pattern);
                if (matches.Count > 0)
                {
                    result.AddRange(matches);
                    continue;
                }
            }
            result.Add(f.Value);
        }
        return result;
    }

    /// <summary>Expands a pattern (for case and ${x%pattern}) without matching against files.</summary>
    private string ExpandPattern(Word w, Sink io)
    {
        var pattern = new StringBuilder();
        foreach (var part in w.Parts)
        {
            if (part.Quoted == "single")
            {
                pattern.Append(ParserLib.EscapeGlob(part.Text));
            }
            else
            {
                bool quoted = part.Quoted == "double";
                Scan(part.Text, io, new ScanEmit
                {
                    Literal = t => pattern.Append(quoted ? ParserLib.EscapeGlob(t) : t),
                    Expansion = (t, _) => pattern.Append(quoted ? ParserLib.EscapeGlob(t) : t),
                    Fields = l => pattern.Append(string.Join(" ", l)),
                });
            }
        }
        return pattern.ToString();
    }

    /// <summary>Expands text as if it stood inside double quotes.</summary>
    public string ExpandString(string text, Sink? io = null)
    {
        io ??= Sink.Null();
        var result = new StringBuilder();
        Scan(text, io, new ScanEmit
        {
            Literal = t => result.Append(t),
            Expansion = (t, _) => result.Append(t),
            Fields = l => result.Append(string.Join(" ", l)),
        });
        return result.ToString();
    }

    private static readonly Regex VarNameRe = new("^[A-Za-z_][A-Za-z0-9_]*", RegexOptions.CultureInvariant);
    private static readonly Regex SpecialCharRe = new("^[0-9?#$!-]\\z", RegexOptions.CultureInvariant);

    /// <summary>Walks through text and finds $-expressions and `...`.</summary>
    private void Scan(string text, Sink io, ScanEmit emit)
    {
        var lit = new StringBuilder();
        void Flush()
        {
            if (lit.Length > 0) emit.Literal(lit.ToString());
            lit.Clear();
        }
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (c == '`')
            {
                int j = i + 1;
                while (j < text.Length && text[j] != '`') j += text[j] == '\\' ? 2 : 1;
                Flush();
                emit.Expansion(CaptureOutput(text.Slice(i + 1, j).Replace("\\`", "`"), io), false);
                i = j;
                continue;
            }
            if (c != '$' || i + 1 >= text.Length)
            {
                lit.Append(c);
                continue;
            }
            char next = text[i + 1];
            if (next == '(')
            {
                int j = ParserLib.FindClosingParen(text, i + 1);
                if (j < 0)
                {
                    lit.Append(c);
                    continue;
                }
                Flush();
                if (i + 2 < text.Length && text[i + 2] == '(' && text[j - 1] == ')')
                {
                    var expr = text.Slice(i + 3, j - 1);
                    var r = Arith(expr, io);
                    if (!r.Ok) throw new ExpansionError($"{expr}: arithmetic error");
                    emit.Expansion(r.Value.ToString(CultureInfo.InvariantCulture), false);
                }
                else
                {
                    emit.Expansion(CaptureOutput(text.Slice(i + 2, j), io), false);
                }
                i = j;
                continue;
            }
            if (next == '{')
            {
                int j = text.IndexOf('}', i);
                if (j < 0)
                {
                    lit.Append(c);
                    continue;
                }
                Flush();
                emit.Expansion(ParamExpand(text.Slice(i + 2, j), io), true);
                i = j;
                continue;
            }
            var nm = VarNameRe.Match(text[(i + 1)..]);
            if (nm.Success)
            {
                Flush();
                emit.Expansion(GetVar(nm.Value) ?? "", true);
                i += nm.Value.Length;
                continue;
            }
            if (next == '@' || next == '*')
            {
                Flush();
                emit.Fields(Args);
                i++;
                continue;
            }
            if (SpecialCharRe.IsMatch(next.ToString()))
            {
                Flush();
                emit.Expansion(Special(next.ToString()) ?? "", true);
                i++;
                continue;
            }
            lit.Append(c);
        }
        Flush();
    }

    public List<string> Glob(string pattern)
    {
        var user = CurrentUser();
        bool abs = pattern.StartsWith('/');
        var segs = pattern.Split('/').Where(s => s != "").ToList();
        var results = new List<string> { abs ? "/" : "" };
        static string Join(string b, string name) => b == "" ? name : b == "/" ? $"/{name}" : $"{b}/{name}";
        foreach (var seg in segs)
        {
            var next = new List<string>();
            foreach (var b in results)
            {
                if (seg == "**" && ShellMode != "bash")
                {
                    // zsh and fish: ** matches every subdirectory, on every level (also none at all).
                    void Walk(string dir)
                    {
                        next.Add(dir);
                        var node = Vfs.TryLookup(Resolve(dir == "" ? "." : dir), user);
                        if (node is null || node.Type != "dir" || !VfsLib.HasPerm(node, user, 'r')) return;
                        foreach (var name in node.Children!.Keys.ToList().SortJs())
                        {
                            if (!name.StartsWith('.') && node.Children[name].Type == "dir") Walk(Join(dir, name));
                        }
                    }
                    Walk(b);
                    continue;
                }
                if (!ParserLib.HasUnescapedGlob(seg))
                {
                    next.Add(Join(b, ParserLib.UnescapeGlob(seg)));
                    continue;
                }
                var dirNode = Vfs.TryLookup(Resolve(b == "" ? "." : b), user);
                if (dirNode is null || dirNode.Type != "dir" || !VfsLib.HasPerm(dirNode, user, 'r')) continue;
                var re = ParserLib.GlobToRegex(seg);
                foreach (var name in dirNode.Children!.Keys.ToList().SortJs())
                {
                    if (name.StartsWith('.') && !seg.StartsWith('.')) continue;
                    if (re.IsMatch(name)) next.Add(Join(b, name));
                }
            }
            results = next;
        }
        // Broken symbolic links match too (they exist, even if what they point to does not).
        var found = results.Where(r => r != "" && Vfs.TryLookupLink(Resolve(r), user) is not null).ToList();
        return segs.Contains("**") && ShellMode != "bash" ? found.SortJs() : found;
    }
}
