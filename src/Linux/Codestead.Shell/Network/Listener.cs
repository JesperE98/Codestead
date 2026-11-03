namespace Codestead.Shell;

// Network model: a listening port (from the process table).

public partial class Listener
{
    /// <summary>"tcp" or "udp".</summary>
    public string Proto { get; set; } = "";
    public string Addr { get; set; } = "";
    public int Port { get; set; }
    public Proc Proc { get; set; } = null!;
    public int Fd { get; set; }
}
