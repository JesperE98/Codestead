namespace Codestead.Shell.Commands;

// Parsed command line options (see UtilCmd.ParseOpts).

public partial class Opts
{
    public HashSet<string> Flags { get; set; } = new();
    public OrderedDictionary<string, string> Values { get; set; } = Js.Obj<string>();
    public List<string> Operands { get; set; } = new();
    public string? Error { get; set; }
}
