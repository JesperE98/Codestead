using System.Reflection;

namespace Codestead.Common;

/// <summary>
/// A product's name, id, version and releases repository, written into its assembly from build/Codestead.props
/// (AssemblyMetadata "ProductName", "ToolId", "ReleasesRepo" and the informational version).
/// </summary>
public sealed record ProductMeta(string Name, string Id, string ReleasesRepo, string Version)
{
    public static ProductMeta Of(Assembly assembly, string fallbackName, string fallbackId)
    {
        string Meta(string key, string fallback) =>
            assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == key)?.Value ?? fallback;
        var version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "0.0.0";
        return new ProductMeta(Meta("ProductName", fallbackName), Meta("ToolId", fallbackId), Meta("ReleasesRepo", "JesperE98/codestead-releases"), version);
    }
}
