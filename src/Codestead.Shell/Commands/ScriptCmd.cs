namespace Codestead.Shell.Commands;

// Port of src/shell/commands/script.ts – builtins for scripts: test/[ ]/[[ ]], read, printf, local, return,
// break, continue, shift, let and set.

public static partial class ScriptCmd
{
    /// <summary>An error in a test expression.</summary>
    private sealed class TestError(string message) : Exception(message);

    private static readonly HashSet<string> Unary = new() { "-e", "-f", "-d", "-r", "-w", "-x", "-s", "-z", "-n", "-L", "-h" };
    private static readonly HashSet<string> Binary = new() { "=", "==", "!=", "<", ">", "-eq", "-ne", "-lt", "-le", "-gt", "-ge", "=~" };

    private static readonly Regex IntegerRe = new($"^{TextCmd.JsWhitespaceClass}*-?[0-9]+{TextCmd.JsWhitespaceClass}*\\z", RegexOptions.CultureInvariant);

    /// <summary>Evaluates the expression in test / [ ] / [[ ]].</summary>
    private static bool EvalTest(List<string> args, CmdCtx ctx, bool extended)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        int i = 0;
        string? Arg(int idx) => idx >= 0 && idx < args.Count ? args[idx] : null;

        double ToInt(string s)
        {
            if (!IntegerRe.IsMatch(s)) throw new TestError($"{s}: integer expression expected");
            return Js.Number(s);
        }

        bool UnaryOp(string op, string arg)
        {
            if (op == "-z") return arg == "";
            if (op == "-n") return arg != "";
            var node = sh.Vfs.TryLookup(sh.Resolve(arg), user);
            return op switch
            {
                "-e" => node is not null,
                "-f" => node?.Type == "file",
                "-d" => node?.Type == "dir",
                "-r" => node is not null && VfsLib.HasPerm(node, user, 'r'),
                "-w" => node is not null && VfsLib.HasPerm(node, user, 'w'),
                "-x" => node is not null && VfsLib.HasPerm(node, user, 'x'),
                "-s" => node is not null && VfsLib.NodeSize(node) > 0,
                _ => false,
            };
        }

        bool BinaryOp(string a, string op, string b)
        {
            switch (op)
            {
                case "=":
                case "==":
                    return extended ? ParserLib.GlobToRegex(b, true).IsMatch(a) : a == b;
                case "!=":
                    return extended ? !ParserLib.GlobToRegex(b, true).IsMatch(a) : a != b;
                case "<":
                    return string.CompareOrdinal(a, b) < 0;
                case ">":
                    return string.CompareOrdinal(a, b) > 0;
                case "=~":
                    Regex re;
                    try
                    {
                        re = TextCmd.JsRegex(b);
                    }
                    catch (ArgumentException)
                    {
                        throw new TestError($"{b}: invalid regular expression");
                    }
                    return re.IsMatch(a);
                case "-eq":
                    return ToInt(a) == ToInt(b);
                case "-ne":
                    return ToInt(a) != ToInt(b);
                case "-lt":
                    return ToInt(a) < ToInt(b);
                case "-le":
                    return ToInt(a) <= ToInt(b);
                case "-gt":
                    return ToInt(a) > ToInt(b);
                case "-ge":
                    return ToInt(a) >= ToInt(b);
            }
            return false;
        }

        var orOps = extended ? new[] { "-o", "||" } : new[] { "-o" };
        var andOps = extended ? new[] { "-a", "&&" } : new[] { "-a" };

        bool Primary()
        {
            var a = Arg(i);
            if (a is null) throw new TestError("argument expected");
            if (a == "!")
            {
                i++;
                return !Primary();
            }
            if (a == "(" && args.Count - i > 2)
            {
                i++;
                var v = Or();
                if (Arg(i) != ")") throw new TestError("`)' expected");
                i++;
                return v;
            }
            if (Binary.Contains(Arg(i + 1) ?? "") && i + 2 < args.Count)
            {
                i += 3;
                return BinaryOp(a, args[i - 2], args[i - 1]);
            }
            if (Unary.Contains(a) && i + 1 < args.Count)
            {
                i += 2;
                return UnaryOp(a, args[i - 1]);
            }
            i++;
            return a != "";
        }
        bool And()
        {
            var v = Primary();
            while (Arg(i) is string op && andOps.Contains(op))
            {
                i++;
                var r = Primary();
                v = v && r;
            }
            return v;
        }
        bool Or()
        {
            var v = And();
            while (Arg(i) is string op && orOps.Contains(op))
            {
                i++;
                var r = And();
                v = v || r;
            }
            return v;
        }

