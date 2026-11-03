namespace Codestead.Shell;

// What a command gets when it runs: its streams, the shell, its name and arguments.

public partial class CmdCtx : IO
{
    public Shell Sh { get; set; }
    public string Name { get; set; }
    public List<string> Args { get; set; }

    /// <summary>{ ...io, sh, name, args }</summary>
    public CmdCtx(IO io, Shell sh, string name, List<string> args) : base(io)
    {
        Sh = sh;
        Name = name;
        Args = args;
    }
}
