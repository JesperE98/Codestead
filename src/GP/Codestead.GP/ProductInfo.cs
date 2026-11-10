using Codestead.Common;

namespace Codestead.GP;

/// <summary>Product name, tool id and version – they come from src/GP/Directory.Build.props.</summary>
public static class ProductInfo
{
    public static ProductMeta Meta { get; } = ProductMeta.Of(typeof(ProductInfo).Assembly, "Codestead GP", "codestead-gp");
}
