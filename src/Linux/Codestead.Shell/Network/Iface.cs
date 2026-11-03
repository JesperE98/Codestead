namespace Codestead.Shell;

// Network model: a network interface (lo, enp0s3).

public partial class Iface
{
    public int Index { get; set; }
    public string Name { get; set; } = "";
    public string Flags { get; set; } = "";
    public int Mtu { get; set; }
    public string Qdisc { get; set; } = "";
    /// <summary>"UP", "DOWN" or "UNKNOWN".</summary>
    public string State { get; set; } = "";
    public string LinkType { get; set; } = "";
    public string Mac { get; set; } = "";
    public string Brd { get; set; } = "";
    public List<IfaceInet> Inet { get; set; } = new();
    public List<IfaceInet6> Inet6 { get; set; } = new();
}
