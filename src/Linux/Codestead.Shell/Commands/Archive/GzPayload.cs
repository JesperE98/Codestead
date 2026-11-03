namespace Codestead.Shell.Commands;

/// <summary>What gzip stores: the original name, a pretend size if any, and the data itself.</summary>
public partial class GzPayload
{
    public string? N { get; set; }
    public long? S { get; set; }
    public string D { get; set; } = "";
}
