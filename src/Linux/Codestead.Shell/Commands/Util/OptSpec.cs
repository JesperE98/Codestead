namespace Codestead.Shell.Commands;

// Which options a command accepts (see UtilCmd.ParseOpts).

public partial class OptSpec
{
    /// <summary>Flags without a value, e.g. "laR".</summary>
    public string? Flags { get; init; }
    /// <summary>Flags that take a value, e.g. "n" for `head -n 5`.</summary>
    public string? Values { get; init; }
    /// <summary>Long flags (--all) mapped to short ones (a).</summary>
    public Dictionary<string, string>? Long { get; init; }
}
