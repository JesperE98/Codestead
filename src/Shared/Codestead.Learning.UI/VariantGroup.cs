namespace Codestead.Learning.UI;

/// <summary>A group in the variant picker (Codestead Linux: a distribution family) and its variants (id, name).</summary>
public sealed record VariantGroup(string Label, IReadOnlyList<VariantOption> Options);
