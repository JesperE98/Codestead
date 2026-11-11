using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// The depth, stencil and blend state of a Vulkan pipeline or a DirectX 12 pipeline state object, read from the
/// fields the program assigns before creating it (depthStencil.depthCompareOp = …, psoDesc.DepthStencilState.DepthFunc = …).
/// </summary>
internal static class PipelineState
{
    /// <param name="Attachments">Blending per colour attachment when it differs between them (D3D12's
    /// IndependentBlendEnable, Vulkan's pAttachments array), else null: every attachment blends with <paramref name="Blend"/>.</param>
    public sealed record Fixed(CompareFunc DepthFunc, bool DepthWrite, StencilState? Stencil, BlendState? Blend, IReadOnlyList<BlendState?>? Attachments = null);

    /// <summary>The attachments' blending, or null when they all blend alike.</summary>
    private static IReadOnlyList<BlendState?>? Distinct(List<BlendState?> blends) =>
        blends.Count > 1 && blends.Skip(1).Any(b => b != blends[0]) ? blends : null;

    /// <summary>
    /// Vulkan: VkPipelineDepthStencilStateCreateInfo and VkPipelineColorBlendAttachmentState fields.
    /// <paramref name="attachments"/>: the fields of each element of pAttachments, when it is an array of several.
    /// </summary>
    public static Fixed Vulkan(Func<string, string?> field, Func<string, int?> number, IReadOnlyList<Func<string, string?>>? attachments = null)
    {
        var depthFunc = field("depthCompareOp") is { } d ? VkCompare(d) : CompareFunc.Less;
        bool depthWrite = !Regex.IsMatch(field("depthWriteEnable") ?? "VK_TRUE", "FALSE|^0$");
        StencilState? stencil = null;
        if (Regex.IsMatch(field("stencilTestEnable") ?? "", "TRUE|^1$"))
            stencil = new StencilState(
                field("compareOp") is { } c ? VkCompare(c) : CompareFunc.Always,
                number("reference") ?? 0,
                number("compareMask") ?? 0xFF,
                number("writeMask") ?? 0xFF,
                VkStencilOp(field("failOp")),
                VkStencilOp(field("depthFailOp")),
                VkStencilOp(field("passOp")));
        static BlendState? Blend(Func<string, string?> field) => !Regex.IsMatch(field("blendEnable") ?? "", "TRUE|^1$") ? null
            : new BlendState(
                VkFactor(field("srcColorBlendFactor"), BlendFactor.One), VkFactor(field("dstColorBlendFactor"), BlendFactor.Zero),
                VkFactor(field("srcAlphaBlendFactor"), BlendFactor.One), VkFactor(field("dstAlphaBlendFactor"), BlendFactor.Zero),
                VkOp(field("colorBlendOp")), VkOp(field("alphaBlendOp")));
        var perAttachment = attachments is { Count: > 1 } ? Distinct(attachments.Select(Blend).ToList()) : null;
        return new Fixed(depthFunc, depthWrite, stencil, perAttachment?[0] ?? (attachments is { Count: > 1 } ? Blend(attachments[0]) : Blend(field)), perAttachment);
    }

    /// <summary>
    /// DirectX 12: D3D12_DEPTH_STENCIL_DESC and D3D12_RENDER_TARGET_BLEND_DESC fields. With IndependentBlendEnable,
    /// <paramref name="target"/> gives the fields of BlendState.RenderTarget[i] (otherwise every target blends as
    /// RenderTarget[0]).
    /// </summary>
    public static Fixed D3D12(Func<string, string?> field, Func<string, int?> number, Func<int, Func<string, string?>>? target = null)
    {
        var depthFunc = field("DepthFunc") is { } d ? DxCompare(d) : CompareFunc.Less;
        bool depthWrite = !(field("DepthWriteMask") ?? "").Contains("ZERO", StringComparison.Ordinal);
        StencilState? stencil = null;
        if (Regex.IsMatch(field("StencilEnable") ?? "", "TRUE|true|^1$"))
            stencil = new StencilState(
                field("StencilFunc") is { } c ? DxCompare(c) : CompareFunc.Always,
                0,
                number("StencilReadMask") ?? 0xFF,
                number("StencilWriteMask") ?? 0xFF,
                DxStencilOp(field("StencilFailOp")),
                DxStencilOp(field("StencilDepthFailOp")),
                DxStencilOp(field("StencilPassOp")));
        static BlendState? Blend(Func<string, string?> field) => !Regex.IsMatch(field("BlendEnable") ?? "", "TRUE|true|^1$") ? null
            : new BlendState(
                DxFactor(field("SrcBlend"), BlendFactor.One), DxFactor(field("DestBlend"), BlendFactor.Zero),
                DxFactor(field("SrcBlendAlpha"), BlendFactor.One), DxFactor(field("DestBlendAlpha"), BlendFactor.Zero),
                DxOp(field("BlendOp")), DxOp(field("BlendOpAlpha")));
        if (target is not null)
        {
            // RenderTarget[0] is the blending of every target, unless IndependentBlendEnable lets each have its own.
            var first = Blend(target(0));
            var perTarget = Regex.IsMatch(field("IndependentBlendEnable") ?? "", "TRUE|true|^1$")
                ? Distinct(Enumerable.Range(0, 8).Select(i => Blend(target(i))).ToList()) : null;
            return new Fixed(depthFunc, depthWrite, stencil, first, perTarget);
        }
        return new Fixed(depthFunc, depthWrite, stencil, Blend(field));
    }

