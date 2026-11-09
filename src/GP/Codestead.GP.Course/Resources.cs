using System.Reflection;
using System.Text;

namespace Codestead.GP.Course;

/// <summary>Reads the texts and projects embedded in this assembly (see the .csproj).</summary>
internal static class Resources
{
    private static readonly Assembly Asm = typeof(Resources).Assembly;

    private static readonly Lazy<Dictionary<string, string>> Names = new(() =>
        Asm.GetManifestResourceNames().ToDictionary(n => n.Replace('\\', '/'), n => n, StringComparer.Ordinal));

    /// <summary>The logical names of all embedded resources starting with <paramref name="prefix"/>, in order.</summary>
    public static IEnumerable<string> List(string prefix) =>
        Names.Value.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)).Order(StringComparer.Ordinal);

    public static byte[]? ReadBytes(string name)
    {
        if (!Names.Value.TryGetValue(name, out var real)) return null;
        using var stream = Asm.GetManifestResourceStream(real);
        if (stream is null) return null;
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    public static string? Read(string name)
    {
        if (!Names.Value.TryGetValue(name, out var real)) return null;
        using var stream = Asm.GetManifestResourceStream(real);
        if (stream is null) return null;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd().Replace("\r\n", "\n");
    }
}