        if (args.Count == 0) return false;
        var result = Or();
        if (i < args.Count) throw new TestError($"{args[i]}: unexpected operator");
        return result;
    }

    private static CommandDef TestCommand(string name) => new()
    {
        Name = name,
        Builtin = true,
        Summary = name == "test" ? "Testar villkor (filer, text och tal)" : name == "[" ? "Samma som test, skrivs [ villkor ]" : "Utökat test i bash: [[ villkor ]]",
        Man = """
NAMN
       test, [ ], [[ ]] - testa ett villkor

SYNOPSIS
       test UTTRYCK
       [ UTTRYCK ]
       [[ UTTRYCK ]]

BESKRIVNING
       Slutkoden blir 0 (sant) om villkoret stämmer, annars 1 (falskt).
       Används nästan alltid tillsammans med if, while, && och ||.
       Mellanslagen innanför hakparenteserna är obligatoriska!

FILER
       -e FIL    filen finns
       -f FIL    är en vanlig fil
       -d FIL    är en katalog
       -r/-w/-x  går att läsa / skriva / köra
       -s FIL    finns och är inte tom

TEXT
       -z TEXT   texten är tom
       -n TEXT   texten är inte tom
       A = B     lika        A != B   olika

TAL
       -eq  lika med          -ne  inte lika med
       -lt  mindre än         -le  mindre än eller lika med
       -gt  större än         -ge  större än eller lika med

KOMBINERA
       ! UTTRYCK          inte
       A -a B / A -o B    och / eller   (i [[ ]]: && och ||)

EXEMPEL
       if [ -f ~/.bashrc ]; then echo "finns"; fi
       [ "$svar" = "ja" ] && echo "Bra!"
       [[ $fil == *.txt ]] && echo "en textfil"
""",
        Run = ctx =>
        {
            var args = ctx.Args.ToList();
            if (name == "[")
            {
                if (args.At(-1) != "]")
                {
                    ctx.Err("bash: [: missing `]'\n");
                    return 2;
                }
                args = Js.Slice(args, 0, -1);
            }
            else if (name == "[[")
            {
                if (args.At(-1) != "]]")
                {
                    ctx.Err("bash: syntax error: missing `]]'\n");
                    return 2;
                }
                args = Js.Slice(args, 0, -1);
            }
            try
            {
                return EvalTest(args, ctx, name == "[[") ? 0 : 1;
            }
            catch (TestError e)
            {
                ctx.Err($"bash: {name}: {e.Message}\n");
                return 2;
            }
        },
    };

    private static readonly CommandDef Read = new()
    {
        Name = "read",
        Builtin = true,
        Summary = "Läser en rad indata till variabler",
        Man = """
NAMN
       read - läs en rad från standard input till en eller flera variabler

SYNOPSIS
       read [-r] [-p FRÅGA] NAMN...

BESKRIVNING
       Läser en rad och lägger den i variabeln NAMN (eller REPLY). Med flera
       namn delas raden upp vid mellanslag; sista variabeln får resten.

FLAGGOR
       -p FRÅGA   visa FRÅGA innan raden läses
       -r         behandla \ som ett vanligt tecken

EXEMPEL
       read -p "Vad heter du? " namn
       while read rad; do echo "> $rad"; done < fil.txt

I SIMULATORN
       Inne i skript kan read bara läsa från en pipe eller en fil (< fil),
       inte från tangentbordet.
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var names = new List<string>();
            var promptText = "";
            for (int i = 0; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "-p") promptText = ++i < ctx.Args.Count ? ctx.Args[i] : "";
                else if (a == "-r" || a == "-s" || a == "-e") continue;
                else names.Add(a);
            }
            if (names.Count == 0) names.Add("REPLY");
            void Assign(string line)
            {
                var fields = TextCmd.SplitWords(TextCmd.JsTrim(line));
                for (int idx = 0; idx < names.Count; idx++)
                {
                    var n = names[idx];
                    var value = idx == names.Count - 1 ? string.Join(" ", Js.Slice(fields, idx)) : (idx < fields.Count ? fields[idx] : "");
                    sh.SetVar(n, n == "REPLY" && names.Count == 1 ? line : value);
                }
            }
            var reader = ctx.Reader;
            if (reader is not null)
            {
                if (reader.Pos >= reader.Data.Length)
                {
                    foreach (var n in names) sh.SetVar(n, "");
                    return 1;
                }
                int nl = reader.Data.IndexOf('\n', reader.Pos);
                int end = nl < 0 ? reader.Data.Length : nl;
                Assign(reader.Data[reader.Pos..end]);
                reader.Pos = nl < 0 ? reader.Data.Length : nl + 1;
                return 0;
            }
            if (sh.CanAskInteractively())
            {
                sh.AskText(promptText, (text, _) =>
                {
                    Assign(text);
                    return 0;
                });
                return 0;
            }
            ctx.Err(
                $"bash: read: {ctx.Sh.Msg("script.readNoInput")}\n{UtilCmd.Color.Dim}{ctx.Sh.Msg("script.readInScripts")}{UtilCmd.Color.Reset}\n");
            return 1;
        },
    };

    private static readonly Regex EscapeRe = new(@"\\(n|t|r|\\|""|a|e|0[0-7]{0,3})", RegexOptions.CultureInvariant);
    private static readonly Regex SpecRe = new(@"%([-+ 0#]*)([0-9]+)?(?:\.([0-9]+))?([sdifxXoceb%])", RegexOptions.CultureInvariant);
    private static readonly Regex ZeroPadConv = new("[dfixXo]", RegexOptions.CultureInvariant);

    /// <summary>Number(x) || 0 in JavaScript.</summary>
    private static double NumOrZero(string s)
    {
        double n = Js.Number(s);
        return double.IsNaN(n) ? 0 : n;
    }

    /// <summary>Math.trunc(n).toString(radix) in JavaScript.</summary>
    private static string ToRadix(double n, int radix)
    {
        double t = Math.Truncate(n);
        if (double.IsInfinity(t)) return t > 0 ? "Infinity" : "-Infinity";
        if (Math.Abs(t) >= 9.2e18) return Js.Num(t);
        long v = (long)t;
        var digits = Convert.ToString(Math.Abs(v), radix);
        return v < 0 ? "-" + digits : digits;
    }

    /// <summary>n.toFixed(digits) in JavaScript (Math.Round only handles up to 15 decimals).</summary>
    private static string ToFixed(double n, int digits) =>
        digits <= 15 ? Js.ToFixed(n, digits) : n.ToString("F" + digits, CultureInfo.InvariantCulture);

    /// <summary>n.toExponential(digits) in JavaScript, e.g. "1.50e+0".</summary>
    private static string ToExponential(double n, int digits)
    {
        if (double.IsNaN(n)) return "NaN";
        if (double.IsInfinity(n)) return n > 0 ? "Infinity" : "-Infinity";
        var s = n.ToString("E" + digits, CultureInfo.InvariantCulture);
        int e = s.IndexOf('E');
        var mantissa = s[..e];
        int exp = int.Parse(s[(e + 1)..], NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture);
        return $"{mantissa}e{(exp < 0 ? "-" : "+")}{Math.Abs(exp)}";
    }

    /// <summary>Formats like printf(1): %s %d %i %f %x %o %c %b %% with flags, width and precision.</summary>
    public static string FormatPrintf(string format, List<string> args)
    {
        static string Escapes(string s) => EscapeRe.Replace(s, m =>
        {
            var c = m.Groups[1].Value;
            if (c == "n") return "\n";
            if (c == "t") return "\t";
            if (c == "r") return "\r";
            if (c == "e") return "\x1b";
            if (c == "a") return "";
            if (c.StartsWith('0'))
            {
                double code = Js.ParseInt(c, 8);
                return ((char)(double.IsNaN(code) ? 0 : (int)code)).ToString();
            }
            return c;
        });
        var fmt = Escapes(format);
        var output = new StringBuilder();
        int argi = 0;
        do
        {
            bool consumed = false;
            output.Append(SpecRe.Replace(fmt, m =>
            {
                var flags = m.Groups[1].Value;
                string? width = m.Groups[2].Success ? m.Groups[2].Value : null;
                string? prec = m.Groups[3].Success ? m.Groups[3].Value : null;
                var conv = m.Groups[4].Value;
                if (conv == "%") return "%";
                var arg = argi < args.Count ? args[argi] : "";
                argi++;
                consumed = true;
                string s;
                switch (conv)
                {
                    case "d":
                    case "i":
                        s = Js.Num(Math.Truncate(NumOrZero(arg)));
                        if (flags.Contains('+') && !s.StartsWith('-')) s = "+" + s;
                        break;
                    case "f":
                    case "e":
                    {
                        int p = prec is not null ? (int)Js.Number(prec) : 6;
                        s = conv == "f" ? ToFixed(NumOrZero(arg), p) : ToExponential(NumOrZero(arg), p);
                        break;
                    }
                    case "x":
                    case "X":
                        s = ToRadix(NumOrZero(arg), 16);
                        if (conv == "X") s = s.ToUpperInvariant();
                        break;
                    case "o":
                        s = ToRadix(NumOrZero(arg), 8);
                        break;
                    case "c":
                        s = arg.CharAt(0);
                        break;
                    case "b":
                        s = Escapes(arg);
                        break;
                    default:
                        s = prec is not null ? arg.Slice(0, (int)Js.Number(prec)) : arg;
                        break;
                }
                int w = (int)Js.Number(width ?? "0");
                if (s.Length < w)
                {
                    if (flags.Contains('-')) s = s.PadRight(w);
                    else if (flags.Contains('0') && ZeroPadConv.IsMatch(conv)) s = s.StartsWith('-') ? "-" + s[1..].PadLeft(w - 1, '0') : s.PadLeft(w, '0');
                    else s = s.PadLeft(w);
                }
                return s;
            }));
            if (!consumed) break;
        } while (argi < args.Count);
        return output.ToString();
    }

    private static readonly CommandDef Printf = new()
    {
        Name = "printf",
        Builtin = true,
        Summary = "Skriver ut formaterad text",
        Man = """
NAMN
       printf - skriv ut formaterad text

SYNOPSIS
       printf FORMAT [ARGUMENT]...

BESKRIVNING
       Som echo, men du styr exakt hur utskriften ser ut. Ingen radbrytning
       läggs till automatiskt – skriv \n där du vill ha en.

FORMAT
       %s     text            %d     heltal
       %5s    högerjustera i 5 tecken   %-10s  vänsterjustera i 10 tecken
       %.2f   decimaltal med 2 decimaler
       %%     ett procenttecken

EXEMPEL
       printf "Hej %s!\n" "$USER"
       printf "%-10s %5d\n" äpplen 3
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0)
            {
                ctx.Err("printf: usage: printf format [arguments]\n");
                return 2;
            }
            ctx.Out(FormatPrintf(ctx.Args[0], ctx.Args.Skip(1).ToList()));
            return 0;
        },
    };

    private static readonly CommandDef Local = new()
    {
        Name = "local",
        Builtin = true,
        Summary = "Skapar en variabel som bara finns i funktionen",
        Man = """
NAMN
       local - skapa en lokal variabel i en funktion

SYNOPSIS
       local NAMN[=VÄRDE]...

BESKRIVNING
       En lokal variabel försvinner när funktionen är klar och påverkar
       inte en variabel med samma namn utanför funktionen.
""",
        Run = ctx =>
        {
            foreach (var a in ctx.Args)
            {
                int eq = a.IndexOf('=');
                var name = eq >= 0 ? a[..eq] : a;
                if (!ctx.Sh.DeclareLocal(name, eq >= 0 ? a[(eq + 1)..] : null))
                {
                    ctx.Err("bash: local: can only be used in a function\n");
                    return 1;
                }
            }
            return 0;
        },
    };

    /// <summary>ToInt32 in JavaScript (what the bitwise operators do with a number).</summary>
    private static int JsToInt32(double n)
    {
        if (double.IsNaN(n) || double.IsInfinity(n)) return 0;
        double t = Math.Truncate(n);
        double m = t % 4294967296.0;
        if (m < 0) m += 4294967296.0;
        return unchecked((int)(uint)m);
    }

    private static readonly CommandDef ReturnCmd = new()
    {
        Name = "return",
        Builtin = true,
        Summary = "Avslutar en funktion med en slutkod",
        Man = """
NAMN
       return - avsluta en funktion

SYNOPSIS
       return [SLUTKOD]

BESKRIVNING
       Avslutar funktionen. Slutkoden (0–255) blir funktionens $?.
       Utan argument används slutkoden från det senaste kommandot.
""",
        Run = ctx =>
        {
            if (ctx.Sh.FuncDepth == 0 && ctx.Sh.ScriptDepth == 0)
            {
                ctx.Err("bash: return: can only `return' from a function or sourced script\n");
                return 1;
            }
            throw new ReturnSignal(ctx.Args.Count > 0 ? JsToInt32(Js.Number(ctx.Args[0])) & 255 : ctx.Sh.LastExit);
        },
    };

    private static CommandDef LoopControl(string kind) => new()
    {
        Name = kind,
        Builtin = true,
        Summary = kind == "break" ? "Avbryter en loop" : "Hoppar till nästa varv i en loop",
        Man = "NAMN\n" +
            $"       {kind} - {(kind == "break" ? "avbryt en for-, while- eller until-loop" : "hoppa direkt till nästa varv i en loop")}\n" +
            "\n" +
            "SYNOPSIS\n" +
            $"       {kind} [N]\n" +
            "\n" +
            "BESKRIVNING\n" +
            "       Med N påverkas N nivåer av nästlade loopar.",
        Run = ctx =>
        {
            if (ctx.Sh.LoopDepth == 0)
            {
                ctx.Err($"bash: {kind}: only meaningful in a `for', `while', or `until' loop\n");
                return 0;
            }
            double v = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "1");
            double n = Math.Max(1, double.IsNaN(v) || v == 0 ? 1 : v);
            throw new LoopSignal(kind, (int)Math.Min(n, ctx.Sh.LoopDepth));
        },
    };

    private static readonly CommandDef Shift = new()
    {
        Name = "shift",
        Builtin = true,
        Summary = "Flyttar skriptets argument ett steg ($2 blir $1)",
        Man = """
NAMN
       shift - flytta positionsparametrarna

SYNOPSIS
       shift [N]

BESKRIVNING
       $2 blir $1, $3 blir $2 och så vidare. Med N flyttas de N steg.
""",
        Run = ctx =>
        {
            double n = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "1");
            var args = ctx.Sh.Args;
            if (n > args.Count) return 1;
            int start = double.IsNaN(n) ? 0 : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);
            ctx.Sh.SetArgs(Js.Slice(args, start));
            return 0;
        },
    };

    private static readonly CommandDef LetCmd = new()
    {
        Name = "let",
        Builtin = true,
        Summary = "Räknar med heltal",
        Man = """
NAMN
       let - räkna med heltal

SYNOPSIS
       let UTTRYCK...

EXEMPEL
       let "summa = 2 + 3"
       let i++

TIPS
       Det vanligaste sättet idag är (( i++ )) eller summa=$(( 2 + 3 )).
""",
        Run = ctx =>
        {
            long last = 0;
            foreach (var expr in ctx.Args)
            {
                try
                {
                    last = ArithLib.EvalArith(ctx.Sh.ExpandString(expr), new ArithVars { Get = n => ctx.Sh.GetVar(n), Set = (n, v) => ctx.Sh.SetVar(n, v) });
                }
                catch (ArithError e)
                {
                    ctx.Err($"bash: let: {expr}: {e.Message}\n");
                    return 1;
                }
            }
            return last != 0 ? 0 : 1;
        },
    };

    private static readonly CommandDef Set = new()
    {
        Name = "set",
        Builtin = true,
        Summary = "Visar variabler eller ändrar skalets inställningar",
        Man = """
NAMN
       set - visa variabler eller ändra inställningar i skalet

SYNOPSIS
       set
       set -- ARGUMENT...
       set -e / -u / -x / -o pipefail

BESKRIVNING
       Utan argument listas alla variabler. "set -- a b c" sätter $1, $2, $3.
       Flaggorna -e (avbryt vid fel), -u och -x är vanliga överst i skript.
       I simulatorn godtas de men har ingen effekt ännu.
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (ctx.Args.Count == 0)
            {
                foreach (var (k, v) in SystemCmd.SortedEntries(sh.Env)) ctx.Out($"{k}={(TextCmd.HasJsWhitespace(v) ? $"'{v}'" : v)}\n");
                return 0;
            }
            int dd = ctx.Args.IndexOf("--");
            if (dd >= 0) sh.SetArgs(ctx.Args.Skip(dd + 1).ToList());
            return 0;
        },
    };

    public static List<CommandDef> All { get; } = new()
    {
        TestCommand("test"),
        TestCommand("["),
        TestCommand("[["),
        Read,
        Printf,
        Local,
        ReturnCmd,
        LoopControl("break"),
        LoopControl("continue"),
        Shift,
        LetCmd,
        Set,
    };
}
