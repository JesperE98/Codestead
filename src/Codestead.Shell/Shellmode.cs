namespace Codestead.Shell;

// Port of src/shell/shellmode.ts – shells other than bash: zsh and fish. The shell keeps a stack of
// started shells (`zsh` starts zsh, `exit` goes back). Here are the prompts, what happens when a
// shell starts (greeting, ~/.zshrc, config.fish) and fish universal variables.

/// <summary>The parent shell's state, restored on exit.</summary>
public partial class ShellFrameSaved
{
    public string Cwd { get; set; } = "";
    public OrderedDictionary<string, string> Env { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, string> Aliases { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, Node> Functions { get; set; } = Js.Obj<Node>();
}

/// <summary>A shell started on top of the first bash shell.</summary>
public partial class ShellFrame
{
    public ShellMode Mode { get; set; } = "bash";
    public int Pid { get; set; }
    /// <summary>Number of logged-in users (UserStack) when the shell started.</summary>
    public int UserDepth { get; set; }
    /// <summary>Settings made with setopt (zsh), e.g. autocd.</summary>
    public OrderedDictionary<string, bool> Options { get; set; } = Js.Obj<bool>();
    /// <summary>The parent shell's state, restored on exit.</summary>
    public ShellFrameSaved Saved { get; set; } = new();
    /// <summary>The shell was started with sudo – exit also leaves root.</summary>
    public bool? PushedUser { get; set; }
}

public static partial class ShellmodeLib
{
    public static OrderedDictionary<ShellMode, string> ShellPaths { get; } = new(StringComparer.Ordinal)
    {
        ["bash"] = "/bin/bash",
        ["zsh"] = "/usr/bin/zsh",
        ["fish"] = "/usr/bin/fish",
    };

    public const string ZshVersion = "5.9";

    public static string FishVersion(Shell sh) => sh.Distro.Family switch
    {
        "debian" => "3.7.0",
        "arch" => "4.1.2",
        "redhat" => "4.0.2",
        _ => throw new ArgumentOutOfRangeException(nameof(sh), sh.Distro.Family, null),
    };

    /// <summary>Which shell a path like /usr/bin/zsh or "fish" means (null if unknown).</summary>
    public static ShellMode? ModeOf(string path)
    {
        var name = VfsLib.Basename(path.Trim());
        if (name == "zsh" || name == "fish" || name == "bash") return name;
        if (name == "sh") return "bash";
        return null;
    }

    private static readonly Regex ShebangRe = new(@"^#!\s*(\S+)(?:[ \t]+(\S+))?", RegexOptions.CultureInvariant);

    /// <summary>The shell a script should run with, according to the #! line at the top (null if none or unknown).</summary>
    public static (ShellMode Mode, string Interpreter)? Shebang(string content)
    {
        var m = ShebangRe.Match(content);
        if (!m.Success) return null;
        var prog = VfsLib.Basename(m.Groups[1].Value) == "env" && m.Groups[2].Success && m.Groups[2].Value != ""
            ? m.Groups[2].Value
            : m.Groups[1].Value;
        var mode = ModeOf(prog);
        return mode is not null ? (mode, m.Groups[1].Value) : null;
    }

    public static Proc ShellProc(int pid, int ppid, string user, ShellMode mode) => new()
    {
        Pid = pid,
        Ppid = ppid,
        User = user,
        Cmd = mode,
        Cpu = 0,
        Mem = 0.1,
        Vsz = mode == "fish" ? 245_000 : 12_500,
        Rss = mode == "fish" ? 9_800 : 5_600,
        Tty = "pts/0",
        Stat = "S",
        Start = Js.LocalNow().ToString("HH:mm", CultureInfo.InvariantCulture),
        Time = "0:00",
    };

    // ---------- Prompts ----------

    private static readonly Dictionary<string, int> Colors = new()
    {
        ["black"] = 30, ["red"] = 31, ["green"] = 32, ["yellow"] = 33, ["blue"] = 34, ["magenta"] = 35, ["cyan"] = 36, ["white"] = 37,
    };

    private static readonly Regex ZshPromptRe = new(@"%([0-9]*)([~nmMd/c#%BbFfT*])(\{[^}]*\})?", RegexOptions.CultureInvariant);
    private static readonly Regex SingleDigitRe = new(@"^[0-9]\z", RegexOptions.CultureInvariant);

    /// <summary>Interprets the zsh prompt's %-codes: %n, %m, %~, %1~, %#, %F{colour} …</summary>
    public static string ZshPrompt(Shell sh, string format)
    {
        var u = sh.CurrentUser();
        string Tilde(string p) =>
            p == u.Home ? "~" : p.StartsWith(u.Home + "/", StringComparison.Ordinal) ? "~" + p.Slice(u.Home.Length) : p;
        return ZshPromptRe.Replace(format, m =>
        {
            var num = m.Groups[1].Value;
            var code = m.Groups[2].Value;
            string? arg = m.Groups[3].Success ? m.Groups[3].Value : null;
            switch (code)
            {
                case "n":
                    return u.Name;
                case "m":
                    return sh.Distro.Hostname.Split('.')[0];
                case "M":
                    return sh.Distro.Hostname;
                case "~":
                case "d":
                case "/":
                case "c":
                {
                    var full = code == "~" || code == "c" ? Tilde(sh.Cwd) : sh.Cwd;
                    double n = code == "c" ? 1 : Js.Number(num != "" ? num : "0");
                    if (n == 0 || double.IsNaN(n) || full == "/" || full == "~") return full;
                    var parts = full.Split('/').Where(p => p != "").ToList();
                    return string.Join("/", parts.Slice(-(int)Math.Min(n, parts.Count)));
                }
                case "#":
                    return u.Uid == 0 ? "#" : "%";
                case "%":
                    return "%";
                case "B":
                    return "\x1b[1m";
                case "b":
                    return "\x1b[22m";
                case "F":
                {
                    var name = arg is not null ? arg.Slice(1, -1) : "";
                    int? c = Colors.TryGetValue(name, out var col) ? col : SingleDigitRe.IsMatch(name) ? 30 + (name[0] - '0') : null;
                    return c is int ci && ci != 0 ? $"\x1b[{ci}m" : "";
                }
                case "f":
                    return "\x1b[39m";
                case "T":
                    return Js.LocalNow().ToString("HH:mm", CultureInfo.InvariantCulture);
                case "*":
                    return Js.LocalNow().ToString("HH:mm:ss", CultureInfo.InvariantCulture);
            }
            return "";
        });
    }

    /// <summary>fish shortens the path: /home/elev/dokument/projekt -> ~/d/projekt</summary>
    public static string FishPwd(Shell sh)
    {
        var home = sh.CurrentUser().Home;
        var p = sh.Cwd == home ? "~" : sh.Cwd.StartsWith(home + "/", StringComparison.Ordinal) ? "~" + sh.Cwd.Slice(home.Length) : sh.Cwd;
        var parts = p.Split('/');
        return string.Join("/", parts.Select((s, i) =>
            i == parts.Length - 1 || s == "" || s == "~" ? s : s.StartsWith('.') ? s.Slice(0, 2) : s[0].ToString()));
    }

    public static string ShellPrompt(Shell sh, ShellMode mode)
    {
        var u = sh.CurrentUser();
        if (mode == "zsh") return ZshPrompt(sh, sh.Env.Get("PROMPT") ?? sh.Env.Get("PS1") ?? "%m%# ");
        bool root = u.Uid == 0;
        return $"\x1b[32m{u.Name}\x1b[0m@{sh.Distro.Hostname} \x1b[{(root ? 31 : 32)}m{FishPwd(sh)}\x1b[0m{(root ? "#" : ">")} ";
    }

    // ---------- Startup ----------

    private const string Newuser = """
        This is the Z Shell configuration function for new users,
        zsh-newuser-install.
        You are seeing this message because you have no zsh startup files
        (the files .zshenv, .zprofile, .zshrc, .zlogin in the directory
        ~).  This function can help you with a few settings that should
        make your use of the shell easier.

        You can:

        (q)  Quit and do nothing.  The function will be run again next time.

        (0)  Exit, creating the file ~/.zshrc containing just a comment.
             That will prevent this function being run again.

        (1)  Continue to the main menu.

        (2)  Populate your ~/.zshrc with the configuration recommended
             by the system administrator and exit (you will need to edit
             the file by hand, if so desired).
        """ + "\n\n";

    public const string ZshrcRecommended = """
        # ~/.zshrc – körs av zsh för interaktiva skal.
        # Skapad av zsh-newuser-install med de rekommenderade inställningarna.

        # Prompten: användare@dator katalog %
        PROMPT='%n@%m %1~ %# '

        HISTSIZE=1000
        SAVEHIST=1000
        HISTFILE=~/.zsh_history

        # Skriv bara ett katalognamn för att gå dit (utan cd).
        setopt autocd
        setopt histignorealldups sharehistory
        """ + "\n";

    public const string ConfigFish = """
        if status is-interactive
            # Commands to run in interactive sessions can go here
        end
        """ + "\n";

    private const string Dim = "\x1b[2m";
    private const string Reset = "\x1b[0m";

    private static void WriteHomeFile(Shell sh, string rel, string content)
    {
        var user = sh.CurrentUser();
        var path = $"{user.Home}/{rel}";
        // Js.Slice explicitly: List<T>.Slice(start, count) would win over the extension method.
        var parts = Js.Slice(rel.Split('/').ToList(), 0, -1);
        var dir = user.Home;
        foreach (var p in parts)
        {
            dir += "/" + p;
            if (sh.Vfs.TryLookup(dir, user) is null) sh.Vfs.Mkdir(dir, user);
        }
        sh.Vfs.WriteFile(path, content, user);
    }

    private static void SourceFile(Shell sh, string rel, ShellMode mode, Sink io)
    {
        var user = sh.CurrentUser();
        var node = sh.Vfs.TryLookup($"{user.Home}/{rel}", user);
        if (node?.Type != "file") return;
        sh.RunScript(node.Content ?? "", $"{user.Home}/{rel}", new List<string>(), new IO(io.OutFn, io.ErrFn, null, false), true, mode);
    }

    /// <summary>Runs when a new interactive zsh or fish shell starts.</summary>
    public static void ShellStartup(Shell sh, ShellMode mode, Sink io)
    {
        var user = sh.CurrentUser();
        if (mode == "zsh")
        {
            bool hasRc = new[] { ".zshrc", ".zshenv", ".zprofile", ".zlogin" }.Any(f => sh.Vfs.TryLookup($"{user.Home}/{f}", user) is not null);
            if (hasRc)
            {
                SourceFile(sh, ".zshrc", "zsh", io);
                return;
            }
            io.Out(Newuser);
            sh.AskText("--- Type one of the keys in parentheses --- ", (text, @out) =>
            {
                var key = text.Trim();
                if (key == "0")
                {
                    WriteHomeFile(sh, ".zshrc", "# Created by newuser for 5.9\n");
                }
                else if (key == "1" || key == "2")
                {
                    if (key == "1")
                    {
                        @out.Out($"{Dim}{sh.Msg("shellmode.zshMainMenu")}{Reset}\n");
                    }
                    WriteHomeFile(sh, ".zshrc", ZshrcRecommended);
                    SourceFile(sh, ".zshrc", "zsh", @out);
                }
                return 0;
            });
            return;
        }
        if (mode == "fish")
        {
            if (sh.Vfs.TryLookup($"{user.Home}/.config/fish/config.fish", user) is null) WriteHomeFile(sh, ".config/fish/config.fish", ConfigFish);
            LoadUniversalVars(sh);
            SourceFile(sh, ".config/fish/config.fish", "fish", io);
            var greeting = sh.Env.Get("fish_greeting") ?? "Welcome to fish, the friendly interactive shell\nType help for instructions on how to use fish";
            if (greeting != "") io.Out(greeting + "\n");
        }
    }

    // ---------- fish: universal variables (set -U) in ~/.config/fish/fish_variables ----------

    private const string Uvars = ".config/fish/fish_variables";

    private static readonly Regex UvarLineRe = new(@"^SETUVAR (?:--export )?([A-Za-z_][A-Za-z0-9_]*):([^\n\r  ]*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex UvarHexRe = new(@"\\x([0-9a-f]{2})", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private static readonly Regex UvarEncRe = new(@"[^A-Za-z0-9_/.~-]", RegexOptions.CultureInvariant);

    private static string UvarPath(Shell sh) => $"{sh.CurrentUser().Home}/{Uvars}";

    private static OrderedDictionary<string, string> ReadUvars(Shell sh)
    {
        var content = sh.Vfs.TryLookup(UvarPath(sh), sh.CurrentUser())?.Content ?? "";
        var vars = Js.Obj<string>();
        foreach (var line in content.Split('\n'))
        {
            var m = UvarLineRe.Match(line);
            if (m.Success)
                vars[m.Groups[1].Value] = UvarHexRe.Replace(m.Groups[2].Value.Replace("\\x1e", " "),
                    x => ((char)Convert.ToInt32(x.Groups[1].Value, 16)).ToString());
        }
        return vars;
    }

    private static void LoadUniversalVars(Shell sh)
    {
        foreach (var (k, v) in ReadUvars(sh)) if (!sh.Env.ContainsKey(k)) sh.Env[k] = v;
    }

    /// <summary>Saves (or removes, with value null) a universal variable.</summary>
    public static void SaveUniversalVar(Shell sh, string name, string? value)
    {
        var vars = ReadUvars(sh);
        if (value is null) vars.Remove(name);
        else vars[name] = value;
        static string Enc(string v) => UvarEncRe.Replace(v, m =>
        {
            char c = m.Value[0];
            return c == ' ' ? "\\x1e" : $"\\x{((int)c).ToString("x", CultureInfo.InvariantCulture).PadLeft(2, '0')}";
        });
        // Object.entries(vars).sort() compares the entries as "key,value" strings.
        var lines = vars
            .OrderBy(kv => kv.Key + "," + kv.Value, StringComparer.Ordinal)
            .Select(kv => $"SETUVAR {kv.Key}:{Enc(kv.Value)}")
            .ToList();
        WriteHomeFile(
            sh,
            Uvars,
            $"# This file contains fish universal variable definitions.\n# VERSION: 3.0\n{string.Join("\n", lines)}{(lines.Count > 0 ? "\n" : "")}");
    }
}
