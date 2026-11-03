namespace Codestead.Shell.Commands;

// Port of src/shell/commands/system.ts – shell and system commands: sudo, su, man, help, which, type, export,
// alias, history, uname and more.

public static partial class SystemCmd
{
    private static CommandDef Simple(string name, string summary, Func<CmdCtx, int> run, string? man = null, bool builtin = false) => new()
    {
        Name = name,
        Summary = summary,
        Run = run,
        Man = man,
        Builtin = builtin,
    };

    /// <summary>Object.entries(obj).sort() in JavaScript: the pairs sorted as the strings "key,value".</summary>
    internal static List<KeyValuePair<string, string>> SortedEntries(OrderedDictionary<string, string> obj) =>
        obj.OrderBy(kv => $"{kv.Key},{kv.Value}", StringComparer.Ordinal).ToList();

    /// <summary>str.replace('a', 'b') in JavaScript: only the first occurrence.</summary>
    private static string ReplaceFirst(string s, string find, string replacement)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + replacement + s[(i + find.Length)..];
    }

    /// <summary>A JS number passed on as an integer exit code (NaN becomes 0).</summary>
    private static int ToInt(double n) =>
        double.IsNaN(n) ? 0 : n >= int.MaxValue ? int.MaxValue : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);

    private static readonly CommandDef Whoami = Simple("whoami", "Visar vilken användare du är", ctx =>
    {
        ctx.Out(ctx.Sh.CurrentUser().Name + "\n");
        return 0;
    }, """
NAMN
       whoami - skriv ut ditt användarnamn

BESKRIVNING
       Visar namnet på användaren som kör kommandot. Prova "sudo whoami"!
""");

    private static readonly CommandDef Id = Simple("id", "Visar användar- och grupp-id", ctx =>
    {
        var sh = ctx.Sh;
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "ugGnr", Long = new() { ["user"] = "u", ["group"] = "g", ["groups"] = "G", ["name"] = "n", ["real"] = "r" } });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var name = o.Operands.Count > 0 ? o.Operands[0] : sh.CurrentUser().Name;
        if (o.Operands.Count > 0 && !UsersLib.UserExists(sh, name))
        {
            ctx.Err($"id: '{name}': no such user\n");
            return 1;
        }
        var u = sh.GetUser(name);
        string Gid(string g) => UsersLib.GidOf(sh, g) is int gid ? Js.Num(gid) : g;
        string Show(string n, string label) => o.Flags.Contains("n") ? label : n;
        var primary = u.Groups.FirstOrDefault() ?? "";
        if (o.Flags.Contains("u")) ctx.Out(Show(Js.Num(u.Uid), u.Name) + "\n");
        else if (o.Flags.Contains("g")) ctx.Out(Show(Gid(primary), primary) + "\n");
        else if (o.Flags.Contains("G")) ctx.Out(string.Join(" ", u.Groups.Select(g => Show(Gid(g), g))) + "\n");
        else ctx.Out($"uid={Js.Num(u.Uid)}({u.Name}) gid={Gid(primary)}({primary}) groups={string.Join(",", u.Groups.Select(g => $"{Gid(g)}({g})"))}\n");
        return 0;
    }, """
NAMN
       id - visa användar-id (uid), grupp-id (gid) och grupper

SYNOPSIS
       id [FLAGGOR] [ANVÄNDARE]

BESKRIVNING
       Uppgifterna kommer från /etc/passwd och /etc/group.

FLAGGOR
       -u    bara användar-id
       -g    bara primär grupp-id
       -G    alla grupp-id
       -n    namn i stället för nummer (med -u, -g eller -G)
""");

    private static readonly CommandDef Groups = Simple("groups", "Visar vilka grupper du tillhör", ctx =>
    {
        var sh = ctx.Sh;
        if (ctx.Args.Count == 0)
        {
            ctx.Out(string.Join(" ", sh.CurrentUser().Groups) + "\n");
            return 0;
        }
        int code = 0;
        foreach (var name in ctx.Args)
        {
            if (!UsersLib.UserExists(sh, name))
            {
                ctx.Err($"groups: '{name}': no such user\n");
                code = 1;
                continue;
            }
            ctx.Out($"{name} : {string.Join(" ", sh.GetUser(name).Groups)}\n");
        }
        return code;
    }, """
NAMN
       groups - visa vilka grupper en användare tillhör

SYNOPSIS
       groups [ANVÄNDARE]...

BESKRIVNING
       Medlemmar i gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       får använda sudo. Grupperna står i /etc/group.
""");

    private static readonly CommandDef Hostname = new()
    {
        Name = "hostname",
        Summary = "Visar datorns namn",
        Run = ctx =>
        {
            if (ctx.Args.Contains("-I") || ctx.Args.Contains("--all-ip-addresses"))
            {
                ctx.Out(NetworkLib.MyIp(ctx.Sh) + " \n");
                return 0;
            }
            if (ctx.Args.Contains("-i") || ctx.Args.Contains("--ip-address"))
            {
                ctx.Out("127.0.1.1\n");
                return 0;
            }
            ctx.Out(ctx.Sh.Distro.Hostname + "\n");
            return 0;
        },
        Man = """
NAMN
       hostname - visa systemets värdnamn

BESKRIVNING
       Namnet finns också i filen /etc/hostname.

FLAGGOR
       -I       visa datorns IP-adresser (utom 127.0.0.1)
""",
        Builtin = false,
        SummaryEn = "Show the system's host name",
        ManEn = """
NAME
       hostname - show the system's host name

DESCRIPTION
       The name is also stored in the file /etc/hostname.

OPTIONS
       -I       show the computer's IP addresses (except 127.0.0.1)
""",
    };

    private static readonly CommandDef Uname = Simple("uname", "Visar information om systemet och kärnan", ctx =>
    {
        var d = ctx.Sh.Distro;
        var flags = new HashSet<string>(ctx.Args.SelectMany(a => a.StartsWith('-') ? a[1..].EnumerateRunes().Select(r => r.ToString()) : Enumerable.Empty<string>()));
        var parts = new List<string>();
        bool all = flags.Contains("a");
        if (all || flags.Contains("s") || flags.Count == 0) parts.Add("Linux");
        if (all || flags.Contains("n")) parts.Add(d.Hostname);
        if (all || flags.Contains("r")) parts.Add(d.Kernel);
        if (all || flags.Contains("v")) parts.Add("#1 SMP PREEMPT_DYNAMIC");
        if (all || flags.Contains("m")) parts.Add("x86_64");
        if (all || flags.Contains("o")) parts.Add("GNU/Linux");
        ctx.Out(string.Join(" ", parts) + "\n");
        return 0;
    }, """
NAMN
       uname - visa systeminformation

FLAGGOR
       -a    allt
       -r    kärnans version (kernel release)
       -n    värdnamnet
       -m    hårdvaruarkitektur (t.ex. x86_64)
""");

    private static readonly CommandDef Date = Simple("date", "Visar datum och tid", ctx =>
    {
        ctx.Out(UtilCmd.LongDate() + "\n");
        return 0;
    }, """
NAMN
       date - visa datum och tid
""");

    private static CommandDef EnvCmd(string name) => Simple(name, "Visar miljövariabler", ctx =>
    {
        var env = ctx.Sh.Env;
        if (name == "printenv" && ctx.Args.Count > 0)
        {
            int code = 0;
            foreach (var k in ctx.Args)
            {
                if (env.TryGetValue(k, out var v)) ctx.Out(v + "\n");
                else code = 1;
            }
            return code;
        }
        foreach (var (k, v) in SortedEntries(env)) ctx.Out($"{k}={v}\n");
        return 0;
    }, "NAMN\n" +
        $"       {name} - visa miljövariabler\n" +
        "\n" +
        "SYNOPSIS\n" +
        $"       {(name == "env" ? "env" : "printenv [VARIABEL]...")}\n" +
        "\n" +
        "BESKRIVNING\n" +
        "       Miljövariabler är namngivna värden som program kan läsa, t.ex.\n" +
        "       HOME (din hemkatalog), PATH (var kommandon letas efter) och USER.");

    private static readonly Regex IdentifierRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Export = Simple("export", "Sätter en miljövariabel", ctx =>
    {
        var env = ctx.Sh.Env;
        if (ctx.Args.Count == 0 || ctx.Args[0] == "-p")
        {
            foreach (var (k, v) in SortedEntries(env)) ctx.Out($"declare -x {k}=\"{v}\"\n");
            return 0;
        }
        foreach (var a in ctx.Args)
        {
            int eq = a.IndexOf('=');
            var key = eq >= 0 ? a[..eq] : a;
            if (!IdentifierRe.IsMatch(key))
            {
                ctx.Err($"bash: export: `{a}': not a valid identifier\n");
                return 1;
            }
            if (eq >= 0) env[key] = a[(eq + 1)..];
            else if (!env.ContainsKey(key)) env[key] = "";
        }
        return 0;
    }, """
NAMN
       export - gör en variabel tillgänglig för program som startas

SYNOPSIS
       export NAMN=VÄRDE

EXEMPEL
       export EDITOR=nano
       export PATH="$HOME/bin:$PATH"

BESKRIVNING
       Variabler som sätts med export gäller bara i den aktuella sessionen.
       Lägg raden i ~/.bashrc om den ska gälla varje gång du öppnar en terminal.
""", true);

    private static readonly CommandDef Unset = Simple("unset", "Tar bort en variabel eller funktion", ctx =>
    {
        bool functions = false;
        foreach (var k in ctx.Args)
        {
            if (k == "-f") functions = true;
            else if (k == "-v") functions = false;
            else if (functions) ctx.Sh.Functions.Remove(k);
            else ctx.Sh.Env.Remove(k);
        }
        return 0;
    }, """
NAMN
       unset - ta bort en variabel eller funktion

SYNOPSIS
       unset NAMN...
       unset -f FUNKTION...
""", true);

    private static readonly CommandDef Alias = Simple("alias", "Skapar ett kortkommando för ett kommando", ctx =>
    {
        var aliases = ctx.Sh.Aliases;
        if (ctx.Args.Count == 0)
        {
            foreach (var (k, v) in SortedEntries(aliases)) ctx.Out($"alias {k}='{v}'\n");
            return 0;
        }
        int code = 0;
        foreach (var a in ctx.Args)
        {
            int eq = a.IndexOf('=');
            if (eq > 0) aliases[a[..eq]] = a[(eq + 1)..];
            else if (aliases.TryGetValue(a, out var v)) ctx.Out($"alias {a}='{v}'\n");
            else
            {
                ctx.Err($"bash: alias: {a}: not found\n");
                code = 1;
            }
        }
        return code;
    }, """
NAMN
       alias - skapa kortkommandon

SYNOPSIS
       alias NAMN='KOMMANDO'
       alias

EXEMPEL
       alias ll='ls -la'
       alias ..='cd ..'

BESKRIVNING
       Utan argument listas alla alias. Lägg alias i ~/.bashrc för att
       spara dem permanent.
""", true);

    private static readonly CommandDef Unalias = Simple("unalias", "Tar bort ett alias", ctx =>
    {
        if (ctx.Args.Count > 0 && ctx.Args[0] == "-a")
        {
            ctx.Sh.Aliases.Clear();
            return 0;
        }
        int code = 0;
        foreach (var a in ctx.Args)
        {
            if (ctx.Sh.Aliases.ContainsKey(a)) ctx.Sh.Aliases.Remove(a);
            else
            {
                ctx.Err($"bash: unalias: {a}: not found\n");
                code = 1;
            }
        }
        return code;
    }, null, true);

    private static readonly CommandDef History = Simple("history", "Visar tidigare kommandon", ctx =>
    {
        if (ctx.Args.Count > 0 && ctx.Args[0] == "-c")
        {
            ctx.Sh.History.Clear();
            return 0;
        }
        var history = ctx.Sh.History;
        for (int i = 0; i < history.Count; i++) ctx.Out($"{Js.Num(i + 1).PadLeft(5)}  {history[i]}\n");
        return 0;
    }, """
NAMN
       history - visa kommandohistoriken

BESKRIVNING
       Använd pil upp/ned för att bläddra bland tidigare kommandon.

FLAGGOR
       -c    töm historiken
""", true);

    private static readonly CommandDef TypeCmd = Simple("type", "Visar vad ett kommandonamn är (alias, inbyggt, fil)", ctx =>
    {
        var sh = ctx.Sh;
        int code = 0;
        foreach (var n in ctx.Args)
        {
            if (sh.Aliases.TryGetValue(n, out var alias)) ctx.Out($"{n} is aliased to `{alias}'\n");
            else if (sh.Functions.ContainsKey(n)) ctx.Out($"{n} is a function\n");
            else if (IndexCmd.Commands.GetValueOrDefault(n)?.Builtin == true) ctx.Out($"{n} is a shell builtin\n");
            else
            {
                var r = sh.ResolveCommand(n);
                if (r.Kind == "binary" || r.Kind == "script") ctx.Out($"{n} is {r.Path}\n");
                else
                {
                    ctx.Err($"bash: type: {n}: not found\n");
                    code = 1;
                }
            }
        }
        return code;
    }, """
NAMN
       type - visa hur ett kommandonamn tolkas

EXEMPEL
       type cd      cd is a shell builtin
       type ls      ls is /usr/bin/ls
""", true);

    private static readonly CommandDef Which = Simple("which", "Visar var ett kommando finns", ctx =>
    {
        var sh = ctx.Sh;
        int code = 0;
        foreach (var n in ctx.Args)
        {
            var r = sh.ResolveCommand(n);
            if (r.Kind == "binary" || r.Kind == "script") ctx.Out(r.Path + "\n");
            else
            {
                code = 1;
                if (sh.Distro.Family != "debian") ctx.Err($"which: no {n} in ({sh.Env.Get("PATH") ?? ""})\n");
            }
        }
        return code;
    }, """
NAMN
       which - visa den fullständiga sökvägen till ett kommando

BESKRIVNING
       Letar igenom katalogerna i $PATH. Inbyggda skalkommandon (som cd)
       är inga filer och hittas därför inte – använd "type" för dem.

EXEMPEL
       which ls
""");

    private static readonly Regex SectionRe = new(@"^[0-9]\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Man = Simple("man", "Visar manualen för ett kommando", ctx =>
    {
        var name = ctx.Args.FirstOrDefault(a => !SectionRe.IsMatch(a));
        if (string.IsNullOrEmpty(name))
        {
            ctx.Err("What manual page do you want?\nFor example, try 'man man'.\n");
            return 1;
        }
        var def = IndexCmd.Commands.GetValueOrDefault(name);
        bool available = def?.Builtin == true || ctx.Sh.ResolveCommand(name).Kind != "notfound";
        if (def is null || !available)
        {
            ctx.Err($"No manual entry for {name}\n");
            return 16;
        }
        ctx.Out(UtilCmd.FormatMan(name, ManEnCmd.ManFor(def, ctx.Sh)));
        if (ctx.IsTTY)
        {
            ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("system.manScrollHint")}){UtilCmd.Color.Reset}\n");
        }
        return 0;
    }, """
NAMN
       man - visa manualsidor

SYNOPSIS
       man KOMMANDO

BESKRIVNING
       Nästan alla kommandon har en manualsida. Det är det första stället
       att leta på när du undrar vad en flagga gör. I simulatorn är
       manualerna förenklade och på svenska.
""");

    private static readonly Regex LowercaseStartRe = new("^[a-z]", RegexOptions.CultureInvariant);

    private static readonly CommandDef Help = Simple("help", "Listar alla kommandon som finns", ctx =>
    {
        var sh = ctx.Sh;
        var names = sh.AvailableCommands().Where(n => LowercaseStartRe.IsMatch(n) && IndexCmd.Commands.GetValueOrDefault(n)?.Name == n).ToList();
        ctx.Out(sh.Msg("system.helpHeader", ("distro", sh.Distro.Name)));
        ctx.Out(sh.Msg("system.helpManHint"));
        foreach (var n in names) ctx.Out($"  {n.PadRight(11)} {ManEnCmd.SummaryFor(IndexCmd.Commands[n], sh)}\n");
        ctx.Out($"\n{UtilCmd.Color.Dim}{sh.Msg("system.helpMissingProgram", ("pm", sh.Distro.PackageManager))}{UtilCmd.Color.Reset}\n");
        return 0;
    }, """
NAMN
       help - lista kommandon i simulatorn
""", true);

    private static readonly CommandDef Clear = Simple("clear", "Rensar skärmen", ctx =>
    {
        ctx.Sh.RequestClear();
        return 0;
    }, """
NAMN
       clear - rensa terminalfönstret

TIPS
       Kortkommandot Ctrl+L gör samma sak.
""");

    private static int RunExit(CmdCtx ctx)
    {
        double n = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "0");
        return ctx.Sh.Exit(double.IsNaN(n) ? 0 : ToInt(n), ctx);
    }

    private static readonly CommandDef ExitCmd = Simple("exit", "Avslutar skalet (eller lämnar root-skalet)", RunExit, """
NAMN
       exit - avsluta skalet

BESKRIVNING
       Om du blivit root med "sudo -i" tar exit dig tillbaka till din
       vanliga användare.
""", true);

    private static readonly CommandDef Logout = ExitCmd.With(name: "logout", summary: "Loggar ut från ett inloggningsskal");

    private static void SudoNotice(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var name = sh.CurrentUser().Name;
        var flag = name == sh.World.User ? "sudoNoticeShown" : $"sudoNoticeShown:{name}";
        if (sh.Flags.TryGetValue(flag, out var shown) && shown) return;
        sh.Flags[flag] = true;
        ctx.Err($"[sudo] password for {name}: {UtilCmd.Color.Dim}{sh.Msg("common.skipsPassword")}{UtilCmd.Color.Reset}\n");
    }

    private const string SudoUsage = "usage: sudo -h | -K | -k | -V\nusage: sudo [-AbEHknPS] [-u user] [-i | -s] [command [arg ...]]\n";

    private static int RunSudo(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var args = ctx.Args.ToList();
        string? Shift()
        {
            if (args.Count == 0) return null;
            var first = args[0];
            args.RemoveAt(0);
            return first;
        }
        if (args.Count == 0 || args[0] == "-h")
        {
            ctx.Err(SudoUsage);
            return 1;
        }
        if (args[0] == "-V" || args[0] == "--version")
        {
            ctx.Out("Sudo version 1.9.17p2\n");
            return 0;
        }
        var target = "root";
        bool login = false;
        bool shell = false;
        while (args.Count > 0 && args[0].StartsWith('-'))
        {
            var a = Shift()!;
            if (a == "--") break;
            if (a == "--user" || a.StartsWith("--user=", StringComparison.Ordinal))
            {
                target = a.Contains('=') ? a[7..] : (Shift() ?? "");
                continue;
            }
            if (a == "--login") login = true;
            else if (a == "--shell") shell = true;
            else if (a.StartsWith("--", StringComparison.Ordinal))
            {
                ctx.Err($"sudo: unrecognized option '{a}'\n{SudoUsage}");
                return 1;
            }
            else
            {
                for (int i = 1; i < a.Length; i++)
                {
                    char c = a[i];
                    if (c == 'i') login = true;
                    else if (c == 's') shell = true;
                    else if (c == 'u')
                    {
                        var rest = a[(i + 1)..];
                        target = rest != "" ? rest : (Shift() ?? "");
                        break;
                    }
                    else
                    {
                        ctx.Err($"sudo: invalid option -- '{c}'\n{SudoUsage}");
                        return 1;
                    }
                }
            }
        }
        if (user.Uid != 0 && !user.Groups.Contains(sh.Distro.AdminGroup))
        {
            ctx.Err($"{user.Name} is not in the sudoers file.\n");
            if (ctx.IsTTY)
            {
                ctx.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.sudoAdminGroup", ("group", sh.Distro.AdminGroup))}{UtilCmd.Color.Reset}\n");
            }
            return 1;
        }
        if (target != "root" && !UsersLib.UserExists(sh, target))
        {
            ctx.Err($"sudo: unknown user {target}\n");
            return 1;
        }
        if (user.Uid != 0) SudoNotice(ctx);
        if ((login || shell) && args.Count == 0)
        {
            UsersLib.SwitchUser(sh, target, login, m => ctx.Err($"sudo: {ReplaceFirst(m, "cannot change", "unable to change")}\n"));
            return 0;
        }
        if (args.Count == 0)
        {
            ctx.Err(SudoUsage);
            return 1;
        }
        return sh.RunAs(target, () => sh.Invoke(args, ctx, viaSudo: true));
    }

    private static readonly CommandDef Sudo = Simple("sudo", "Kör ett kommando som root (administratör)", RunSudo, """
NAMN
       sudo - kör ett kommando som en annan användare (oftast root)

SYNOPSIS
       sudo KOMMANDO [ARGUMENT]...
       sudo -i

BESKRIVNING
       root är systemets administratör och får göra allt. Vanliga användare
       som tillhör gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       kan köra enstaka kommandon som root genom att sätta sudo framför.
       Du får då ange ditt eget lösenord.

       sudo -i         starta ett root-skal (avsluta med exit)
       sudo -u ANV     kör kommandot som en annan användare än root
       sudo -iu ANV    starta ett inloggningsskal som ANV

EXEMPEL
       sudo apt update
       sudo cat /etc/shadow
       sudo -u kim whoami

VARNING
       Med sudo finns inga skyddsnät. Kör bara kommandon du förstår.
""");

    private static readonly Regex LeadingDashes = new("^-+", RegexOptions.CultureInvariant);

    private static int RunSu(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        bool login = false;
        string? command = null;
        var operands = new List<string>();
        for (int i = 0; i < ctx.Args.Count; i++)
        {
            var a = ctx.Args[i];
            if (a == "-" || a == "-l" || a == "--login") login = true;
            else if (a == "-c" || a == "--command") command = ++i < ctx.Args.Count ? ctx.Args[i] : "";
            else if (a.StartsWith("--command=", StringComparison.Ordinal)) command = a[10..];
            else if (a.StartsWith('-') && a.Length > 1) return UtilCmd.BadOption(ctx, $"invalid option -- '{LeadingDashes.Replace(a, "", 1)}'");
            else operands.Add(a);
        }
        var target = operands.Count > 0 ? operands[0] : "root";
        var entry = UsersLib.FindUser(sh, target);
        if (entry is null && target != "root")
        {
            ctx.Err($"su: user {target} does not exist or the user entry does not contain all the required fields\n");
            return 1;
        }
        int Become(Sink io)
        {
            if (entry is not null && UsersLib.IsNologin(entry.Shell))
            {
                io.Out("This account is currently not available.\n");
                return 1;
            }
            if (command is not null)
            {
                var scriptIo = new IO(io.OutFn, io.ErrFn, null, ctx.IsTTY, (io as IO)?.Reader);
                return sh.RunAs(target, () => sh.RunScript(command, "bash", new List<string>(), scriptIo));
            }
            UsersLib.SwitchUser(sh, target, login, m => io.Err($"su: warning: {m}\n"));
            return 0;
        }
        if (sh.CurrentUser().Uid == 0) return Become(ctx);
        if (!sh.CanAskInteractively())
        {
            ctx.Err("su: must be run from a terminal\n");
            return 1;
        }
        sh.AskText(
            "Password: ",
            (password, io) =>
            {
                var hash = UsersLib.ShadowHash(sh, target) ?? "!";
                if (!hash.StartsWith('!') && !hash.StartsWith('*') && UsersLib.VerifyPassword(sh, target, password)) return Become(io);
                io.Err("su: Authentication failure\n");
                if (target == "root" && (hash.StartsWith('*') || hash.StartsWith('!')))
                {
                    io.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.suRootNoPassword")}{UtilCmd.Color.Reset}\n");
                }
                else if (hash.StartsWith('!') || hash.StartsWith('*'))
                {
                    io.Err($"{UtilCmd.Color.Dim}{sh.Msg("system.suUserNoPassword", ("user", target))}{UtilCmd.Color.Reset}\n");
                }
                return 1;
            },
            true);
        return 0;
    }

    private static readonly CommandDef Su = Simple("su", "Byter användare", RunSu, """
NAMN
       su - byt användare (substitute user)

SYNOPSIS
       su [-] [ANVÄNDARE]
       su -c KOMMANDO [ANVÄNDARE]

BESKRIVNING
       Startar ett skal som en annan användare (root om ingen anges).
       Du måste skriva den andra användarens lösenord – inte ditt eget.
       Är du redan root behövs inget lösenord. Gå tillbaka med exit.

       På Ubuntu är root-kontot låst, så där används "sudo -i" i stället
       för "su -".

FLAGGOR
       -, -l     inloggningsskal: gå till användarens hemkatalog
       -c CMD    kör bara ett kommando som användaren

EXEMPEL
       su - kim
       su -c whoami kim
""");

    private static int RunBash(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var first = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (first == "--version")
        {
            ctx.Out("GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\n");
            return 0;
        }
        if (first == "-c") return sh.RunScript(rest.Count > 0 ? rest[0] : "", "bash", rest.Skip(1).ToList(), ctx, false, "bash");
        if (string.IsNullOrEmpty(first))
        {
            var started = ShellsCmd.StartBash(ctx);
            if (started is not null) return started.Value;
            ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("system.alreadyBash")}{UtilCmd.Color.Reset}\n");
            return 0;
        }
        string content;
        try
        {
            content = sh.Vfs.ReadFile(sh.Resolve(first), sh.CurrentUser());
        }
        catch (FsError e)
        {
            ctx.Err($"bash: {first}: {e.Message}\n");
            return 127;
        }
        return sh.RunScript(content, first, rest, ctx, false, "bash");
    }

    private static readonly CommandDef Bash = Simple("bash", "Kör ett skript i ett nytt bash-skal", RunBash, """
NAMN
       bash - GNU Bourne-Again SHell

SYNOPSIS
       bash SKRIPT [ARGUMENT]...
       bash -c 'KOMMANDO'

BESKRIVNING
       bash är skalet du skriver kommandon i. "bash skript.sh" kör ett
       skript utan att det behöver vara körbart (chmod +x).
""");

    private static int RunSource(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var file = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (string.IsNullOrEmpty(file))
        {
            ctx.Err("bash: source: filename argument required\n");
            return 2;
        }
        string content;
        try
        {
            content = sh.Vfs.ReadFile(sh.Resolve(file), sh.CurrentUser());
        }
        catch (FsError e)
        {
            ctx.Err($"bash: {file}: {e.Message}\n");
            return 1;
        }
        return sh.RunScript(content, file, rest, ctx, true);
    }

    private static readonly CommandDef Source = Simple("source", "Kör ett skript i det aktuella skalet", RunSource, """
NAMN
       source - läs in och kör kommandon från en fil i det aktuella skalet

BESKRIVNING
       Till skillnad från att köra ett skript påverkar source ditt skal:
       alias, variabler och cd stannar kvar. Används ofta så här:
           source ~/.bashrc
       Punkt (.) är en kortare variant: . ~/.bashrc
""", true);

    private static readonly CommandDef Dot = Source.With(name: ".");

    private static readonly CommandDef TrueCmd = Simple("true", "Gör ingenting, lyckas alltid", _ => 0);
    private static readonly CommandDef FalseCmd = Simple("false", "Gör ingenting, misslyckas alltid", _ => 1);

    private static readonly CommandDef Sleep = Simple("sleep", "Väntar en stund", _ => 0, """
NAMN
       sleep - vänta ett antal sekunder

BESKRIVNING
       I simulatorn returnerar sleep direkt.
""");

    private static readonly CommandDef Seq = Simple("seq", "Skriver ut en talföljd", ctx =>
    {
        var n = ctx.Args.Select(a => Js.Number(a)).ToList();
        if (n.Count == 0 || n.Any(double.IsNaN)) return UtilCmd.BadOption(ctx, "missing operand");
        var (first, inc, last) = n.Count == 1 ? (1.0, 1.0, n[0]) : n.Count == 2 ? (n[0], 1.0, n[1]) : (n[0], n[1], n[2]);
        if (inc == 0) return 1;
        int c = 0;
        for (double i = first; inc > 0 ? i <= last : i >= last; i += inc, c++)
        {
            if (c > 10_000) break;
            ctx.Out(Js.Num(i) + "\n");
        }
        return 0;
    }, """
NAMN
       seq - skriv ut en talföljd

SYNOPSIS
       seq SISTA
       seq FÖRSTA SISTA
       seq FÖRSTA STEG SISTA
""");

    private static readonly CommandDef BasenameCmd = Simple("basename", "Tar bort katalogdelen från en sökväg", ctx =>
    {
        if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
        var b = VfsLib.Basename(ctx.Args[0]);
        var suffix = ctx.Args.Count > 1 ? ctx.Args[1] : "";
        if (suffix != "" && b.EndsWith(suffix, StringComparison.Ordinal) && b != suffix) b = b[..^suffix.Length];
        ctx.Out(b + "\n");
        return 0;
    });

    private static readonly CommandDef DirnameCmd = Simple("dirname", "Tar bort filnamnet från en sökväg", ctx =>
    {
        if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
        var p = ctx.Args[0];
        string result;
        if (!p.Contains('/')) result = ".";
        else if (p.StartsWith('/')) result = VfsLib.Dirname(p);
        else
        {
            var d = VfsLib.Dirname("/" + p).Slice(1);
            result = d != "" ? d : ".";
        }
        ctx.Out(result + "\n");
        return 0;
    });

    public static List<CommandDef> All { get; } = new()
    {
        Whoami, Id, Groups, Hostname, Uname, Date, EnvCmd("env"), EnvCmd("printenv"), Export, Unset, Alias, Unalias,
        History, TypeCmd, Which, Man, Help, Clear, ExitCmd, Logout, Sudo, Su, Bash, Bash.With(name: "sh"), Source, Dot,
        TrueCmd, FalseCmd, Sleep, Seq, BasenameCmd, DirnameCmd,
    };
}
