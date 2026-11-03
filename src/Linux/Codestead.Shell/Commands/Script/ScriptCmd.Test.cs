namespace Codestead.Shell.Commands;

// The test, [ and [[ commands.

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
}
