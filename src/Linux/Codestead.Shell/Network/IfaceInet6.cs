namespace Codestead.Shell;

// Network model: an IPv6 address of an interface.

public partial class IfaceInet6
{
    public string Addr { get; set; } = "";
    public int Prefix { get; set; }
    public string Scope { get; set; } = "";
    public string Extra { get; set; } = "";
}
