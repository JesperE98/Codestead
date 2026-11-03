namespace Codestead.Shell;

// Network model: the answer to a DNS query.

/// <summary>DNS answer. Status is "NOERROR", "NXDOMAIN" or "SERVFAIL".</summary>
public partial class DnsAnswer
{
    public string Status { get; set; } = "NOERROR";
    public List<string> A { get; set; } = new();
    public List<string> Aaaa { get; set; } = new();
}
