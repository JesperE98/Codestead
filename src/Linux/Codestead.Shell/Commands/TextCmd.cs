namespace Codestead.Shell.Commands;

// Port of src/shell/commands/text.ts – text commands: echo, cat, less, head, tail, wc, grep, sort, uniq, cut, tee.

public static partial class TextCmd
{
    // ---------- JavaScript helpers shared by the basic commands ----------

    /// <summary>The characters JavaScript's \s and String.prototype.trim treat as white space.</summary>
    internal const string JsWhitespaceClass = "[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

    private static readonly char[] JsWhitespaceChars =
    {
        '\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
        '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff',
    };

    private static readonly Regex JsWhitespaceRun = new(JsWhitespaceClass + "+", RegexOptions.CultureInvariant);
    private static readonly Regex JsWhitespaceOne = new(JsWhitespaceClass, RegexOptions.CultureInvariant);

    /// <summary>s.trim() in JavaScript.</summary>
    internal static string JsTrim(string s) => s.Trim(JsWhitespaceChars);

    /// <summary>s.split(/\s+/).filter(Boolean) in JavaScript.</summary>
    internal static List<string> SplitWords(string s) => JsWhitespaceRun.Split(s).Where(w => w != "").ToList();

    /// <summary>/\s/.test(s) in JavaScript.</summary>
    internal static bool HasJsWhitespace(string s) => JsWhitespaceOne.IsMatch(s);

    /// <summary>
    /// new RegExp(source, flags) in JavaScript. ECMAScript mode gives the JavaScript meaning of \w, \d and \b
    /// (ASCII only). Throws ArgumentException for an invalid pattern, like JavaScript throws SyntaxError.
    /// </summary>
    internal static Regex JsRegex(string source, bool ignoreCase = false)
    {
        var options = RegexOptions.ECMAScript | RegexOptions.CultureInvariant;
        if (ignoreCase) options |= RegexOptions.IgnoreCase;
        return new Regex(source, options);
    }

    // ---------- Commands ----------

