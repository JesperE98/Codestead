namespace Codestead.Hub;

/// <summary>Command line options. The catalog/key/install options are only honoured together with --smoke-test.</summary>
public sealed record HubOptions(bool SmokeTest, Uri? Catalog, string? PublicKeyFile, string? Install)
{
    public static HubOptions Parse(string[] args)
    {
        string? Value(string name)
        {
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
        bool smoke = args.Contains("--smoke-test");
        if (!smoke) return new(false, null, null, null);
        var catalog = Value("--catalog");
        return new(true,
            catalog is null ? null : new Uri(Path.IsPathRooted(catalog) ? catalog : Path.GetFullPath(catalog)),
            Value("--public-key"), Value("--install"));
    }
}
