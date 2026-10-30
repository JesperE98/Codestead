using System.Reflection;

namespace Codestead.Linux;

/// <summary>Product name, tool id and version – they come from build/Codestead.props.</summary>
public static class ProductInfo
{
    private static string Meta(string key, string fallback) =>
        typeof(ProductInfo).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == key)?.Value ?? fallback;

    public static string Name => Meta("ProductName", "Codestead Linux");
    public static string ToolId => Meta("ToolId", "codestead-linux");
    public static string Version =>
        typeof(ProductInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "0.0.0";
}
