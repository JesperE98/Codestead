using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Port of src/shell/shell.ts – the shell itself: holds the state (file system, directory, variables,
// users, functions) and runs bash code – with pipes, redirection, aliases, wildcards, sudo,
// conditions, loops, functions, $(...) and $((...)).

public partial class ShellSnapshot
{
    public int Version { get; set; } = 1;
    public string DistroId { get; set; } = "";
    /// <summary>
    /// The language of the exercise files and the user name (see World.cs). Null in terminals saved before
    /// the world was translated: they are Swedish and are brought up to date by WorldMigration.
    /// </summary>
    public string? World { get; set; }
    public FsNode Fs { get; set; } = null!;
    public string Cwd { get; set; } = "";
    public OrderedDictionary<string, string> Env { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, string> Aliases { get; set; } = Js.Obj<string>();
    public List<string> History { get; set; } = new();
    public OrderedDictionary<string, string> Installed { get; set; } = Js.Obj<string>();
    public OrderedDictionary<string, bool> Flags { get; set; } = Js.Obj<bool>();
    public List<string> UserStack { get; set; } = new();
    public OrderedDictionary<string, Node>? Functions { get; set; }
    public ProcState? Proc { get; set; }
    public ServiceState? Services { get; set; }
    /// <summary>zsh/fish shells started on top of the first bash shell.</summary>
    public List<ShellFrame>? Shells { get; set; }
    public DiskState? Disks { get; set; }
}

public partial class ExecResult
{
    /// <summary>The command line that ran (when answering a question: the original line).</summary>
    public string Line { get; set; } = "";
    public string Output { get; set; } = "";
    public int ExitCode { get; set; }
    public bool Clear { get; set; }
    /// <summary>True if a command waits for an answer (e.g. "Do you want to continue? [Y/n]").</summary>
    public bool Pending { get; set; }
    /// <summary>True if the line was not finished (e.g. a for loop without "done") – the shell waits for more lines.</summary>
    public bool Incomplete { get; set; }
}

public partial class Pending
{
    public string Question { get; set; } = "";
    public bool DefaultYes { get; set; }
    public string User { get; set; } = "";
    public string Line { get; set; } = "";
    public required Func<bool, Sink, string, int> OnAnswer { get; set; }
    /// <summary>The rest of the command line, run when the question has been answered.</summary>
    internal Func<XIO, int>? Resume { get; set; }
    /// <summary>The answer is secret (a password): the terminal does not show what is typed.</summary>
    public bool Secret { get; set; }
}

/// <summary>Internal IO object while code runs: stdin is a shared reader.</summary>
internal sealed class XIO : Sink
{
    public Reader? Stdin { get; set; }
    public bool Tty { get; set; }

    public XIO(Action<string> @out, Action<string> err, Reader? stdin, bool tty) : base(@out, err)
    {
        Stdin = stdin;
        Tty = tty;
    }
}

/// <summary>Result of looking up a command name: "notfound", "error", "binary" or "script".</summary>
public sealed partial class ResolvedCommand
{
    public string Kind { get; init; } = "notfound";
    public string Message { get; init; } = "";
    public string Impl { get; init; } = "";
    public string Path { get; init; } = "";
    public string Content { get; init; } = "";
}

public partial class Shell
{
    public const string Dim = "\x1b[2m";
    public const string Reset = "\x1b[0m";

    /// <summary>Maximum number of commands/iterations per run before the shell stops (protects against infinite loops).</summary>
    private const int StepLimit = 20_000;

    public Distro Distro { get; set; }
    public VFS Vfs { get; set; }
    public string Cwd { get; set; }
    public OrderedDictionary<string, string> Env { get; set; }
    public OrderedDictionary<string, string> Aliases { get; set; }
    public List<string> History { get; set; }
    public OrderedDictionary<string, string> Installed { get; set; }
    public OrderedDictionary<string, bool> Flags { get; set; }
    public OrderedDictionary<string, Node> Functions { get; set; }
    /// <summary>Processes and background jobs.</summary>
    public ProcState Proc { get; set; }
    /// <summary>Services (systemd) and the journal.</summary>
    public ServiceState Services { get; set; } = null!;
    /// <summary>Disks, partitions and mounted file systems.</summary>
    public DiskState Disks { get; set; }
    /// <summary>PID of the most recently started background job ($!).</summary>
    public int? LastBgPid { get; set; }
    /// <summary>Logged-in users; the last one is active. `sudo -i` adds root, `exit` removes it.</summary>
    public List<string> UserStack { get; set; }
    /// <summary>Shells started with `zsh`, `fish` or `bash` (ended with exit).</summary>
    public List<ShellFrame> ShellStack { get; set; }
    public int LastExit { get; set; }
    public Pending? PendingQuestion { get; set; }
    /// <summary>
    /// The language of the exercise files and the user name (see World.cs). Changed with
    /// <see cref="WorldMigration.Translate"/>, which also renames what is already there.
    /// </summary>
    public World World { get; internal set; }
    /// <summary>
    /// The UI language code (en, sv, de ...). Controls the simulator's own hint lines and help summaries
    /// (see <see cref="ShellI18n"/>); man pages are Swedish for "sv" and English otherwise.
    /// </summary>
    public string Lang { get; set; } = "sv";

    public int ScriptDepth { get; set; }
    public int FuncDepth { get; set; }
    public int LoopDepth { get; set; }

    private readonly List<string> overrides = new();
    private bool clearRequested;
    private string currentLine = "";
    private readonly List<List<string>> positional = new();
    private readonly List<Dictionary<string, string?>> locals = new();
    /// <summary>Started multi-line code (e.g. after "for i in 1 2 3").</summary>
    private string? partial;
    private int steps;
    private int listDepth;
    private int substDepth;
    /// <summary>The shell a script runs with (according to #! or e.g. `zsh script.sh`).</summary>
    private readonly List<ShellMode> modeOverride = new();

    private Shell(ShellSnapshot s)
    {
        Distro = DistrosLib.GetDistro(s.DistroId);
        World = Codestead.Shell.World.Get(s.World ?? WorldMigration.LegacyWorld);
        Vfs = new VFS(s.Fs);
        Cwd = s.Cwd;
        Env = s.Env;
        Aliases = s.Aliases;
        History = s.History;
        Installed = s.Installed;
        Flags = s.Flags;
        Functions = s.Functions ?? Js.Obj<Node>();
        Proc = s.Proc ?? ProcsLib.InitialProcs(Distro, World.User);
        Disks = s.Disks ?? DisksLib.SetupDisks(Distro, Vfs, World);
        UserStack = s.UserStack.Count > 0 ? s.UserStack : new List<string> { World.User };
        Services = s.Services ?? ServicesLib.InitialServices(this);
        ShellStack = s.Shells ?? new List<ShellFrame>();
    }

    /// <summary>A new computer. <paramref name="world"/> is the language of the exercise files and the user name.</summary>
    public static Shell Create(string distroId, string world = Codestead.Shell.World.Source)
    {
        var distro = DistrosLib.GetDistro(distroId);
        var w = Codestead.Shell.World.Get(world);
        var home = w.Home;
        var env = Js.Obj<string>();
        env["HOME"] = home;
        env["USER"] = w.User;
        env["LOGNAME"] = w.User;
        env["SHELL"] = "/bin/bash";
        env["PATH"] = "/usr/local/bin:/usr/bin:/bin";
        env["PWD"] = home;
        env["LANG"] = w.Locale;
        env["TERM"] = "xterm-256color";
        var sh = new Shell(new ShellSnapshot
        {
            Version = 1,
            DistroId = distro.Id,
            World = w.Lang,
            Fs = InitfsLib.BuildFs(distro, w),
            Cwd = home,
            Env = env,
            UserStack = new List<string> { w.User },
        });
        sh.AddMissingDefaults();
        return sh;
    }

    public static Shell? Restore(ShellSnapshot? s)
    {
        if (s is null || s.Version != 1 || s.Fs is null || string.IsNullOrEmpty(s.DistroId)) return null;
        // Terminals saved before the world was translated: new program names, and a known world (Swedish).
        if (s.World is null) s = WorldMigration.MigrateLegacy(s);
        var sh = new Shell(s);
        sh.AddMissingDefaults();
        return sh;
    }

    /// <summary>Restores from JSON (as saved by <see cref="SnapshotJson"/>). Returns null if it is unusable.</summary>
    public static Shell? RestoreJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return Restore(Js.Parse<ShellSnapshot>(json));
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Installs preinstalled packages and exercise files that are missing – e.g. when the app has been
    /// updated with new chapters after the terminal was saved. What the shell added once (and the student
    /// then removed on purpose) is not put back.
    /// </summary>
    private void AddMissingDefaults()
    {
        var family = Distro.Family;
        foreach (var pkg in PackagesLib.Packages)
        {
            if (pkg.Names.Get(family) is null || !((pkg.Base?.Contains(family) ?? false) || (pkg.BaseDistros?.Contains(Distro.Id) ?? false))) continue;
            var key = $"default:pkg:{pkg.Id}";
            if (Flags.ContainsKey(key) && Flags[key]) continue;
            if (!Installed.ContainsKey(pkg.Id)) PackagesLib.InstallPackage(this, pkg);
            Flags[key] = true;
        }
        // New commands in packages that are already installed (e.g. mount in util-linux).
        foreach (var pkg in PackagesLib.Packages)
        {
            if (!Installed.ContainsKey(pkg.Id)) continue;
            foreach (var cmd in pkg.Provides)
            {
                var key = $"default:cmd:{cmd}";
                if (Flags.ContainsKey(key) && Flags[key]) continue;
                if (Vfs.TryLookup($"/usr/bin/{cmd}", RootUser()) is null) PackagesLib.InstallCommand(this, cmd);
                Flags[key] = true;
            }
        }
        var fresh = new VFS(InitfsLib.BuildFs(Distro, World));
        var root = RootUser();
        var home = World.Home;
        void Walk(string path)
        {
            var node = fresh.TryLookup(path, root);
            if (node is null) return;
            var key = $"default:file:{path}";
            if (!(Flags.ContainsKey(key) && Flags[key]))
            {
                Flags[key] = true;
                if (Vfs.TryLookup(path, root) is null && Vfs.TryLookup(VfsLib.Dirname(path), root)?.Type == "dir")
                {
                    Vfs.Insert(path, node, root);
                    return;
                }
            }
            if (node.Type == "dir") foreach (var name in node.Children!.Keys.ToList()) Walk($"{path}/{name}");
        }
        Walk($"{home}/{World["documents"]}");
        Walk($"{home}/{World["webProject"]}");
        // The template for new home directories (useradd -m) and the settings for useradd.
        Walk("/etc/skel");
        Walk("/etc/login.defs");
        // The networking chapter: the DNS setting and the exercise server.
        Walk("/etc/resolv.conf");
        Walk("/usr/local/bin/myserver");
        Walk($"{home}/{World["downloads"]}");
    }

    public ShellSnapshot Snapshot() => new()
    {
        Version = 1,
        DistroId = Distro.Id,
        World = World.Lang,
        Fs = Vfs.Root,
        Cwd = Cwd,
        Env = Env,
        Aliases = Aliases,
        History = History,
        Installed = Installed,
        Flags = Flags,
        UserStack = UserStack,
        Functions = Functions,
        Proc = Proc,
        Services = Services,
        Shells = ShellStack,
        Disks = Disks,
    };

    /// <summary>The snapshot as JSON, for saving.</summary>
    public string SnapshotJson() => Js.Stringify(Snapshot());

    // ---------- Users ----------

    /// <summary>The user according to /etc/passwd and /etc/group (see Users.cs).</summary>
    public User GetUser(string name) => UsersLib.LookupUser(this, name);

    public User RootUser() => GetUser("root");

    public User CurrentUser() => GetUser(overrides.Count > 0 ? overrides[^1] : UserStack.Count > 0 ? UserStack[^1] : World.User);

    /// <summary>Runs fn as another user (used by sudo).</summary>
    public T RunAs<T>(string user, Func<T> fn)
    {
        overrides.Add(user);
        try
        {
            return fn();
        }
        finally
        {
            overrides.RemoveAt(overrides.Count - 1);
        }
    }

    public string Home => Env.TryGetValue("HOME", out var h) ? h : World.Home;

    public string Resolve(string path) => VfsLib.ResolvePath(Cwd, path);

    /// <summary>The simulator's own message <paramref name="key"/> in the shell's language (see <see cref="ShellI18n"/>).</summary>
    public string Msg(string key, params (string Name, object? Value)[] args) => ShellI18n.Msg(Lang, key, args);

    /// <summary>A whole number formatted for the shell's language (10 000, 10,000, 10.000 ...).</summary>
    public string FormatNumber(long n) => n.ToString("N0", ShellI18n.Culture(Lang));

    public void RequestClear() => clearRequested = true;

    /// <summary>Asks the user yes/no. The answer is handled on the next Execute().</summary>
    public void Ask(string question, bool defaultYes, Func<bool, Sink, int> onAnswer)
    {
        PendingQuestion = new Pending
        {
            Question = question,
            DefaultYes = defaultYes,
            OnAnswer = (yes, io, _) => onAnswer(yes, io),
            User = CurrentUser().Name,
            Line = currentLine,
        };
    }

    /// <summary>Asks the user to type a line of text (used by `read`). With secret the answer is not shown (passwords).</summary>
    public void AskText(string prompt, Func<string, Sink, int> onText, bool secret = false)
    {
        PendingQuestion = new Pending
        {
            Question = prompt,
            DefaultYes = false,
            OnAnswer = (_, io, text) => onText(text, io),
            User = CurrentUser().Name,
            Line = currentLine,
            Secret = secret,
        };
    }

    /// <summary>Can `read` ask the user directly? Only on the command line, not inside scripts.</summary>
    public bool CanAskInteractively() => ScriptDepth == 0 && substDepth == 0;

    /// <summary>Cancels a question or a started multi-line command line (Ctrl+C).</summary>
    public void Cancel()
    {
        PendingQuestion = null;
        partial = null;
    }

    // ---------- Other shells (zsh, fish) ----------

    /// <summary>The shell interpreting the commands right now.</summary>
    public ShellMode ShellMode
    {
        get
        {
            if (modeOverride.Count > 0) return modeOverride[^1];
            var top = ShellStack.Count > 0 ? ShellStack[^1] : null;
            return top is not null && top.UserDepth == UserStack.Count ? top.Mode : "bash";
        }
    }

    /// <summary>True when commands are typed directly in the terminal (not in a script or $(...)).</summary>
    public bool Interactive => modeOverride.Count == 0 && substDepth == 0;

    /// <summary>Starts a new interactive shell (zsh, fish or bash) on top of the current one.</summary>
    public int StartShell(ShellMode mode, Sink io)
    {
        int pid = Proc.NextPid++;
        int ppid = ShellStack.Count > 0 ? ShellStack[^1].Pid : ProcsLib.ShellPid;
        var user = CurrentUser();
        Proc.Procs.Add(ShellmodeLib.ShellProc(pid, ppid, user.Name, mode));
        var saved = new ShellFrameSaved { Cwd = Cwd, Env = Js.Copy(Env), Aliases = Aliases, Functions = Functions };
        // `sudo zsh` gives a shell as root.
        bool pushedUser = user.Name != (UserStack.Count > 0 ? UserStack[^1] : null);
        if (pushedUser)
        {
            UserStack.Add(user.Name);
            Env["USER"] = user.Name;
            Env["HOME"] = user.Home;
        }
        ShellStack.Add(new ShellFrame { Mode = mode, Pid = pid, UserDepth = UserStack.Count, Options = Js.Obj<bool>(), Saved = saved, PushedUser = pushedUser });
        // Aliases and functions are not inherited by a new shell – environment variables are.
        Aliases = Js.Obj<string>();
        Functions = Js.Obj<Node>();
        ShellmodeLib.ShellStartup(this, mode, io);
        return 0;
    }

    /// <summary>Parses code with the current shell's syntax (fish is translated to bash first).</summary>
    private Node ParseCode(string text, ShellMode? mode = null)
    {
        mode ??= ShellMode;
        return ParserLib.Parse(mode == "fish" ? FishLib.TranslateFish(text, Lang) : text);
    }

    public string Prompt()
    {
        if (PendingQuestion is not null) return PendingQuestion.Question;
        if (partial is not null) return "> ";
        if (ShellMode != "bash") return ShellmodeLib.ShellPrompt(this, ShellMode);
        var u = CurrentUser();
        var p = Cwd;
        if (p == u.Home) p = "~";
        else if (p.StartsWith(u.Home + "/", StringComparison.Ordinal)) p = "~" + p[u.Home.Length..];
        var sym = u.Uid == 0 ? "#" : "$";
        var host = Distro.Hostname;
        return Distro.PromptStyle switch
        {
            "ubuntu" => u.Uid == 0
                ? $"{u.Name}@{host}:{p}{sym} "
                : $"\x1b[1;32m{u.Name}@{host}\x1b[0m:\x1b[1;34m{p}\x1b[0m{sym} ",
            "debian" => $"{u.Name}@{host}:{p}{sym} ",
            _ => $"[{u.Name}@{host} {(p == "~" || p == "/" ? p : VfsLib.Basename(p))}]{sym} ",
        };
    }

    public string Welcome()
    {
        var motd = Distro.Motd != "" ? Distro.Motd + "\n" : "";
        return motd + Dim +
            Msg("shell.welcome", ("distro", Distro.Name)) +
            $"{Reset}\n";
    }

    // ---------- Running ----------

    private static readonly Regex YesRe = new("^(y|yes|j|ja)\\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public ExecResult Execute(string line)
    {
        clearRequested = false;
        steps = 0;
        var output = new StringBuilder();
        var term = new XIO(s => output.Append(s), s => output.Append(s), null, true);
        ExecResult Result(string l, bool incomplete = false) => new()
        {
            Line = l,
            Output = incomplete || PendingQuestion is not null ? output.ToString() : output + JobNotifications(),
            ExitCode = LastExit,
            Clear = clearRequested,
            Pending = PendingQuestion is not null,
            Incomplete = incomplete,
        };

        if (PendingQuestion is not null)
        {
            var p = PendingQuestion;
            PendingQuestion = null;
            var answer = line.Trim();
            bool yes = answer == "" ? p.DefaultYes : YesRe.IsMatch(answer);
            currentLine = p.Line;
            Guard(term, () =>
            {
                LastExit = RunAs(p.User, () => p.OnAnswer(yes, term, line));
                // If the answer asks a new question (e.g. "Retype new password:") the rest of the line runs after it.
                if (p.Resume is not null && PendingQuestion is not null) PendingQuestion.Resume ??= p.Resume;
                else if (p.Resume is not null) LastExit = p.Resume(term);
            });
            return Result(p.Line);
        }

        var text = partial is not null ? $"{partial}\n{line}" : line;
        Node ast;
        try
        {
            ast = ParseCode(text);
        }
        catch (ParseError e)
        {
            if (e.Incomplete && text.Split('\n').Length < 500)
            {
                partial = text;
                return Result(text, true);
            }
            partial = null;
            AddHistory(text);
            term.Err($"{ShellMode}: {e.Message}\n");
            LastExit = 2;
            return Result(ShellLib.FlattenLines(text));
        }
        partial = null;
        var flat = ShellLib.FlattenLines(text);
        AddHistory(flat);
        currentLine = flat;
        Guard(term, () => LastExit = Exec(ast, term));
        return Result(flat);
    }

    private void AddHistory(string text)
    {
        if (text.Trim() == "" || text.StartsWith(' ')) return;
        History.Add(ShellLib.FlattenLines(text));
        if (History.Count > 500) History.RemoveRange(0, History.Count - 500);
    }

    /// <summary>Runs fn and catches signals that must not leak out of a run.</summary>
    private void Guard(Sink io, Action fn)
    {
        try
        {
            fn();
        }
        catch (LimitError e)
        {
            io.Err($"\n{Dim}{e.Message}{Reset}\n");
            LastExit = 130;
        }
        catch (ExitSignal e)
        {
            LastExit = e.Code;
        }
        catch (ReturnSignal e)
        {
            LastExit = e.Code;
        }
        catch (LoopSignal)
        {
            // ignored
        }
        finally
        {
            listDepth = 0;
        }
    }

    private void Tick()
    {
        if (++steps > StepLimit)
        {
            throw new LimitError(Msg("shell.stepLimit", ("steps", FormatNumber(StepLimit))));
        }
    }

    /// <summary>Runs a line (or a whole script) in the current shell.</summary>
    public int RunLine(string line, Sink sink)
    {
        try
        {
            return LastExit = Exec(ParseCode(line), new XIO(sink.OutFn, sink.ErrFn, null, false));
        }
        catch (ParseError e)
        {
            sink.Err($"{ShellMode}: {e.Message}\n");
            return LastExit = 2;
        }
    }

    private int Exec(Node node, XIO io)
    {
        int code;
        switch (node)
        {
            case ListNode list:
            {
                if (list.Items.Count == 0) return LastExit;
                listDepth++;
                code = LastExit;
                try
                {
                    for (int k = 0; k < list.Items.Count; k++)
                    {
                        code = list.Items[k].Background ? StartJob(list.Items[k].Node, io) : Exec(list.Items[k].Node, io);
                        if (PendingQuestion is not null)
                        {
                            // A question (e.g. from read or apt) – run the rest when it has been answered.
                            var rest = list.Items.Skip(k + 1).ToList();
                            if (listDepth == 1 && rest.Count > 0 && PendingQuestion.Resume is null)
                            {
                                PendingQuestion.Resume = io2 => Exec(new ListNode { Items = rest }, io2);
                            }
                            break;
                        }
                    }
                }
                finally
                {
                    listDepth--;
                }
                break;
            }
            case AndOrNode andor:
            {
                code = Exec(andor.First, io);
                foreach (var item in andor.Rest)
                {
                    if (PendingQuestion is not null) break;
                    if ((item.Op == "&&" && code != 0) || (item.Op == "||" && code == 0)) continue;
                    code = Exec(item.Node, io);
                }
                break;
            }
            case PipelineNode pipeline:
            {
                var input = io.Stdin;
                code = 0;
                for (int i = 0; i < pipeline.Commands.Count; i++)
                {
                    bool last = i == pipeline.Commands.Count - 1;
                    var buf = new StringBuilder();
                    var stage = new XIO(last ? io.OutFn : s => buf.Append(s), io.ErrFn, input, last && io.Tty);
                    code = Exec(pipeline.Commands[i], stage);
                    input = new Reader(buf.ToString(), 0);
                }
                if (pipeline.Negate) code = code == 0 ? 1 : 0;
                break;
            }
            case SimpleNode simple:
                code = RunSimple(simple, io);
                break;
            case FuncDefNode funcdef:
                Functions[funcdef.Name] = funcdef.Body;
                code = 0;
                break;
            case CompoundNode compound:
                code = WithRedirects(compound.Redirects, io, rio => ExecCompound(compound, rio));
                break;
            default:
                throw new InvalidOperationException($"Unknown node {node.Type}");
        }
        LastExit = code;
        return code;
    }

    private int ExecCompound(CompoundNode node, XIO io)
    {
        switch (node)
        {
            case IfNode ifNode:
            {
                foreach (var clause in ifNode.Clauses)
                {
                    if (Exec(clause.Cond, io) == 0) return Exec(clause.Body, io);
                    if (PendingQuestion is not null) return 0;
                }
                return ifNode.ElseBody is not null ? Exec(ifNode.ElseBody, io) : 0;
            }
            case ForNode forNode:
            {
                var values = forNode.Words is not null
                    ? forNode.Words.SelectMany(w => ExpandWord(w, io)).ToList()
                    : (positional.Count > 0 ? positional[^1] : new List<string> { "bash" }).Skip(1).ToList();
                int code = 0;
                RunLoop(
                    () => values.Count > 0,
                    () =>
                    {
                        var v = values[0];
                        values.RemoveAt(0);
                        SetVar(forNode.Name, v);
                        code = Exec(forNode.Body, io);
                    });
                return code;
            }
            case CForNode cfor:
            {
                int code = 0;
                if (!Arith(cfor.Init, io).Ok) return 1;
                RunLoop(
                    () =>
                    {
                        var r = cfor.Cond.Trim() != "" ? Arith(cfor.Cond, io) : (Ok: true, Value: 1L);
                        return r.Ok && r.Value != 0;
                    },
                    () => code = Exec(cfor.Body, io),
                    () => Arith(cfor.Step, io));
                return code;
            }
            case WhileNode whileNode:
            {
                int code = 0;
                RunLoop(
                    () =>
                    {
                        var c = Exec(whileNode.Cond, io);
                        return whileNode.Until ? c != 0 : c == 0;
                    },
                    () => code = Exec(whileNode.Body, io));
                return code;
            }
            case CaseNode caseNode:
            {
                var value = string.Join(" ", ExpandWord(caseNode.Word, io, split: false, glob: false));
                foreach (var item in caseNode.Items)
                {
                    if (item.Patterns.Any(p => ParserLib.GlobToRegex(ExpandPattern(p, io), true).IsMatch(value)))
                    {
                        return item.Body is not null ? Exec(item.Body, io) : 0;
                    }
                }
                return 0;
            }
            case GroupNode group:
            {
                if (!group.Subshell) return Exec(group.Body, io);
                var saved = (Cwd, Env: Js.Copy(Env), Functions: Js.Copy(Functions));
                try
                {
                    return Exec(group.Body, io);
                }
                catch (ExitSignal e)
                {
                    return e.Code;
                }
                finally
                {
                    Cwd = saved.Cwd;
                    Env = saved.Env;
                    Functions = saved.Functions;
                }
            }
            case ArithNode arith:
            {
                var r = Arith(arith.Expr, io);
                return r.Ok && r.Value != 0 ? 0 : 1;
            }
        }
        throw new InvalidOperationException($"Unknown node {node.Type}");
    }

    /// <summary>Shared loop logic with break/continue and protection against infinite loops.</summary>
    private void RunLoop(Func<bool> cond, Action body, Action? step = null)
    {
        LoopDepth++;
        try
        {
            for (; ; )
            {
                Tick();
                if (!cond() || PendingQuestion is not null) break;
                try
                {
                    body();
                }
                catch (LoopSignal e)
                {
                    if (e.Levels > 1)
                    {
                        e.Levels--;
                        throw;
                    }
                    if (e.Kind == "break") break;
                }
                if (PendingQuestion is not null) break;
                step?.Invoke();
            }
        }
        finally
        {
            LoopDepth--;
        }
    }

    private (bool Ok, long Value) Arith(string expr, Sink io)
    {
        try
        {
            var value = ArithLib.EvalArith(ExpandString(expr, io), new ArithVars
            {
                Get = GetVar,
                Set = SetVar,
            });
            return (true, value);
        }
        catch (ArithError e)
        {
            io.Err($"bash: {expr.Trim()}: {e.Message}\n");
            return (false, 0);
        }
    }

    /// <summary>Applies redirections (&gt; &gt;&gt; &lt; 2&gt; 2&gt;&amp;1 &amp;&gt;) around fn.</summary>
    private int WithRedirects(List<Redirect> redirects, XIO io, Func<XIO, int> fn)
    {
        if (redirects.Count == 0) return fn(io);
        var user = CurrentUser();
        var stdin = io.Stdin;
        string? stdoutTarget = null;
        string? stderrTarget = null; // a path or "stdout" (the special marker below)
        bool stderrToStdout = false;
        bool stdoutToStderr = false;
        foreach (var r in redirects)
        {
            if (r.Op == "2>&1")
            {
                stderrToStdout = true;
                stderrTarget = null;
                continue;
            }
            if (r.Op == ">&2")
            {
                stdoutToStderr = true;
                continue;
            }
            if (r.Op == "<<" || r.Op == "<<-")
            {
                stdin = new Reader(r.Expand == true ? ExpandString(r.Body ?? "", io) : r.Body ?? "", 0);
                continue;
            }
            if (r.Op == "<<<")
            {
                stdin = new Reader(string.Join(" ", ExpandWord(r.Target!, io, split: false, glob: false)) + "\n", 0);
                continue;
            }
            var targets = ExpandWord(r.Target!, io);
            if (targets.Count != 1)
            {
                io.Err($"bash: {r.Target!.Raw}: ambiguous redirect\n");
                return 1;
            }
            var path = Resolve(targets[0]);
            try
            {
                if (r.Op == "<")
                {
                    stdin = new Reader(Vfs.ReadFile(path, user), 0);
                }
                else if (r.Op == ">" || r.Op == "&>" || r.Op == ">>")
                {
                    // The file is created/emptied before the command runs – just like in bash.
                    Vfs.WriteFile(path, "", user, r.Op == ">>");
                    stdoutTarget = path;
                    if (r.Op == "&>")
                    {
                        stderrToStdout = true;
                        stderrTarget = null;
                    }
                }
                else
                {
                    Vfs.WriteFile(path, "", user, r.Op == "2>>");
                    stderrTarget = path;
                    stderrToStdout = false;
                }
            }
            catch (FsError e)
            {
                io.Err($"bash: {targets[0]}: {e.Message}\n");
                return 1;
            }
        }
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        Action<string> @out = stdoutTarget is not null ? s => stdout.Append(s) : stdoutToStderr ? io.ErrFn : io.OutFn;
        var rio = new XIO(
            @out,
            stderrToStdout ? @out : stderrTarget is not null ? s => stderr.Append(s) : io.ErrFn,
            stdin,
            io.Tty && stdoutTarget is null);
        try
        {
            return fn(rio);
        }
        finally
        {
            try
            {
                if (stdoutTarget is not null) Vfs.WriteFile(stdoutTarget, stdout.ToString(), user, true);
                if (stderrTarget is not null && !stderrToStdout) Vfs.WriteFile(stderrTarget, stderr.ToString(), user, true);
            }
            catch (FsError e)
            {
                io.Err($"bash: {e.Message}\n");
            }
        }
    }

    private static readonly Regex AssignRe = new("^([A-Za-z_][A-Za-z0-9_]*)=", RegexOptions.CultureInvariant);
    private static readonly HashSet<string> NoSplitCommands = new() { "export", "local", "readonly", "declare", "alias" };

    private int RunSimple(SimpleNode node, XIO io)
    {
        Tick();
        // Aliases: replace the first word if it is an alias.
        var words = node.Words;
        var first = words.Count > 0 ? words[0] : null;
        if (first is not null && first.Parts.Count == 1 && first.Parts[0].Quoted == "none" && Aliases.TryGetValue(first.Raw, out var aliasText))
        {
            var aliasWords = ParserLib.Tokenize(aliasText).OfType<WordTok>().Select(t => t.W);
            words = aliasWords.Concat(words.Skip(1)).ToList();
        }

        // Variable assignments first on the line: NAME=value (not split at spaces).
        var assignments = new List<(string Name, string Value)>();
        int k = 0;
        for (; k < words.Count; k++)
        {
            var firstPart = words[k].Parts.Count > 0 ? words[k].Parts[0] : null;
            var m = AssignRe.Match(firstPart?.Quoted == "none" ? firstPart.Text : "");
            if (!m.Success) break;
            var value = string.Concat(ExpandWord(words[k], io, split: false, glob: false));
            assignments.Add((m.Groups[1].Value, value[(m.Groups[1].Value.Length + 1)..]));
        }
        var cmdName = k < words.Count ? words[k].Raw : null;
        bool noSplit = NoSplitCommands.Contains(cmdName ?? "");
        // In [[ ... ]] there is no word splitting or filename expansion – patterns like *.txt are compared as text.
        bool literalArgs = cmdName == "[[";
        var argv = new List<string>();
        for (int idx = 0; idx < words.Count - k; idx++)
        {
            var w = words[k + idx];
            argv.AddRange(literalArgs
                ? ExpandWord(w, io, split: false, glob: false)
                : noSplit && idx > 0
                    ? ExpandWord(w, io, split: false)
                    : ExpandWord(w, io));
        }

        if (argv.Count == 0)
        {
            foreach (var (name, value) in assignments) SetVar(name, value);
            return WithRedirects(node.Redirects, io, _ => assignments.Count > 0 ? LastExit : 0);
        }

        var saved = assignments.Select(a => (a.Name, Value: Env.TryGetValue(a.Name, out var v) ? v : null)).ToList();
        foreach (var (name, value) in assignments) Env[name] = value;
        try
        {
            return WithRedirects(node.Redirects, io, rio =>
                Invoke(argv, new IO(rio.OutFn, rio.ErrFn, rio.Stdin is not null ? rio.Stdin.Data[Math.Min(rio.Stdin.Pos, rio.Stdin.Data.Length)..] : null, rio.Tty, rio.Stdin)));
        }
        finally
        {
            foreach (var (name, value) in saved)
            {
                if (value is null) Env.Remove(name);
                else Env[name] = value;
            }
        }
    }

    private static readonly HashSet<string> PkgManagers = new() { "apt", "apt-get", "pacman", "dnf", "dnf5" };

    /// <summary>Runs a command with ready arguments. Also used by sudo.</summary>
    public int Invoke(List<string> argv, IO io, bool viaSudo = false)
    {
        var name = argv[0];
        var args = argv.Skip(1).ToList();
        var ctx = new CmdCtx(io, this, name, args);
        IndexCmd.Commands.TryGetValue(name, out var builtin);
        try
        {
            if (!viaSudo && Functions.ContainsKey(name)) return CallFunction(name, args, io);
            if (builtin?.Builtin == true && !viaSudo) return builtin.Run(ctx);
            // zsh with `setopt autocd`: a directory name as a command changes directory.
            if (args.Count == 0 && ShellMode == "zsh" && ShellStack.Count > 0 && ShellStack[^1].Options.TryGetValue("autocd", out var autocd) && autocd && !viaSudo)
            {
                if (Vfs.TryLookup(Resolve(name), CurrentUser())?.Type == "dir") return Invoke(new List<string> { "cd", name }, io);
            }

            var found = ResolveCommand(name);
            switch (found.Kind)
            {
                case "notfound":
                    if (viaSudo) io.Err($"sudo: {name}: command not found\n");
                    else CommandNotFound(name, io);
                    return viaSudo ? 1 : 127;
                case "error":
                    io.Err($"{(viaSudo ? "sudo" : "bash")}: {name}: {found.Message}\n");
                    return 126;
                case "script":
                    return RunScript(found.Content, name, args, io);
                default:
                {
                    if (!IndexCmd.Commands.TryGetValue(found.Impl, out var def))
                    {
                        io.Err($"bash: {name}: cannot execute binary file\n");
                        return 126;
                    }
                    if (args.Count > 0 && args[0] == "--help" && def.Man is not null && !PkgManagers.Contains(def.Name))
                    {
                        io.Out(UtilCmd.FormatMan(def.Name, ManEnCmd.ManFor(def, this)));
                        return 0;
                    }
                    return def.Run(ctx);
                }
            }
        }
        catch (ControlSignal)
        {
            throw;
        }
        catch (Exception e) when (e is not ControlSignal)
        {
            io.Err($"{name}: {Msg("shell.internalError")}: {e.Message}\n");
            return 1;
        }
    }

    private XIO ToXIO(IO io) => new(io.OutFn, io.ErrFn, io.Reader ?? (io.Stdin is not null ? new Reader(io.Stdin, 0) : null), io.IsTTY);

    private int CallFunction(string name, List<string> args, IO io)
    {
        if (FuncDepth >= 100)
        {
            io.Err($"bash: {name}: maximum function nesting level exceeded (100)\n");
            return 1;
        }
        var frame = new List<string> { positional.Count > 0 ? positional[^1][0] : "bash" };
        frame.AddRange(args);
        positional.Add(frame);
        locals.Add(new Dictionary<string, string?>());
        FuncDepth++;
        try
        {
            return Exec(Functions[name], ToXIO(io));
        }
        catch (ReturnSignal e)
        {
            return e.Code;
        }
        finally
        {
            FuncDepth--;
            positional.RemoveAt(positional.Count - 1);
            var top = locals[^1];
            locals.RemoveAt(locals.Count - 1);
            foreach (var (k, v) in top)
            {
                if (v is null) Env.Remove(k);
                else Env[k] = v;
            }
        }
    }

    /// <summary>`local NAME[=value]` in a function.</summary>
    public bool DeclareLocal(string name, string? value)
    {
        var frame = locals.Count > 0 ? locals[^1] : null;
        if (frame is null || FuncDepth == 0) return false;
        if (!frame.ContainsKey(name)) frame[name] = Env.TryGetValue(name, out var old) ? old : null;
        if (value is not null) Env[name] = value;
        else Env.Remove(name);
        return true;
    }

    /// <summary>Positional parameters ($1, $2 ...) for the current script/function.</summary>
    public List<string> Args => (positional.Count > 0 ? positional[^1] : new List<string> { "bash" }).Skip(1).ToList();

    public void SetArgs(List<string> args)
    {
        if (positional.Count > 0)
        {
            var top = positional[^1];
            top.RemoveRange(1, top.Count - 1);
            top.AddRange(args);
        }
        else
        {
            var frame = new List<string> { "bash" };
            frame.AddRange(args);
            positional.Add(frame);
        }
    }

    private static readonly Regex ElfImplRe = new("^\u007fELF[^(]*\\((?:simulated binary|simulerad binärfil): ([^)\\s]+)\\)", RegexOptions.CultureInvariant);

    public ResolvedCommand ResolveCommand(string name)
    {
        var user = CurrentUser();
        ResolvedCommand Check(string path, FsNode node)
        {
            if (node.Type == "dir") return new ResolvedCommand { Kind = "error", Message = "Is a directory" };
            if (!VfsLib.HasPerm(node, user, 'x')) return new ResolvedCommand { Kind = "error", Message = "Permission denied" };
            var content = node.Content ?? "";
            // The binary says itself which program it is, so it works even when renamed
            // (e.g. ./Calculator.AppImage or /snap/bin/hello-world which points to snap).
            var m = ElfImplRe.Match(content);
            var impl = m.Success ? m.Groups[1].Value : VfsLib.Basename(path);
            if (content.StartsWith(VfsLib.Elf, StringComparison.Ordinal)) return new ResolvedCommand { Kind = "binary", Impl = impl, Path = path };
            if (!VfsLib.HasPerm(node, user, 'r')) return new ResolvedCommand { Kind = "error", Message = "Permission denied" };
            return new ResolvedCommand { Kind = "script", Content = content, Path = path };
        }
        if (name.Contains('/'))
        {
            var path = Resolve(name);
            try
            {
                return Check(path, Vfs.Lookup(path, user));
            }
            catch (FsError e)
            {
                return new ResolvedCommand { Kind = "error", Message = e.Message };
            }
        }
        foreach (var dir in (Env.TryGetValue("PATH", out var p) ? p : "").Split(':'))
        {
            if (dir == "") continue;
            var path = $"{dir}/{name}";
            var node = Vfs.TryLookup(path, user);
            if (node is not null && node.Type == "file" && VfsLib.HasPerm(node, user, 'x')) return Check(path, node);
        }
        return new ResolvedCommand { Kind = "notfound" };
    }

    private void CommandNotFound(string name, IO io)
    {
        var pkg = PackagesLib.PackageProviding(Distro.Family, name);
        var pkgName = pkg?.Names.Get(Distro.Family);
        if (pkg is not null && pkgName is not null && Distro.Id == "ubuntu" && ShellMode == "bash")
        {
            io.Err($"Command '{name}' not found, but can be installed with:\nsudo apt install {pkgName}\n");
            return;
        }
        var mode = ShellMode;
        io.Err(mode == "zsh" ? $"zsh: command not found: {name}\n" : mode == "fish" ? $"fish: Unknown command: {name}\n" : $"bash: {name}: command not found\n");
        if (pkgName is not null)
        {
            io.Err($"{Dim}{Msg("shell.commandInPackage", ("pkg", pkgName))}{Reset}\n");
        }
    }

    /// <summary>
    /// Runs a script. By default in a "subshell": cd, variables and functions do not affect the caller.
    /// With inCurrentShell (source) the changes stay.
    /// </summary>
    public int RunScript(string content, string name, List<string> args, IO io, bool inCurrentShell = false, ShellMode? mode = null)
    {
        if (ScriptDepth > 20)
        {
            io.Err($"bash: {name}: {Msg("shell.nestingTooDeep")}\n");
            return 1;
        }
        if (mode is null && !inCurrentShell)
        {
            // The #! line decides which shell runs the script, whatever shell you use yourself.
            var sb = ShellmodeLib.Shebang(content);
            if (sb is not null && sb.Value.Mode != "bash" && ResolveCommand(sb.Value.Mode).Kind != "binary")
            {
                io.Err($"{ShellMode}: {name}: {sb.Value.Interpreter}: bad interpreter: No such file or directory\n");
                return 126;
            }
            mode = sb?.Mode ?? "bash";
        }
        mode ??= ShellMode;
        Node ast;
        try
        {
            ast = ParseCode(content, mode);
        }
        catch (ParseError e)
        {
            io.Err($"{name}: {e.Message}\n");
            return 2;
        }
        var saved = (Cwd, Env: Js.Copy(Env), Functions: Js.Copy(Functions));
        ScriptDepth++;
        if (!inCurrentShell) modeOverride.Add(mode);
        var frame = new List<string> { name };
        frame.AddRange(args);
        positional.Add(frame);
        int savedLoopDepth = LoopDepth;
        LoopDepth = 0;
        int code = 0;
        try
        {
            code = Exec(ast, ToXIO(io));
        }
        catch (ExitSignal e)
        {
            code = e.Code;
        }
        catch (ReturnSignal e)
        {
            code = e.Code;
        }
        catch (LoopSignal)
        {
            code = 0;
        }
        finally
        {
            ScriptDepth--;
            if (!inCurrentShell) modeOverride.RemoveAt(modeOverride.Count - 1);
            positional.RemoveAt(positional.Count - 1);
            LoopDepth = savedLoopDepth;
            if (!inCurrentShell)
            {
                Cwd = saved.Cwd;
                Env = saved.Env;
                Functions = saved.Functions;
            }
        }
        LastExit = code;
        return code;
    }

    /// <summary>Called by `exit`.</summary>
    public int Exit(int code, IO io)
    {
        if (ScriptDepth > 0 || substDepth > 0) throw new ExitSignal(code);
        var top = ShellStack.Count > 0 ? ShellStack[^1] : null;
        if (top is not null && top.UserDepth == UserStack.Count)
        {
            // Back to the shell that started zsh/fish – with its variables, aliases and directory.
            ShellStack.RemoveAt(ShellStack.Count - 1);
            if (top.PushedUser == true) UserStack.RemoveAt(UserStack.Count - 1);
            Cwd = top.Saved.Cwd;
            Env = top.Saved.Env;
            Aliases = top.Saved.Aliases;
            Functions = top.Saved.Functions;
            Flags[$"left:{top.Mode}"] = true;
            Proc.Procs = Proc.Procs.Where(p => p.Pid != top.Pid).ToList();
            return code;
        }
        if (UserStack.Count > 1)
        {
            UserStack.RemoveAt(UserStack.Count - 1);
            var u = CurrentUser();
            Cwd = u.Home;
            Env["HOME"] = u.Home;
            Env["USER"] = u.Name;
            Env["LOGNAME"] = u.Name;
            io.Out("logout\n");
            return code;
        }
        io.Out($"{Dim}{Msg("shell.exitNoSession")}{Reset}\n");
        return 0;
    }

    // ---------- Background jobs ----------

    /// <summary>Updates jobs whose time has run out (e.g. `sleep 5 &amp;`).</summary>
    public void RefreshJobs()
    {
        var now = Js.Now();
        foreach (var job in Proc.Jobs.ToList())
        {
            if (job.State == "Running" && job.EndsAt is long endsAt && endsAt <= now) FinishJob(job, "Done");
        }
    }

    public void FinishJob(Job job, string state)
    {
        job.State = state;
        Proc.Procs = Proc.Procs.Where(p => p.Pid != job.Pid).ToList();
    }

    /// <summary>`command &amp;`: starts a background job and prints "[1] 4200".</summary>
    private int StartJob(Node node, XIO io)
    {
        RefreshJobs();
        var cmd = ShellLib.NodeToString(node);
        int id = Proc.Jobs.Select(j => j.Id).Append(0).Max() + 1;
        int pid = Proc.NextPid++;
        LastBgPid = pid;
        io.Err($"[{id}] {pid}\n");
        var seconds = ShellLib.SleepSeconds(node);
        if (seconds is double s)
        {
            // sleep runs "for real" in the background: the job finishes when the time has passed.
            Proc.Jobs.Add(new Job { Id = id, Pid = pid, Cmd = cmd, State = "Running", EndsAt = Js.Now() + (long)(s * 1000) });
            Proc.Procs.Add(new Proc
            {
                Pid = pid,
                Ppid = ProcsLib.ShellPid,
                User = CurrentUser().Name,
                Cmd = cmd,
                Cpu = 0,
                Mem = 0,
                Vsz = 8_300,
                Rss = 1_900,
                Tty = "pts/0",
                Stat = "S",
                Start = Js.LocalNow().ToString("HH:mm", CultureInfo.InvariantCulture),
                Time = "0:00",
            });
        }
        else
        {
            // Other commands run directly – in the simulator they finish at once.
            int exit = Exec(node, io);
            Proc.Jobs.Add(new Job { Id = id, Pid = pid, Cmd = cmd, State = "Done", Exit = exit });
        }
        return 0;
    }

    /// <summary>"[1]+  Done   sleep 3" for jobs that have finished since last time.</summary>
    private string JobNotifications()
    {
        RefreshJobs();
        var finished = Proc.Jobs.Where(j => j.State != "Running").ToList();
        if (finished.Count == 0) return "";
        var last = Proc.Jobs.Count > 0 ? Proc.Jobs[^1] : null;
        Proc.Jobs = Proc.Jobs.Where(j => j.State == "Running").ToList();
        return string.Concat(finished.Select(j =>
        {
            var state = j.State == "Done" && j.Exit is int e && e != 0 ? $"Exit {e}" : j.State;
            return $"[{j.Id}]{(ReferenceEquals(j, last) ? "+" : "-")}  {state,-24}{j.Cmd}\n";
        }));
    }

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
        var found = results.Where(r => r != "" && Vfs.TryLookup(Resolve(r), user) is not null).ToList();
        return segs.Contains("**") && ShellMode != "bash" ? found.SortJs() : found;
    }

    // ---------- Tab completion ----------

    /// <summary>Every command that can run right now (builtins + functions + executable files in PATH).</summary>
    public List<string> AvailableCommands()
    {
        var names = new HashSet<string>(IndexCmd.Commands.Values.Where(c => c.Builtin).Select(c => c.Name), StringComparer.Ordinal);
        var user = CurrentUser();
        foreach (var dir in (Env.TryGetValue("PATH", out var p) ? p : "").Split(':'))
        {
            var node = dir != "" ? Vfs.TryLookup(dir, user) : null;
            if (node?.Type == "dir")
            {
                foreach (var (n, child) in node.Children!)
                {
                    if (child.Type == "file" && VfsLib.HasPerm(child, user, 'x')) names.Add(n);
                }
            }
        }
        foreach (var a in Aliases.Keys) names.Add(a);
        foreach (var f in Functions.Keys) names.Add(f);
        return names.ToList().SortJs();
    }

    private static readonly Regex CompleteWordRe = new(@"(^|[\s|;&]+)([^\s|;&]*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex CompleteCmdPosRe = new(@"(^|[|;&]\s*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex CompleteSudoRe = new(@"(^|\s)sudo\s+\z", RegexOptions.CultureInvariant);

    public (string Line, List<string> Options) Complete(string line)
    {
        var m = CompleteWordRe.Match(line);
        var word = m.Groups[2].Value;
        var before = line[..(line.Length - word.Length)];
        bool isCommand = CompleteCmdPosRe.IsMatch(before.TrimEnd()) || before.Trim() == "" || CompleteSudoRe.IsMatch(before);

        List<string> candidates;
        var prefix = word;
        var dirPart = "";
        if (isCommand && !word.Contains('/'))
        {
            candidates = AvailableCommands().Where(c => c.StartsWith(word, StringComparison.Ordinal)).ToList();
        }
        else
        {
            int slash = word.LastIndexOf('/');
            dirPart = slash >= 0 ? word[..(slash + 1)] : "";
            prefix = word[(slash + 1)..];
            var dirPath = dirPart != "" ? dirPart : ".";
            if (dirPath == "~/" || dirPath.StartsWith("~/", StringComparison.Ordinal)) dirPath = Home + dirPath[1..];
            var node = Vfs.TryLookup(Resolve(dirPath), CurrentUser());
            if (node is null || node.Type != "dir") return (line, new List<string>());
            candidates = node.Children!
                .Where(kv => kv.Key.StartsWith(prefix, StringComparison.Ordinal) && (prefix.StartsWith('.') || !kv.Key.StartsWith('.')))
                .Select(kv => kv.Value.Type == "dir" ? $"{kv.Key}/" : kv.Key)
                .ToList()
                .SortJs();
        }
        if (candidates.Count == 0) return (line, new List<string>());
        if (candidates.Count == 1)
        {
            var c = candidates[0];
            return (before + dirPart + c + (c.EndsWith('/') ? "" : " "), new List<string>());
        }
        var common = candidates[0];
        foreach (var c in candidates)
        {
            while (!c.StartsWith(common, StringComparison.Ordinal)) common = common[..^1];
        }
        return (before + dirPart + common, common.Length > prefix.Length ? new List<string>() : candidates);
    }
}

internal sealed class ExpansionError(string message) : Exception(message);

public static partial class ShellLib
{
    public const string Dim = Shell.Dim;
    public const string Reset = Shell.Reset;

    private static readonly Regex JoinerEndRe = new(@"(\bdo|\bthen|\belse|\{|\||&&|\|\||\bin|;)\z", RegexOptions.CultureInvariant);
    private static readonly Regex JoinerStartRe = new(@"^(;|\))", RegexOptions.CultureInvariant);

    /// <summary>
    /// Turns multi-line code into one line for the history, like bash does:
    /// "for i in 1 2\ndo echo $i\ndone" becomes "for i in 1 2; do echo $i; done".
    /// </summary>
    public static string FlattenLines(string text)
    {
        var lines = text.Split('\n').Select(l => l.Trim()).Where(l => l != "").ToList();
        if (lines.Count <= 1) return text;
        var acc = lines[0];
        foreach (var l in lines.Skip(1))
        {
            var joiner = JoinerEndRe.IsMatch(acc) || JoinerStartRe.IsMatch(l) ? " " : "; ";
            acc = acc + joiner + l;
        }
        return acc;
    }

    /// <summary>Approximate source code for a command (shown by jobs and ps).</summary>
    public static string NodeToString(Node node) => node switch
    {
        SimpleNode s => string.Join(" ", s.Words.Select(w => w.Raw).Concat(s.Redirects.Select(r => r.Op + (r.Target is not null ? " " + r.Target.Raw : "")))),
        PipelineNode p => (p.Negate ? "! " : "") + string.Join(" | ", p.Commands.Select(NodeToString)),
        AndOrNode a => string.Join(" ", new[] { NodeToString(a.First) }.Concat(a.Rest.Select(r => $"{r.Op} {NodeToString(r.Node)}"))),
        ListNode l => string.Join("; ", l.Items.Select(i => NodeToString(i.Node) + (i.Background ? " &" : ""))),
        FuncDefNode f => $"{f.Name}()",
        _ => node.Type,
    };

    private static readonly Regex SleepRe = new(@"^([0-9]+(?:\.[0-9]+)?)([smh]?)\z", RegexOptions.CultureInvariant);

    /// <summary>If the node is `sleep N`: the number of seconds, otherwise null.</summary>
    public static double? SleepSeconds(Node node)
    {
        if (node is not SimpleNode s || s.Words.Count != 2 || s.Words[0].Raw != "sleep") return null;
        var m = SleepRe.Match(s.Words[1].Raw);
        if (!m.Success) return null;
        var n = double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        return n * (m.Groups[2].Value == "m" ? 60 : m.Groups[2].Value == "h" ? 3600 : 1);
    }
}
