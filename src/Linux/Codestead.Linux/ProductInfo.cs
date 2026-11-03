using Codestead.Common;

namespace Codestead.Linux;

/// <summary>Product name, tool id and version – they come from build/Codestead.props.</summary>
public static class ProductInfo
{
    public static ProductMeta Meta { get; } = ProductMeta.Of(typeof(ProductInfo).Assembly, "Codestead Linux", "codestead-linux");

    public static string Name => Meta.Name;
    public static string ToolId => Meta.Id;
    public static string ReleasesRepo => Meta.ReleasesRepo;
    public static string Version => Meta.Version;
}
