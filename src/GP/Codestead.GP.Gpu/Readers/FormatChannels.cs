using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// The colour channels a render target format stores: an R8 / R16F target keeps red only, so a shader that samples it
/// reads (r, 0, 0, 1); an RG target (r, g, 0, 1). The APIs' format names: GL_R8, GL_RED, GL_RG16F; VK_FORMAT_R8_UNORM,
/// VK_FORMAT_R16G16_SFLOAT; DXGI_FORMAT_R8_UNORM, DXGI_FORMAT_R16G16_FLOAT.
/// </summary>
internal static class FormatChannels
{
    public static int Of(string? format)
    {
        if (string.IsNullOrEmpty(format)) return 4;
        var f = format.Trim();
        if (Regex.IsMatch(f, @"^GL_(?:RED|R\d+(?:F|I|UI|_SNORM)?)$")) return 1;
        if (Regex.IsMatch(f, @"^GL_(?:RG|RG\d+(?:F|I|UI|_SNORM)?)$")) return 2;
        // VK_FORMAT_R16G16_SFLOAT, DXGI_FORMAT_R8_UNORM: the component letters before the numeric type.
        var m = Regex.Match(f, @"^(?:VK_FORMAT_|DXGI_FORMAT_)((?:[RGBAX]\d+)+)_");
        if (!m.Success) return 4;
        int letters = Regex.Matches(m.Groups[1].Value, "[RGBA]").Count;
        return letters is >= 1 and <= 4 ? letters : 4;
    }

    /// <summary>The channels of each attachment, or null when every one keeps at least red, green and blue.</summary>
    public static IReadOnlyList<int>? List(IEnumerable<int> channels)
    {
        var list = channels.ToList();
        return list.Any(c => c < 3) ? list : null;
    }
}
