namespace Codestead.Shell.Commands;

/// <summary>
/// An awk construct the simulator lacks: a message key (e.g. awk.featureFunction) with its arguments,
/// or – for a bare keyword such as getline – just that keyword.
/// </summary>
public sealed partial class AwkUnsupported(string? key, string? keyword, (string Name, object? Value)[] args)
{
    public static AwkUnsupported Feature(string key, params (string Name, object? Value)[] args) => new(key, null, args);
    public static AwkUnsupported Keyword(string keyword) => new(null, keyword, []);

    /// <summary>The construct described in the shell's language.</summary>
    public string Describe(Shell sh) => key is not null ? sh.Msg(key, args) : keyword!;
}
