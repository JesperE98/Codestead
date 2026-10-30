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

    private static readonly CommandDef Zsh = ShellCommand(
        "zsh",
        "Z-skalet – ett bash-kompatibelt skal med många extra finesser",
        "The Z shell – a bash-compatible shell with many extras",
        """
        NAMN
               zsh - Z-skalet

        SYNOPSIS
               zsh
               zsh SKRIPT [ARGUMENT]...
               zsh -c 'KOMMANDO'

        BESKRIVNING
               zsh är ett skal som i stort sett är kompatibelt med bash, men med
               fler finesser: bättre tab-komplettering, ** för att leta i alla
               underkataloger (ls **/*.txt), teman via Oh My Zsh och inställningar
               med setopt (t.ex. setopt autocd). Standardskal i macOS.

               Utan argument startas ett nytt interaktivt zsh-skal. Med exit kommer
               du tillbaka till skalet du kom ifrån.

               Inställningarna läses från ~/.zshrc. Prompten ställs in med
               variabeln PROMPT, t.ex. PROMPT='%n@%m %1~ %# '.

        SKILLNADER MOT BASH (urval)
               - Ociterade $variabler delas inte upp vid mellanslag.
               - ** matchar alla underkataloger (i bash krävs shopt -s globstar).
               - Listor (arrayer) börjar på index 1, inte 0.

        EXEMPEL
               zsh
               ls **/*.txt
               exit
        """,
        """
        NAME
               zsh - the Z shell

        SYNOPSIS
               zsh
               zsh SCRIPT [ARGUMENT]...
               zsh -c 'COMMAND'

        DESCRIPTION
               zsh is a shell that is largely compatible with bash, with extras:
               better tab completion, ** to search all subdirectories
               (ls **/*.txt), themes through Oh My Zsh and options set with setopt
               (e.g. setopt autocd). The default shell on macOS.

               Without arguments a new interactive zsh is started. exit takes you
               back to the shell you came from.

               Settings are read from ~/.zshrc. The prompt is set with the PROMPT
               variable, e.g. PROMPT='%n@%m %1~ %# '.

        DIFFERENCES FROM BASH (selection)
               - Unquoted $variables are not split on spaces.
               - ** matches all subdirectories (bash needs shopt -s globstar).
               - Arrays start at index 1, not 0.

        EXAMPLES
               zsh
               ls **/*.txt
               exit
        """);

    private static readonly CommandDef Fish = ShellCommand(
        "fish",
        "fish – \"the friendly interactive shell\" med egen, enklare syntax",
        "fish – the friendly interactive shell, with its own simpler syntax",
        """
        NAMN
               fish - the friendly interactive shell

        SYNOPSIS
               fish
               fish SKRIPT [ARGUMENT]...
               fish -c 'KOMMANDO'

        BESKRIVNING
               fish är ett skal som satsar på att vara lätt att använda: förslag
               medan du skriver (autosuggestions), färger och bra standardval utan
               konfiguration. Syntaxen skiljer sig från bash:

                   set namn Kim              i stället för  namn=Kim
                   set -x EDITOR nano        i stället för  export EDITOR=nano
                   (pwd)                     i stället för  $(pwd)
                   $status                   i stället för  $?
                   $argv                     i stället för  $@
                   if test -f fil; ...; end  i stället för  if ...; then ...; fi
                   for x in a b c; ...; end  i stället för  for ...; do ...; done
                   function hej; ...; end    i stället för  hej() { ...; }
                   math 2 + 3                i stället för  $((2 + 3))

               Inställningar läses från ~/.config/fish/config.fish.

        EXEMPEL
               fish
               set frukt äpple
               echo $frukt
               exit
        """,
        """
        NAME
               fish - the friendly interactive shell

        SYNOPSIS
               fish
               fish SCRIPT [ARGUMENT]...
               fish -c 'COMMAND'

        DESCRIPTION
               fish aims to be easy to use: suggestions while you type
               (autosuggestions), colours and good defaults without configuration.
               The syntax differs from bash:

                   set name Kim              instead of  name=Kim
                   set -x EDITOR nano        instead of  export EDITOR=nano
                   (pwd)                     instead of  $(pwd)
                   $status                   instead of  $?
                   $argv                     instead of  $@
                   if test -f file; ...; end instead of  if ...; then ...; fi
                   for x in a b c; ...; end  instead of  for ...; do ...; done
                   function hi; ...; end     instead of  hi() { ...; }
                   math 2 + 3                instead of  $((2 + 3))

               Settings are read from ~/.config/fish/config.fish.

        EXAMPLES
               fish
               set fruit apple
               echo $fruit
               exit
        """);

    // ---------- chsh ----------

    private static readonly Regex BinPrefixRe = new(@"^/bin/", RegexOptions.CultureInvariant);
    private static readonly Regex SbinPrefixRe = new(@"^/sbin/", RegexOptions.CultureInvariant);
    private static readonly Regex CommentLineRe = new(@"^#[^\n\r  ]*\n", RegexOptions.CultureInvariant | RegexOptions.Multiline);
    private static readonly Regex LeadingDashesRe = new(@"^-+", RegexOptions.CultureInvariant);

    /// <summary>/bin/zsh and /usr/bin/zsh are the same file (/bin points to /usr/bin in modern distributions).</summary>
    private static string RealPath(string p) => SbinPrefixRe.Replace(BinPrefixRe.Replace(p, "/usr/bin/", 1), "/usr/sbin/", 1);

    private static int ChangeShell(CmdCtx ctx, string user, string shell, Sink @out)
    {
        var sh = ctx.Sh;
        var root = sh.RootUser();
        bool utilLinux = sh.Distro.Family != "debian";
        var shells = (sh.Vfs.TryLookup("/etc/shells", root)?.Content ?? "").Split('\n').Select(l => l.Trim()).ToList();
        bool isRoot = sh.CurrentUser().Uid == 0;
        if (!shell.StartsWith('/'))
        {
            @out.Err(utilLinux ? "chsh: shell must be a full path name\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        var node = sh.Vfs.TryLookup(RealPath(shell), root);
        if (node is null || node.Type != "file" || (node.Mode & Js.Oct(111)) == 0)
        {
            @out.Err(utilLinux ? $"chsh: \"{shell}\" does not exist\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        if (!shells.Contains(shell) && !isRoot)
        {
            @out.Err(utilLinux ? $"chsh: {shell} is not listed in /etc/shells.\nchsh: Use chsh -l to see list.\n" : $"chsh: {shell} is an invalid shell\n");
            return 1;
        }
        var passwd = sh.Vfs.ReadFile("/etc/passwd", root);
        var lines = passwd.Split('\n').Select(line =>
        {
            var f = line.Split(':');
            if (f[0] != user || f.Length < 7) return line;
            f[6] = shell;
            return string.Join(":", f);
        });
        sh.Vfs.WriteFile("/etc/passwd", string.Join("\n", lines), root);
        if (utilLinux) @out.Out("Shell changed.\n");
        @out.Out(
            $"{UtilCmd.Color.Dim}{sh.Msg(
                $"Inloggningsskalet för {user} är nu {shell} (se /etc/passwd). Det gäller från nästa inloggning – terminalen du har öppen kör fortfarande sitt gamla skal.",
                $"The login shell for {user} is now {shell} (see /etc/passwd). It takes effect at the next login – the terminal you have open still runs its old shell.")}{UtilCmd.Color.Reset}\n");
        return 0;
    }

    private static readonly CommandDef Chsh = new()
    {
        Name = "chsh",
        Summary = "Byter inloggningsskal (change shell)",
        SummaryEn = "Change login shell",
        Man = """
            NAMN
                   chsh - byt inloggningsskal

            SYNOPSIS
                   chsh [-s SKAL] [ANVÄNDARE]
                   chsh -l

            BESKRIVNING
                   Ändrar vilket skal som startas när du loggar in. Skalet står i
                   sista fältet på din rad i /etc/passwd. Bara skal som finns med i
                   /etc/shells godtas (de läggs dit när skalet installeras). Ändringen
                   gäller från nästa inloggning.

                   Utan -s frågar chsh efter det nya skalet.

            FLAGGOR
                   -s SKAL    det nya skalet, med hela sökvägen (t.ex. /usr/bin/zsh)
                   -l         lista skalen i /etc/shells (Arch och Fedora)

            EXEMPEL
                   cat /etc/shells
                   chsh -s /usr/bin/zsh
                   grep elev /etc/passwd
                   chsh -s /bin/bash
            """,
        ManEn = """
            NAME
                   chsh - change login shell

            SYNOPSIS
                   chsh [-s SHELL] [USER]
                   chsh -l

            DESCRIPTION
                   Changes which shell is started when you log in. The shell is the
                   last field of your line in /etc/passwd. Only shells listed in
                   /etc/shells are accepted (they are added there when the shell is
                   installed). The change takes effect at the next login.

                   Without -s, chsh asks for the new shell.

            OPTIONS
                   -s SHELL   the new shell, with its full path (e.g. /usr/bin/zsh)
                   -l         list the shells in /etc/shells (Arch and Fedora)

            EXAMPLES
                   cat /etc/shells
                   chsh -s /usr/bin/zsh
                   grep elev /etc/passwd
                   chsh -s /bin/bash
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            bool utilLinux = sh.Distro.Family != "debian";
            string? shell = null;
            var operands = new List<string>();
            for (int i = 0; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "-s" || a == "--shell")
                {
                    shell = ++i < ctx.Args.Count ? ctx.Args[i] : null;
                    if (shell is null)
                    {
                        ctx.Err("chsh: option requires an argument -- 's'\n");
                        return 1;
                    }
                }
                else if (a.StartsWith("--shell=", StringComparison.Ordinal)) shell = a.Slice(8);
                else if ((a == "-l" || a == "--list-shells") && utilLinux)
                {
                    ctx.Out(CommentLineRe.Replace(sh.Vfs.ReadFile("/etc/shells", sh.RootUser()), ""));
                    return 0;
                }
                else if (a.StartsWith('-'))
                {
                    ctx.Err($"chsh: invalid option -- '{LeadingDashesRe.Replace(a, "", 1)}'\n");
                    return 1;
                }
                else operands.Add(a);
            }
            var me = sh.CurrentUser();
            var user = operands.Count > 0 ? operands[0] : me.Name;
            var line = sh.Vfs
                .ReadFile("/etc/passwd", sh.RootUser())
                .Split('\n')
                .FirstOrDefault(l => l.Split(':')[0] == user);
            if (line is null)
            {
                ctx.Err(utilLinux ? $"chsh: user \"{user}\" does not exist.\n" : $"chsh: user '{user}' does not exist\n");
                return 1;
            }
            if (user != me.Name && me.Uid != 0)
            {
                ctx.Err(utilLinux ? "chsh: running UID doesn't match UID of user we're altering, shell change denied\n" : $"chsh: You may not change the shell for '{user}'.\n");
                return 1;
            }
            if (utilLinux) ctx.Out($"Changing shell for {user}.\n");
            if (me.Uid != 0) ctx.Err($"Password: {UtilCmd.Color.Dim}{sh.Msg("(simulatorn hoppar över lösenordet)", "(the simulator skips the password)")}{UtilCmd.Color.Reset}\n");
            if (shell is not null) return ChangeShell(ctx, user, shell, ctx);
            var fields = line.Split(':');
            var current = fields.Length > 6 ? fields[6] : "/bin/bash";
            if (!utilLinux) ctx.Out($"Changing the login shell for {user}\nEnter the new value, or press ENTER for the default\n");
            sh.AskText(utilLinux ? $"New shell [{current}]: " : $"\tLogin Shell [{current}]: ", (text, io) =>
            {
                var value = text.Trim();
                if (value == "" || value == current)
                {
                    if (utilLinux) io.Out("Shell not changed.\n");
                    return 0;
                }
                return ChangeShell(ctx, user, value, io);
            });
            return 0;
        },
    };

    // ---------- zsh: setopt and unsetopt ----------

    private static readonly List<string> ZshOptions = new()
    {
        "autocd", "autopushd", "correct", "extendedglob", "globdots", "histignorealldups", "histignoredups",
        "interactivecomments", "nomatch", "promptsubst", "sharehistory", "shwordsplit", "appendhistory", "notify",
    };

    private static int NotFound(CmdCtx ctx)
    {
        var mode = ctx.Sh.ShellMode;
        ctx.Err(mode == "fish" ? $"fish: Unknown command: {ctx.Name}\n" : $"{mode}: {ctx.Name}: command not found\n");
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg($"{ctx.Name} finns bara i zsh.", $"{ctx.Name} only exists in zsh.")}{UtilCmd.Color.Reset}\n");
        return 127;
    }

    private static CommandDef OptCommand(string name) => new()
    {
        Name = name,
        Builtin = true,
        Summary = name == "setopt" ? "Slår på en inställning i zsh (t.ex. autocd)" : "Slår av en inställning i zsh",
        SummaryEn = name == "setopt" ? "Turn on a zsh option (e.g. autocd)" : "Turn off a zsh option",
        Man = $"""
            NAMN
                   {name} - {(name == "setopt" ? "slå på" : "slå av")} inställningar i zsh

            SYNOPSIS
                   {name} [INSTÄLLNING]...

            BESKRIVNING
                   Finns bara i zsh. Utan argument listas inställningarna som är på.
                   Lägg raden i ~/.zshrc för att den ska gälla varje gång.

                   autocd       skriv ett katalognamn för att gå dit, utan cd
                   shwordsplit  dela upp ociterade $variabler vid mellanslag, som bash
                   correct      föreslå rättningar av felstavade kommandon

            EXEMPEL
                   setopt autocd
                   dokument
            """,
        ManEn = $"""
            NAME
                   {name} - turn zsh options {(name == "setopt" ? "on" : "off")}

            SYNOPSIS
                   {name} [OPTION]...

            DESCRIPTION
                   Only exists in zsh. Without arguments the options that are on are
                   listed. Put the line in ~/.zshrc to make it permanent.

                   autocd       type a directory name to go there, without cd
                   shwordsplit  split unquoted $variables on spaces, like bash
                   correct      suggest corrections for misspelled commands

            EXAMPLES
                   setopt autocd
                   dokument
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (sh.ShellMode != "zsh") return NotFound(ctx);
            var frame = sh.ShellStack.Count > 0 ? sh.ShellStack[^1] : null;
            var options = frame?.Mode == "zsh" ? frame.Options : Js.Obj<bool>();
            if (ctx.Args.Count == 0)
            {
                foreach (var o in options.Keys.Where(k => options[k]).ToList().SortJs()) ctx.Out(o + "\n");
                return 0;
            }
            int code = 0;
            foreach (var a in ctx.Args)
            {
                var opt = a.ToLowerInvariant().Replace("_", "");
                bool on = name == "setopt";
                if (opt.StartsWith("no", StringComparison.Ordinal) && ZshOptions.Contains(opt.Slice(2)))
                {
                    opt = opt.Slice(2);
                    on = !on;
                }
                if (!ZshOptions.Contains(opt))
                {
                    ctx.Err($"{name}: no such option: {a}\n");
                    code = 1;
                    continue;
                }
                options[opt] = on;
            }
            return code;
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

    private static readonly Dictionary<string, string> SetLong = new()
    {
        ["local"] = "l", ["global"] = "g", ["universal"] = "U", ["export"] = "x", ["unexport"] = "u",
        ["erase"] = "e", ["query"] = "q", ["append"] = "a", ["prepend"] = "p", ["names"] = "n",
    };

    private static readonly Regex SetShortRe = new(@"^-[lgUxueqapnS]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex VarNameRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef FishSet = FishBuiltin("set", ctx =>
    {
        var sh = ctx.Sh;
        var flags = new HashSet<string>();
        int i = 0;
        for (; i < ctx.Args.Count; i++)
        {
            var a = ctx.Args[i];
            if (a == "--")
            {
                i++;
                break;
            }
            if (a.StartsWith("--", StringComparison.Ordinal) && SetLong.TryGetValue(a.Slice(2), out var longFlag)) flags.Add(longFlag);
            else if (SetShortRe.IsMatch(a)) foreach (var c in a.Slice(1)) flags.Add(c.ToString());
            else if (a.StartsWith('-') && a.Length > 1)
            {
                ctx.Err($"set: {a}: unknown option\n");
                return 2;
            }
            else break;
        }
        var restArgs = ctx.Args.Slice(i);
        if (restArgs.Count == 0)
        {
            // Object.entries(sh.env).sort() compares the entries as "key,value" strings.
            foreach (var (k, v) in sh.Env.OrderBy(kv => kv.Key + "," + kv.Value, StringComparer.Ordinal).ToList())
                ctx.Out(flags.Contains("n") ? $"{k}\n" : $"{k} {v}\n");
            return 0;
        }
        var name = restArgs[0];
        var values = restArgs.Slice(1);
        if (flags.Contains("q")) return restArgs.Count(n => !sh.Env.ContainsKey(n));
        if (!VarNameRe.IsMatch(name))
        {
            ctx.Err($"set: {name}: invalid variable name. See `help identifiers`\n");
            return 2;
        }
        if (flags.Contains("e"))
        {
            if (flags.Contains("U")) ShellmodeLib.SaveUniversalVar(sh, name, null);
            if (!sh.Env.ContainsKey(name)) return 4;
            sh.Env.Remove(name);
            return 0;
        }
        // fish has lists; the simulator stores them separated by spaces (PATH lists with colons).
        var sep = name.EndsWith("PATH", StringComparison.Ordinal) ? ":" : " ";
        var oldValue = sh.Env.Get(name);
        var old = !string.IsNullOrEmpty(oldValue) ? new List<string> { oldValue } : new List<string>();
        var list = flags.Contains("a") ? old.Concat(values) : flags.Contains("p") ? values.Concat(old) : values;
        var value = string.Join(sep, list);
        if (flags.Contains("U")) ShellmodeLib.SaveUniversalVar(sh, name, value);
        // Without -g/-U a new variable in a function is local to the function (like -l).
        bool local = flags.Contains("l") || (!flags.Contains("g") && !flags.Contains("U") && sh.FuncDepth > 0 && !sh.Env.ContainsKey(name));
        if (local && sh.DeclareLocal(name, value)) return 0;
        sh.SetVar(name, value);
        return 0;
    });

    private static readonly CommandDef FishCount = FishBuiltin("count", ctx =>
    {
        ctx.Out($"{ctx.Args.Count}\n");
        return ctx.Args.Count > 0 ? 0 : 1;
    });

    private static readonly CommandDef FishIndex = FishBuiltin("index", ctx =>
    {
        var n = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var list = ctx.Args.Slice(1);
        double idx = Js.Number(n);
        double pos = idx > 0 ? idx - 1 : list.Count + idx;
        // list[pos] is undefined unless pos is a whole index inside the list.
        if (double.IsNaN(pos) || pos != Math.Floor(pos) || pos < 0 || pos >= list.Count) return 1;
        ctx.Out(list[(int)pos] + "\n");
        return 0;
    });

    private static readonly CommandDef FishContains = FishBuiltin("contains", ctx =>
    {
        var args = new List<string>(ctx.Args);
        bool printIndex = args.Count > 0 && (args[0] == "-i" || args[0] == "--index");
        if (printIndex) args.RemoveAt(0);
        if (args.Count == 0)
        {
            ctx.Err("contains: Key not specified\n");
            return 2;
        }
        var needle = args[0];
        var hay = args.Slice(1);
        int i = hay.IndexOf(needle);
        if (i >= 0 && printIndex) ctx.Out($"{i + 1}\n");
        return i >= 0 ? 0 : 1;
    });

    private static readonly CommandDef FishStatus = FishBuiltin("status", ctx =>
    {
        var sh = ctx.Sh;
        switch (ctx.Args.Count > 0 ? ctx.Args[0] : null)
        {
            case null:
                ctx.Out("This is not a login shell\nJob control: Only on interactive jobs\n");
                return 0;
            case "is-interactive":
                return sh.Interactive ? 0 : 1;
            case "is-login":
                return 1;
            case "current-command":
                ctx.Out("status\n");
                return 0;
            case "fish-path":
                ctx.Out("/usr/bin/fish\n");
                return 0;
            default:
                ctx.Err($"status: {ctx.Args[0]}: invalid subcommand\n");
                return 2;
        }
    });

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

    /// <summary>String(Number(v.toFixed(digits))) – rounds to the given number of decimals.</summary>
    private static string RoundJs(double v, double scale)
    {
        // toFixed converts its argument with ToIntegerOrInfinity (NaN -> 0, fractions truncated).
        double d = double.IsNaN(scale) ? 0 : Math.Truncate(scale);
        if (d < 0 || d > 100) throw new ArgumentOutOfRangeException(nameof(scale), "toFixed() digits argument must be between 0 and 100");
        // Beyond 15 decimals toFixed(d) parses back to the same double.
        if (d > 15) return Js.Num(v);
        return Js.Num(Js.Number(Js.ToFixed(v, (int)d)));
    }

    private static readonly CommandDef FishMathCmd = FishBuiltin("math", ctx =>
    {
        var args = new List<string>(ctx.Args);
        double scale = 6;
        while (args.Count > 0 && (args[0].StartsWith("-s", StringComparison.Ordinal) || args[0].StartsWith("--scale", StringComparison.Ordinal)))
        {
            var a = args[0];
            args.RemoveAt(0);
            string? v;
            if (a.Contains('=')) v = a.Split('=')[1];
            else if (a.Length > 2 && !a.StartsWith("--", StringComparison.Ordinal)) v = a.Slice(2);
            else if (args.Count > 0)
            {
                v = args[0];
                args.RemoveAt(0);
            }
            else v = null;
            scale = Js.Number(v);
        }
        if (args.Count == 0)
        {
            ctx.Err("math: expected >= 1 arguments; got 0\n");
            return 2;
        }
        try
        {
            var v = FishMath(string.Join(" ", args));
            if (!double.IsFinite(v)) throw new MathError("Result is infinite");
            var s = scale == 0 ? Js.Num(Math.Truncate(v)) : RoundJs(v, scale);
            ctx.Out(s + "\n");
            return 0;
        }
        catch (MathError e)
        {
            ctx.Err($"math: Error: {e.Message}\n'{string.Join(" ", args)}'\n");
            return 1;
        }
    });

    /// <summary>In zsh and fish, `bash` starts a new bash shell.</summary>
    public static int? StartBash(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        if (sh.ShellMode == "bash" || !sh.Interactive || ctx.Stdin is not null) return null;
        return sh.StartShell("bash", ctx);
    }

    public static List<CommandDef> All { get; } = new()
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
