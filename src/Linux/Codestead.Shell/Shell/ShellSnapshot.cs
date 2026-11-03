namespace Codestead.Shell;

// The saved state of a Shell (the whole simulated computer), stored as JSON.

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
    /// <summary>The shell's umask (null means the usual 022).</summary>
    public int? Umask { get; set; }
}
