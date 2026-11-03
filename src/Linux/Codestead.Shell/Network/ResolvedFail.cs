namespace Codestead.Shell;

// Network model: a failed name lookup.

public partial class ResolvedFail : Resolved
{
    public override bool Ok => false;
    /// <summary>"notfound" or "tempfail".</summary>
    public string Error { get; set; } = "";
}
