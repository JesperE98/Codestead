namespace Codestead.Shell;

// Port of src/shell/shellmode.ts (types only so far – the functions are ported in ShellmodeLib below).

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
