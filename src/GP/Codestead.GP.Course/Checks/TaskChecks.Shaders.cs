namespace Codestead.GP.Course.Checks;

// Shaders: the same six steps in every API, checked on the picture (and the code where the picture cannot tell).
public static partial class TaskChecks
{
    /// <summary>The three corners of the triangle (just inside it) show red, green and blue, one each.</summary>
    private static bool ThreeColours(CheckContext c)
    {
        var corners = new[] { c.Dominant(0.5, 0.32), c.Dominant(0.33, 0.72), c.Dominant(0.67, 0.72) };
        return corners.Distinct().Count() == 3 && !corners.Contains('?');
    }

    private static Dictionary<string, TaskCheck> Shaders => new()
    {
        // A colour passed from the vertex to the fragment/pixel shader: dark red (0.5, 0, 0).
        ["in-out"] = c => c.PixelIs(0.5, 0.55, 0.5, 0.0, 0.0),
        // A colour from the CPU that changes over time: green, animated.
        ["uniform"] = c => c.Scene?.Animated == true && c.Pixel(0.5, 0.55) is { } p && p[1] > 0.3 && p[0] < 0.05 && p[2] < 0.05,
        // A colour per vertex, interpolated: red, green and blue corners.
        ["vertex-colors"] = ThreeColours,
        // Upside down: the wide side on top.
        ["upside-down"] = c => c.DrawnAt(0.3, 0.28) && c.IsClear(0.3, 0.72),
        // Moved 0.5 to the right by a uniform / push constant / root constant.
        ["offset"] = c => c.DrawnAt(0.75, 0.5) && c.IsClear(0.5, 0.5) && c.HasInShaders(@"(?i)offset"),
        // The position as the colour: negative coordinates give black.
        ["position-color"] = c => c.Drew && c.AnyDrawnPixel(p => p[0] < 0.05 && p[1] < 0.05 && p[2] < 0.05) && c.AnyDrawnPixel(p => p[0] > 0.3 || p[1] > 0.3),
    };
}
