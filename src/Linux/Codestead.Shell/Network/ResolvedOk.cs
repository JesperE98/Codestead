namespace Codestead.Shell;

// Network model: a successful name lookup.

public partial class ResolvedOk : Resolved
{
    public override bool Ok => true;
    public string Ip { get; set; } = "";
    /// <summary>The name that was typed (or the IP address).</summary>
    public string Name { get; set; } = "";
    /// <summary>"literal", "hosts" or "dns".</summary>
    public string Source { get; set; } = "";
}
