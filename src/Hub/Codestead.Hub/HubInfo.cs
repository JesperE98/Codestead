using Codestead.Common;

namespace Codestead.Hub;

/// <summary>Name, id, version and releases repository – from build/Codestead.props.</summary>
public static class HubInfo
{
    public static ProductMeta Meta { get; } = ProductMeta.Of(typeof(HubInfo).Assembly, "Codestead", "codestead-hub");

    public static string Name => Meta.Name;
    public static string Id => Meta.Id;
    public static string ReleasesRepo => Meta.ReleasesRepo;
    public static string Version => Meta.Version;

    /// <summary>The built-in public key for catalog.json, or null in a build without one.</summary>
    public static string? CatalogPublicKey()
    {
        using var s = typeof(HubInfo).Assembly.GetManifestResourceStream("catalog-signing.pub.pem");
        return s is null ? null : new StreamReader(s).ReadToEnd();
    }
}