    private static CompareFunc VkCompare(string v) => Suffix(v, "VK_COMPARE_OP_") switch
    {
        "NEVER" => CompareFunc.Never,
        "LESS" => CompareFunc.Less,
        "EQUAL" => CompareFunc.Equal,
        "LESS_OR_EQUAL" => CompareFunc.LessEqual,
        "GREATER" => CompareFunc.Greater,
        "NOT_EQUAL" => CompareFunc.NotEqual,
        "GREATER_OR_EQUAL" => CompareFunc.GreaterEqual,
        _ => CompareFunc.Always,
    };

    private static CompareFunc DxCompare(string v) => Suffix(v, "D3D12_COMPARISON_FUNC_") switch
    {
        "NEVER" => CompareFunc.Never,
        "LESS" => CompareFunc.Less,
        "EQUAL" => CompareFunc.Equal,
        "LESS_EQUAL" => CompareFunc.LessEqual,
        "GREATER" => CompareFunc.Greater,
        "NOT_EQUAL" => CompareFunc.NotEqual,
        "GREATER_EQUAL" => CompareFunc.GreaterEqual,
        _ => CompareFunc.Always,
    };

    private static StencilOp VkStencilOp(string? v) => Suffix(v ?? "", "VK_STENCIL_OP_") switch
    {
        "ZERO" => StencilOp.Zero,
        "REPLACE" => StencilOp.Replace,
        "INCREMENT_AND_CLAMP" => StencilOp.Increment,
        "INCREMENT_AND_WRAP" => StencilOp.IncrementWrap,
        "DECREMENT_AND_CLAMP" => StencilOp.Decrement,
        "DECREMENT_AND_WRAP" => StencilOp.DecrementWrap,
        "INVERT" => StencilOp.Invert,
        _ => StencilOp.Keep,
    };

    private static StencilOp DxStencilOp(string? v) => Suffix(v ?? "", "D3D12_STENCIL_OP_") switch
    {
        "ZERO" => StencilOp.Zero,
        "REPLACE" => StencilOp.Replace,
        "INCR_SAT" => StencilOp.Increment,
        "INCR" => StencilOp.IncrementWrap,
        "DECR_SAT" => StencilOp.Decrement,
        "DECR" => StencilOp.DecrementWrap,
        "INVERT" => StencilOp.Invert,
        _ => StencilOp.Keep,
    };

    private static BlendFactor VkFactor(string? v, BlendFactor fallback) => v is null ? fallback : Suffix(v, "VK_BLEND_FACTOR_") switch
    {
        "ZERO" => BlendFactor.Zero,
        "ONE" => BlendFactor.One,
        "SRC_COLOR" => BlendFactor.SrcColor,
        "ONE_MINUS_SRC_COLOR" => BlendFactor.OneMinusSrcColor,
        "DST_COLOR" => BlendFactor.DstColor,
        "ONE_MINUS_DST_COLOR" => BlendFactor.OneMinusDstColor,
        "SRC_ALPHA" => BlendFactor.SrcAlpha,
        "ONE_MINUS_SRC_ALPHA" => BlendFactor.OneMinusSrcAlpha,
        "DST_ALPHA" => BlendFactor.DstAlpha,
        "ONE_MINUS_DST_ALPHA" => BlendFactor.OneMinusDstAlpha,
        "CONSTANT_COLOR" => BlendFactor.ConstantColor,
        "ONE_MINUS_CONSTANT_COLOR" => BlendFactor.OneMinusConstantColor,
        "CONSTANT_ALPHA" => BlendFactor.ConstantAlpha,
        "ONE_MINUS_CONSTANT_ALPHA" => BlendFactor.OneMinusConstantAlpha,
        _ => fallback,
    };

    private static BlendFactor DxFactor(string? v, BlendFactor fallback) => v is null ? fallback : Suffix(v, "D3D12_BLEND_") switch
    {
        "ZERO" => BlendFactor.Zero,
        "ONE" => BlendFactor.One,
        "SRC_COLOR" => BlendFactor.SrcColor,
        "INV_SRC_COLOR" => BlendFactor.OneMinusSrcColor,
        "DEST_COLOR" => BlendFactor.DstColor,
        "INV_DEST_COLOR" => BlendFactor.OneMinusDstColor,
        "SRC_ALPHA" => BlendFactor.SrcAlpha,
        "INV_SRC_ALPHA" => BlendFactor.OneMinusSrcAlpha,
        "DEST_ALPHA" => BlendFactor.DstAlpha,
        "INV_DEST_ALPHA" => BlendFactor.OneMinusDstAlpha,
        "BLEND_FACTOR" => BlendFactor.ConstantColor,
        "INV_BLEND_FACTOR" => BlendFactor.OneMinusConstantColor,
        _ => fallback,
    };

    private static BlendOp VkOp(string? v) => Suffix(v ?? "", "VK_BLEND_OP_") switch
    {
        "SUBTRACT" => BlendOp.Subtract,
        "REVERSE_SUBTRACT" => BlendOp.ReverseSubtract,
        "MIN" => BlendOp.Min,
        "MAX" => BlendOp.Max,
        _ => BlendOp.Add,
    };

    private static BlendOp DxOp(string? v) => Suffix(v ?? "", "D3D12_BLEND_OP_") switch
    {
        "SUBTRACT" => BlendOp.Subtract,
        "REV_SUBTRACT" => BlendOp.ReverseSubtract,
        "MIN" => BlendOp.Min,
        "MAX" => BlendOp.Max,
        _ => BlendOp.Add,
    };

    private static string Suffix(string v, string prefix)
    {
        var t = v.Trim().TrimEnd(';').Trim();
        int i = t.IndexOf(prefix, StringComparison.Ordinal);
        return i >= 0 ? t[(i + prefix.Length)..] : t;
    }
}
