namespace Codestead.Shell;

// Port of src/shell/shell.ts – the shell itself: holds the state (file system, directory, variables,
// users, functions) and runs bash code – with pipes, redirection, aliases, wildcards, sudo,
// conditions, loops, functions, $(...) and $((...)).

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
        Vfs = new VFS(s.Fs) { Umask = s.Umask ?? Js.Oct(22) };
        Vfs.JoinHardLinks();
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
        Umask = Vfs.Umask == Js.Oct(22) ? null : Vfs.Umask,
    };

    /// <summary>The snapshot as JSON, for saving.</summary>
    public string SnapshotJson() => Js.Stringify(Snapshot());
}