    private static readonly Regex EchoFlagRe = new(@"^-[neE]+\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Echo = new()
    {
        Name = "echo",
        Builtin = true,
        Summary = "Skriver ut text",
        Man = """
NAMN
       echo - skriv ut en rad text

SYNOPSIS
       echo [-n] [-e] [TEXT]...

FLAGGOR
       -n    skriv inte ut någon radbrytning på slutet
       -e    tolka \n (ny rad) och \t (tabb)

EXEMPEL
       echo Hej världen
       echo "Min hemkatalog är $HOME"
       echo 'Enkla citattecken: $HOME skrivs ut som det står'
""",
        Run = ctx =>
        {
            bool newline = true;
            bool escapes = false;
            var args = ctx.Args.ToList();
            while (args.Count > 0 && EchoFlagRe.IsMatch(args[0]))
            {
                var f = args[0];
                args.RemoveAt(0);
                if (f.Contains('n')) newline = false;
                if (f.Contains('e')) escapes = true;
                if (f.Contains('E')) escapes = false;
            }
            var text = string.Join(" ", args);
            if (escapes) text = text.Replace("\\n", "\n").Replace("\\t", "\t").Replace("\\\\", "\\");
            ctx.Out(text + (newline ? "\n" : ""));
            return 0;
        },
    };

    private static CommandDef CatLike(string name, string summary, string man) => new()
    {
        Name = name,
        Summary = summary,
        Man = man,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "n", Long = new() { ["number"] = "n" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            int lineNo = 1;
            foreach (var input in inputs)
            {
                if (o.Flags.Contains("n"))
                {
                    foreach (var line in UtilCmd.SplitLines(input.Content)) ctx.Out($"{Js.Num(lineNo++).PadLeft(6)}\t{line}\n");
                }
                else
                {
                    ctx.Out(input.Content);
                }
            }
            return failed ? 1 : 0;
        },
    };

    private static readonly CommandDef Cat = CatLike(
        "cat",
        "Visar innehållet i filer",
        """
NAMN
       cat - slå ihop filer och skriv ut dem (concatenate)

SYNOPSIS
       cat [-n] [FIL]...

BESKRIVNING
       Skriver ut innehållet i en eller flera filer. Utan FIL läser cat
       från standard input, t.ex. från en pipe.

FLAGGOR
       -n    numrera raderna

EXEMPEL
       cat /etc/os-release
       cat del1.txt del2.txt > allt.txt
""");

    private static readonly CommandDef Less = CatLike(
        "less",
        "Bläddrar i en fil (sida för sida)",
        """
NAMN
       less - visa en fil en sida i taget

BESKRIVNING
       I en riktig terminal bläddrar du med piltangenterna, mellanslag och
       b, söker med /ord och avslutar med q. I simulatorn visas hela filen
       direkt.
""");

    private static readonly CommandDef More = CatLike(
        "more",
        "Visar en fil sida för sida (äldre variant av less)",
        """
NAMN
       more - visa en fil en sida i taget

BESKRIVNING
       Föregångaren till less. I simulatorn visas hela filen direkt.
""");

    private static readonly Regex DashNumberRe = new(@"^-[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingSignRe = new(@"^[+-]", RegexOptions.CultureInvariant);

    /// <summary>A JS number used as an array index (slice): NaN is 0, the rest is truncated and clamped.</summary>
    private static int ToIndex(double n) =>
        double.IsNaN(n) ? 0 : n >= int.MaxValue ? int.MaxValue : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);

    private static CommandDef HeadTail(string name)
    {
        var extra = name == "tail"
            ? "\n       -n +N              visa från och med rad N\n       -f                 följ filen när den växer (stöds inte i simulatorn)"
            : "";
        var man = "NAMN\n" +
            $"       {name} - visa {(name == "head" ? "de första" : "de sista")} raderna i filer\n" +
            "\n" +
            "SYNOPSIS\n" +
            $"       {name} [-n ANTAL] [FIL]...\n" +
            "\n" +
            "FLAGGOR\n" +
            $"       -n ANTAL, -ANTAL   visa ANTAL rader (standard är 10){extra}\n" +
            "\n" +
            "EXEMPEL\n" +
            $"       {name} -n 3 server.log\n" +
            $"       {(name == "head" ? "ls -l /etc | head -5" : "tail -n 20 /var/log/syslog")}";
        return new CommandDef
        {
            Name = name,
            Summary = name == "head" ? "Visar början av en fil" : "Visar slutet av en fil",
            Man = man,
            Run = ctx =>
            {
                var args = ctx.Args.Select(a => DashNumberRe.IsMatch(a) ? $"-n{a[1..]}" : a).ToList();
                var o = UtilCmd.ParseOpts(args, new OptSpec { Flags = "fqv", Values = "n", Long = new() { ["lines"] = "n", ["follow"] = "f" } });
                if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
                var spec = o.Values.Get("n") ?? "10";
                bool fromStart = name == "tail" && spec.StartsWith('+');
                double n = Js.Number(LeadingSignRe.Replace(spec, "", 1));
                if (double.IsNaN(n) || double.IsInfinity(n) || n != Math.Floor(n))
                {
                    ctx.Err($"{name}: invalid number of lines: '{spec}'\n");
                    return 1;
                }
                var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands, (l, m) => $"{name}: cannot open '{l}' for reading: {m}");
                for (int i = 0; i < inputs.Count; i++)
                {
                    var input = inputs[i];
                    if (inputs.Count > 1) ctx.Out($"{(i > 0 ? "\n" : "")}==> {input.Label} <==\n");
                    var lines = UtilCmd.SplitLines(input.Content);
                    var picked = name == "head"
                        ? Js.Slice(lines, 0, ToIndex(n))
                        : fromStart ? Js.Slice(lines, ToIndex(Math.Max(0, n - 1))) : n == 0 ? new List<string>() : Js.Slice(lines, ToIndex(-n));
                    ctx.Out(UtilCmd.JoinLines(picked));
                }
                if (o.Flags.Contains("f"))
                {
                    ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("text.tailFollow")}){UtilCmd.Color.Reset}\n");
                }
                return failed ? 1 : 0;
            },
        };
    }

    private static readonly CommandDef Wc = new()
    {
        Name = "wc",
        Summary = "Räknar rader, ord och tecken",
        Man = """
NAMN
       wc - räkna rader, ord och byte (word count)

SYNOPSIS
       wc [-l] [-w] [-c] [FIL]...

FLAGGOR
       -l    antal rader
       -w    antal ord
       -c    antal byte
       -m    antal tecken

EXEMPEL
       wc -l dokument/frukter.txt
       ls /etc | wc -l
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "lwcm", Long = new() { ["lines"] = "l", ["words"] = "w", ["bytes"] = "c", ["chars"] = "m" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var chosen = new[] { "l", "w", "m", "c" }.Where(f => o.Flags.Contains(f)).ToList();
            var fields = chosen.Count > 0 ? chosen : new List<string> { "l", "w", "c" };
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            Dictionary<string, long> Count(string s) => new()
            {
                ["l"] = s.Count(c => c == '\n'),
                ["w"] = SplitWords(s).Count,
                ["c"] = Js.Utf8Length(s),
                ["m"] = Js.CodePointLength(s),
            };
            var rows = inputs.Select(i => (Label: o.Operands.Count > 0 ? i.Label : "", Counts: Count(i.Content))).ToList();
            if (rows.Count > 1)
            {
                var total = new Dictionary<string, long> { ["l"] = 0, ["w"] = 0, ["c"] = 0, ["m"] = 0 };
                foreach (var r in rows) foreach (var k in total.Keys.ToList()) total[k] += r.Counts[k];
                rows.Add(("total", total));
            }
            bool single = fields.Count == 1 && rows.Count == 1;
            int width = single
                ? 0
                : rows.SelectMany(r => fields.Select(f => Js.Num(r.Counts[f]).Length)).Append(o.Operands.Count > 0 ? 1 : 7).Max();
            foreach (var r in rows)
            {
                var nums = string.Join(" ", fields.Select(f => Js.Num(r.Counts[f]).PadLeft(width)));
                ctx.Out(r.Label != "" ? $"{nums} {r.Label}\n" : $"{nums}\n");
            }
            return failed ? 1 : 0;
        },
    };

    /// <summary>Turns a basic regular expression (BRE, as grep uses) into JavaScript.</summary>
    public static string BreToJs(string p)
    {
        const string special = "|(){}+?";
        var sb = new StringBuilder();
        for (int i = 0; i < p.Length; i++)
        {
            char c = p[i];
            if (c == '\\' && i + 1 < p.Length)
            {
                char n = p[++i];
                if (special.Contains(n)) sb.Append(n);
                else sb.Append('\\').Append(n);
            }
            else if (special.Contains(c))
            {
                sb.Append('\\').Append(c);
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    private static readonly CommandDef Grep = new()
    {
        Name = "grep",
        Summary = "Söker efter rader som matchar ett mönster",
        Man = """
NAMN
       grep - skriv ut rader som matchar ett mönster

SYNOPSIS
       grep [FLAGGA]... MÖNSTER [FIL]...

BESKRIVNING
       Söker igenom filer (eller standard input) och skriver ut raderna som
       innehåller MÖNSTER. MÖNSTER är ett reguljärt uttryck.

FLAGGOR
       -i    ignorera skillnad mellan stora och små bokstäver
       -v    visa rader som INTE matchar
       -n    visa radnummer
       -c    visa bara antalet matchande rader
       -l    visa bara namnen på filer som matchar
       -r    sök rekursivt i kataloger
       -w    matcha bara hela ord
       -o    visa bara den del som matchar
       -E    utökade reguljära uttryck (t.ex. "ERROR|WARN")
       -F    mönstret är vanlig text, inte ett reguljärt uttryck

EXEMPEL
       grep ERROR server.log
       grep -in "varning" *.txt
       grep -E "ERROR|WARN" server.log
       ps aux | grep firefox
""",
        Run = RunGrep,
    };

    private static int RunGrep(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "ivnclrRwqhHEFos",
            Values = "e",
            Long = new()
            {
                ["ignore-case"] = "i",
                ["invert-match"] = "v",
                ["line-number"] = "n",
                ["count"] = "c",
                ["files-with-matches"] = "l",
                ["recursive"] = "r",
                ["word-regexp"] = "w",
                ["quiet"] = "q",
                ["extended-regexp"] = "E",
                ["fixed-strings"] = "F",
                ["only-matching"] = "o",
                ["color"] = "C",
                ["colour"] = "C",
            },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
        var ops = o.Operands.ToList();
        var pattern = o.Values.Get("e");
        if (pattern is null && ops.Count > 0)
        {
            pattern = ops[0];
            ops.RemoveAt(0);
        }
        if (pattern is null)
        {
            ctx.Err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n");
            return 2;
        }
        var source = o.Flags.Contains("F") ? ParserLib.EscapeRegex(pattern) : o.Flags.Contains("E") ? pattern : BreToJs(pattern);
        if (o.Flags.Contains("w")) source = $"\\b(?:{source})\\b";
        Regex re;
        try
        {
            re = JsRegex(source, o.Flags.Contains("i"));
        }
        catch (ArgumentException)
        {
            ctx.Err("grep: Invalid regular expression\n");
            return 2;
        }

        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool recursive = o.Flags.Contains("r") || o.Flags.Contains("R");
        var files = new List<(string Label, string Content)>();
        bool failed = false;
        if (recursive)
        {
            void Walk(string label, FsNode node)
            {
                // grep -r does not follow symbolic links inside the directories it searches.
                if (node.Type == "link") return;
                if (node.Type == "file")
                {
                    if (VfsLib.HasPerm(node, user, 'r')) files.Add((label, node.Content ?? ""));
                    else
                    {
                        ctx.Err($"grep: {label}: Permission denied\n");
                        failed = true;
                    }
                    return;
                }
                if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
                {
                    ctx.Err($"grep: {label}: Permission denied\n");
                    failed = true;
                    return;
                }
                foreach (var n in node.Children!.Keys.ToList().SortJs()) Walk(label.EndsWith('/') ? label + n : $"{label}/{n}", node.Children[n]);
            }
            foreach (var p in ops.Count > 0 ? ops : new List<string> { "." })
            {
                try
                {
                    Walk(p, sh.Vfs.Lookup(sh.Resolve(p), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"grep: {p}: {e.Message}\n");
                    failed = true;
                }
            }
        }
        else
        {
            foreach (var p in ops.Count > 0 ? ops : new List<string> { "-" })
            {
                if (p == "-")
                {
                    files.Add(("(standard input)", ctx.Stdin ?? ""));
                    continue;
                }
                var node = sh.Vfs.TryLookup(sh.Resolve(p), user);
                if (node?.Type == "dir")
                {
                    ctx.Err($"grep: {p}: Is a directory\n");
                    continue;
                }
                try
                {
                    files.Add((p, sh.Vfs.ReadFile(sh.Resolve(p), user)));
                }
                catch (FsError e)
                {
                    ctx.Err($"grep: {p}: {e.Message}\n");
                    failed = true;
                }
            }
        }

        bool showName = (files.Count > 1 || recursive) && !o.Flags.Contains("h") ? true : o.Flags.Contains("H");
        bool color = ctx.IsTTY;
        string Paint(string code, string s) => color ? $"{code}{s}{UtilCmd.Color.Reset}" : s;
        bool matchedAny = false;
        foreach (var f in files)
        {
            int count = 0;
            var lines = UtilCmd.SplitLines(f.Content);
            for (int idx = 0; idx < lines.Count; idx++)
            {
                var line = lines[idx];
                bool matches = re.IsMatch(line);
                if (matches == o.Flags.Contains("v")) continue;
                count++;
                matchedAny = true;
                if (o.Flags.Contains("q") || o.Flags.Contains("c") || o.Flags.Contains("l")) continue;
                var prefix =
                    (showName ? Paint(UtilCmd.Color.Magenta, f.Label) + Paint(UtilCmd.Color.Cyan, ":") : "") +
                    (o.Flags.Contains("n") ? Paint(UtilCmd.Color.Green, Js.Num(idx + 1)) + Paint(UtilCmd.Color.Cyan, ":") : "");
                if (o.Flags.Contains("o") && !o.Flags.Contains("v"))
                {
                    foreach (Match m in re.Matches(line)) if (m.Value != "") ctx.Out(prefix + Paint(UtilCmd.Color.Red, m.Value) + "\n");
                    continue;
                }
                var body = color && !o.Flags.Contains("v") ? re.Replace(line, m => Paint(UtilCmd.Color.Red, m.Value)) : line;
                ctx.Out(prefix + body + "\n");
            }
            if (o.Flags.Contains("q")) continue;
            if (o.Flags.Contains("c")) ctx.Out((showName ? Paint(UtilCmd.Color.Magenta, f.Label) + Paint(UtilCmd.Color.Cyan, ":") : "") + count + "\n");
            else if (o.Flags.Contains("l") && count > 0) ctx.Out(Paint(UtilCmd.Color.Magenta, f.Label) + "\n");
        }
        if (failed && !(o.Flags.Contains("q") && matchedAny)) return 2;
        return matchedAny ? 0 : 1;
    }

    /// <summary>
    /// How sort orders text: by the terminal's $LANG, like GNU sort (sv_SE.UTF-8 puts å, ä, ö last,
    /// en_US.UTF-8 sorts them with a and o). Unknown locales fall back to the invariant culture.
    /// </summary>
    public static CompareInfo Collation(Shell sh)
    {
        var lang = sh.Env.Get("LC_ALL") is { Length: > 0 } all ? all : sh.Env.Get("LANG") ?? "";
        var name = lang.Split('.')[0].Replace('_', '-');
        if (name is "" or "C" or "POSIX") return CultureInfo.InvariantCulture.CompareInfo;
        try
        {
            return CultureInfo.GetCultureInfo(name).CompareInfo;
        }
        catch (CultureNotFoundException)
        {
            return CultureInfo.InvariantCulture.CompareInfo;
        }
    }

    /// <summary>Plain `sort` of some lines, as the simulator does it.</summary>
    public static List<string> SortLines(Shell sh, IEnumerable<string> lines)
    {
        var ci = Collation(sh);
        var list = lines.ToList();
        list.StableSort((a, b) =>
        {
            int c = ci.Compare(a, b, CompareOptions.None);
            if (c != 0) return c;
            int o = string.CompareOrdinal(a, b);
            return o < 0 ? -1 : o > 0 ? 1 : 0;
        });
        return list;
    }

    private static readonly CommandDef Sort = new()
    {
        Name = "sort",
        Summary = "Sorterar rader",
        Man = """
NAMN
       sort - sortera rader i textfiler

SYNOPSIS
       sort [FLAGGA]... [FIL]...

FLAGGOR
       -r    omvänd ordning
       -n    sortera numeriskt (2 före 10)
       -u    ta bort dubbletter
       -f    ignorera skillnad mellan stora och små bokstäver
       -k N  sortera på fält nummer N

EXEMPEL
       sort frukter.txt
       sort frukter.txt | uniq -c | sort -rn
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "rnuf",
                Values = "k",
                Long = new() { ["reverse"] = "r", ["numeric-sort"] = "n", ["unique"] = "u", ["ignore-case"] = "f", ["key"] = "k" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands, (l, m) => $"sort: cannot read: {l}: {m}");
            if (failed) return 2;
            var lines = inputs.SelectMany(i => UtilCmd.SplitLines(i.Content)).ToList();
            var k = o.Values.Get("k");
            double field = !string.IsNullOrEmpty(k) ? Js.Number(k.Split(',')[0]) : 0;
            bool hasField = field != 0 && !double.IsNaN(field);
            string Key(string l) => hasField ? string.Join(" ", Js.Slice(SplitWordsKeepEmpty(JsTrim(l)), ToIndex(field - 1))) : l;
            var compareOptions = o.Flags.Contains("f") ? CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace : CompareOptions.None;
            var collation = Collation(ctx.Sh);
            int Cmp(string a, string b)
            {
                var ka = Key(a);
                var kb = Key(b);
                if (o.Flags.Contains("n"))
                {
                    double na = Js.ParseFloat(ka), nb = Js.ParseFloat(kb);
                    double d = (double.IsNaN(na) ? 0 : na) - (double.IsNaN(nb) ? 0 : nb);
                    // A NaN result counts as "equal" in a JS sort comparator.
                    if (double.IsNaN(d)) return 0;
                    if (d != 0) return d < 0 ? -1 : 1;
                }
                else
                {
                    int c = collation.Compare(ka, kb, compareOptions);
                    if (c != 0) return c;
                }
                int o2 = string.CompareOrdinal(a, b);
                return o2 < 0 ? -1 : o2 > 0 ? 1 : 0;
            }
            lines.StableSort(Cmp);
            if (o.Flags.Contains("r")) lines.Reverse();
            if (o.Flags.Contains("u"))
            {
                var all = lines;
                lines = all.Where((l, i) => i == 0 || Cmp(l, all[i - 1]) != 0).ToList();
            }
            ctx.Out(UtilCmd.JoinLines(lines));
            return 0;
        },
    };

    /// <summary>s.split(/\s+/) in JavaScript (without dropping empty strings).</summary>
    private static List<string> SplitWordsKeepEmpty(string s) => JsWhitespaceRun.Split(s).ToList();

    private static readonly CommandDef Uniq = new()
    {
        Name = "uniq",
        Summary = "Tar bort upprepade rader (som står bredvid varandra)",
        Man = """
NAMN
       uniq - rapportera eller ta bort upprepade rader

SYNOPSIS
       uniq [FLAGGA]... [FIL]

BESKRIVNING
       Tar bort rader som är likadana som raden direkt ovanför. Därför
       används uniq nästan alltid efter sort.

FLAGGOR
       -c    skriv antalet förekomster framför varje rad
       -d    visa bara rader som förekommer flera gånger
       -u    visa bara rader som är unika
       -i    ignorera skillnad mellan stora och små bokstäver

EXEMPEL
       sort frukter.txt | uniq -c
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "cdui", Long = new() { ["count"] = "c", ["repeated"] = "d", ["unique"] = "u", ["ignore-case"] = "i" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, Js.Slice(o.Operands, 0, 1));
            if (failed) return 1;
            var lines = UtilCmd.SplitLines(inputs.Count > 0 ? inputs[0].Content : "");
            bool Same(string a, string b) => o.Flags.Contains("i") ? a.ToLowerInvariant() == b.ToLowerInvariant() : a == b;
            var groups = new List<(string Line, int Count)>();
            foreach (var l in lines)
            {
                if (groups.Count > 0 && Same(groups[^1].Line, l)) groups[^1] = (groups[^1].Line, groups[^1].Count + 1);
                else groups.Add((l, 1));
            }
            foreach (var g in groups)
            {
                if (o.Flags.Contains("d") && g.Count < 2) continue;
                if (o.Flags.Contains("u") && g.Count > 1) continue;
                ctx.Out(o.Flags.Contains("c") ? $"{Js.Num(g.Count).PadLeft(7)} {g.Line}\n" : $"{g.Line}\n");
            }
            return 0;
        },
    };

    private static readonly Regex ListPartRe = new(@"^([0-9]*)(-?)([0-9]*)\z", RegexOptions.CultureInvariant);

    private static Func<double, bool>? ParseList(string spec)
    {
        var ranges = new List<(double From, double To)>();
        foreach (var part in spec.Split(','))
        {
            var m = ListPartRe.Match(part);
            if (!m.Success || (m.Groups[1].Value == "" && m.Groups[3].Value == "")) return null;
            double from = m.Groups[1].Value != "" ? Js.Number(m.Groups[1].Value) : 1;
            double to = m.Groups[2].Value != "" ? (m.Groups[3].Value != "" ? Js.Number(m.Groups[3].Value) : double.PositiveInfinity) : from;
            ranges.Add((from, to));
        }
        return n => ranges.Any(r => n >= r.From && n <= r.To);
    }

    private static readonly CommandDef Cut = new()
    {
        Name = "cut",
        Summary = "Plockar ut kolumner ur rader",
        Man = """
NAMN
       cut - plocka ut delar av varje rad

SYNOPSIS
       cut -d AVGRÄNSARE -f FÄLT [FIL]...
       cut -c TECKEN [FIL]...

FLAGGOR
       -d TECKEN   använd TECKEN som fältavgränsare (standard är tabb)
       -f LISTA    välj fält, t.ex. 1 eller 1,3 eller 2-4
       -c LISTA    välj tecken på samma sätt

EXEMPEL
       cut -d: -f1 /etc/passwd      alla användarnamn
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "dfc", Long = new() { ["delimiter"] = "d", ["fields"] = "f", ["characters"] = "c" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var spec = o.Values.Get("f") ?? o.Values.Get("c");
            if (string.IsNullOrEmpty(spec)) return UtilCmd.BadOption(ctx, "you must specify a list of bytes, characters, or fields");
            var pick = ParseList(spec);
            if (pick is null) return UtilCmd.BadOption(ctx, $"invalid field value '{spec}'");
            var delim = o.Values.Get("d") ?? "\t";
            var chars = o.Values.Get("c");
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            foreach (var input in inputs)
            {
                foreach (var line in UtilCmd.SplitLines(input.Content))
                {
                    if (!string.IsNullOrEmpty(chars))
                    {
                        ctx.Out(string.Concat(line.EnumerateRunes().Where((_, i) => pick(i + 1)).Select(r => r.ToString())) + "\n");
                    }
                    else if (!line.Contains(delim, StringComparison.Ordinal))
                    {
                        ctx.Out(line + "\n");
                    }
                    else
                    {
                        ctx.Out(string.Join(delim, Js.Split(line, delim).Where((_, i) => pick(i + 1))) + "\n");
                    }
                }
            }
            return failed ? 1 : 0;
        },
    };

    private static readonly CommandDef Tee = new()
    {
        Name = "tee",
        Summary = "Skriver indata både till skärmen och till filer",
        Man = """
NAMN
       tee - läs från standard input och skriv till både standard output och filer

SYNOPSIS
       tee [-a] [FIL]...

FLAGGOR
       -a    lägg till i filerna i stället för att skriva över

EXEMPEL
       ls | tee lista.txt
       echo "127.0.0.1 test" | sudo tee -a /etc/hosts

TIPS
       "sudo echo text > /etc/fil" fungerar inte, eftersom det är ditt eget
       skal (inte sudo) som öppnar filen. Använd "echo text | sudo tee /etc/fil".
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "a", Long = new() { ["append"] = "a" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var data = ctx.Stdin ?? "";
            var sh = ctx.Sh;
            int code = 0;
            foreach (var f in o.Operands)
            {
                try
                {
                    sh.Vfs.WriteFile(sh.Resolve(f), data, sh.CurrentUser(), o.Flags.Contains("a"));
                }
                catch (FsError e)
                {
                    ctx.Err($"tee: {f}: {e.Message}\n");
                    code = 1;
                }
            }
            ctx.Out(data);
            return code;
        },
    };

    public static List<CommandDef> All { get; } = new() { Echo, Cat, Less, More, HeadTail("head"), HeadTail("tail"), Wc, Grep, Sort, Uniq, Cut, Tee };
}
