namespace Codestead.Shell.Commands;

// Port of src/shell/commands/shells.ts – other shells: zsh and fish (started on top of bash and left
// with exit), chsh to change the login shell, zsh's setopt/unsetopt and the hidden builtins the fish
// translation uses (set, count, math, status, contains).

public static partial class ShellsCmd
{
    // ---------- zsh and fish ----------

    private static CommandDef ShellCommand(string mode, string summary, string summaryEn, string man, string manEn) => new()
    {
        Name = mode,
        Summary = summary,
        SummaryEn = summaryEn,
        Man = man,
        ManEn = manEn,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var first = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            var rest = ctx.Args.Slice(1);
            if (first == "--version" || first == "-v" || (mode == "fish" && first == "-V"))
            {
                var triplet = sh.Distro.Family switch
                {
                    "debian" => "x86_64-ubuntu-linux-gnu",
                    "arch" => "x86_64-pc-linux-gnu",
                    _ => "x86_64-redhat-linux-gnu",
                };
                ctx.Out(mode == "zsh" ? $"zsh {ShellmodeLib.ZshVersion} ({triplet})\n" : $"fish, version {ShellmodeLib.FishVersion(sh)}\n");
                return 0;
            }
            if (first == "-c") return sh.RunScript(rest.Count > 0 ? rest[0] : "", mode, rest.Slice(1), ctx, false, mode);
            if (!string.IsNullOrEmpty(first) && !first.StartsWith('-'))
            {
                try
                {
                    var content = sh.Vfs.ReadFile(sh.Resolve(first), sh.CurrentUser());
                    return sh.RunScript(content, first, rest, ctx, false, mode);
                }
                catch (FsError e)
                {
                    var msg = e.Message;
                    ctx.Err(mode == "zsh" ? $"zsh: {msg.ToLowerInvariant()}: {first}\n" : $"fish: Error reading script file '{first}':\n{msg}\n");
                    return 127;
                }
            }
            // Code from a pipe: echo 'echo hej' | zsh
            if (ctx.Stdin is not null) return sh.RunScript(ctx.Stdin, mode, new List<string>(), ctx, false, mode);
            if (!sh.Interactive) return 0;
            return sh.StartShell(mode, ctx);
        },
    };

    // ---------- fish: builtins (called through the translation) ----------

    private static CommandDef FishBuiltin(string name, Func<CmdCtx, int> run) => new()
    {
        Name = $"__fish_{name}",
        Builtin = true,
        Summary = $"fish: {name}",
        Run = ctx => run(new CmdCtx(ctx, ctx.Sh, name, ctx.Args)),
    };

    private sealed class MathError(string message) : Exception(message);

    private static readonly Regex MathTokRe = new(@"[0-9]+(?:\.[0-9]+)?|\.[0-9]+|[-+*/%^()x]|pi|e|\S", RegexOptions.CultureInvariant);
    private static readonly Regex NumStartRe = new(@"^[0-9.]", RegexOptions.CultureInvariant);

    /// <summary>JS `**`: like Math.Pow, except that NaN exponents and ±1 ** ±Infinity give NaN.</summary>
    private static double JsPow(double b, double e) =>
        double.IsNaN(e) || (Math.Abs(b) == 1 && double.IsInfinity(e)) ? double.NaN : Math.Pow(b, e);

    /// <summary>fish's math: + - * x / % ^ and parentheses, with decimals.</summary>
    public static double FishMath(string expr)
    {
        var toks = MathTokRe.Matches(expr).Select(m => m.Value).ToList();
        int i = 0;
        string? Peek() => i < toks.Count ? toks[i] : null;
        // toks[i++]: always moves on, undefined (null) past the end.
        string? Next()
        {
            var t = i < toks.Count ? toks[i] : null;
            i++;
            return t;
        }
        double Primary()
        {
            var t = Next();
            if (t is null) throw new MathError("Too few arguments");
            if (t == "(")
            {
                var v = Sum();
                if (Next() != ")") throw new MathError("Missing closing parenthesis");
                return v;
            }
            if (t == "-") return -Power();
            if (t == "+") return Power();
            if (t == "pi") return Math.PI;
            if (t == "e") return Math.E;
            if (NumStartRe.IsMatch(t)) return Js.Number(t);
            throw new MathError("Unexpected token");
        }
        double Power()
        {
            var b = Primary();
            if (Peek() == "^")
            {
                i++;
                return JsPow(b, Power());
            }
            return b;
        }
        double Product()
        {
            var v = Power();
            while (Peek() is "*" or "x" or "/" or "%")
            {
                var op = toks[i++];
                var r = Power();
                if ((op == "/" || op == "%") && r == 0) throw new MathError("Division by zero");
                v = op == "/" ? v / r : op == "%" ? v % r : v * r;
            }
            return v;
        }
        double Sum()
        {
            var v = Product();
            while (Peek() is "+" or "-") v = toks[i++] == "+" ? v + Product() : v - Product();
            return v;
        }
        var result = Sum();
        if (i < toks.Count) throw new MathError("Unexpected token");
        return result;
    }

    /// <summary>In zsh and fish, `bash` starts a new bash shell.</summary>
    public static int? StartBash(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        if (sh.ShellMode == "bash" || !sh.Interactive || ctx.Stdin is not null) return null;
        return sh.StartShell("bash", ctx);
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        Zsh,
        Fish,
        Chsh,
        OptCommand("setopt"),
        OptCommand("unsetopt"),
        FishSet,
        FishCount,
        FishIndex,
        FishContains,
        FishStatus,
        FishMathCmd,
    };
}
