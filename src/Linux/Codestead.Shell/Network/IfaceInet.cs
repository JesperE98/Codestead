namespace Codestead.Shell;

// Network model: the IPv4 address of an interface.

public partial class IfaceInet
{
    public string Addr { get; set; } = "";
    public int Prefix { get; set; }
    public string? Brd { get; set; }
    public string Scope { get; set; } = "";
    public string Extra { get; set; } = "";
    public string Lft { get; set; } = "";
}
