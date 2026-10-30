using System.Reflection;

namespace Codestead.Hub;

/// <summary>Name, id, version and releases repository – from build/Codestead.props.</summary>
public static class HubInfo
{
    private static string Meta(string key, string fallback) =>
        typeof(HubInfo).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == key)?.Value ?? fallback;

    public static string Name => Meta("ProductName", "Codestead");
    public static string Id => Meta("ToolId", "codestead-hub");
    public static string ReleasesRepo => Meta("ReleasesRepo", "jesper-e98/codestead-releases");
    public static string Version =>
        typeof(HubInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "0.0.0";

    /// <summary>The built-in public key for catalog.json, or null in a build without one.</summary>
    public static string? CatalogPublicKey()
    {
        using var s = typeof(HubInfo).Assembly.GetManifestResourceStream("catalog-signing.pub.pem");
        return s is null ? null : new StreamReader(s).ReadToEnd();
    }
}
