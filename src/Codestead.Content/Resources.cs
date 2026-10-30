using System.Reflection;

namespace Codestead.Content;

/// <summary>Reads the texts embedded in this assembly (chapters/*, i18n/*, ui/*; see the .csproj).</summary>
internal static class Resources
{
    private static readonly Assembly Asm = typeof(Resources).Assembly;

    /// <summary>All embedded resources, keyed by logical name with forward slashes.</summary>
    private static readonly Lazy<Dictionary<string, string>> Names = new(() =>
        Asm.GetManifestResourceNames().ToDictionary(n => n.Replace('\\', '/'), n => n, StringComparer.Ordinal));

    /// <summary>The logical names (with forward slashes) of all embedded resources starting with <paramref name="prefix"/>.</summary>
    public static IEnumerable<string> List(string prefix) =>
        Names.Value.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)).Order(StringComparer.Ordinal);

    /// <summary>The text of an embedded resource, or null when it does not exist.</summary>
    public static string? Read(string name)
    {
        if (!Names.Value.TryGetValue(name, out var real)) return null;
        using var stream = Asm.GetManifestResourceStream(real);
        if (stream is null) return null;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
