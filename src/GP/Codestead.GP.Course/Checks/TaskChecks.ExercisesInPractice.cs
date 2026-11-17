using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// The exercises' checks of in-practice, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are of the 800×600 window (the same place in every API); the
// game's at the times its tasks.md names (frame t × 60 of the deterministic game, the space bar in frames 30–33).
public static partial class TaskChecks
{
    /// <summary>The pixels of the check frame (160 × 120: every 5th window pixel) in a box of window pixels at a time that pass a test.</summary>
    private static int IpExCountIn(CheckContext c, double t, int x0, int y0, int x1, int y1, Func<double[], bool> test)
    {
        int n = 0;
        for (int y = y0; y <= y1; y += 5)
            for (int x = x0; x <= x1; x += 5)
                if (c.PixelAt(t, x / 800.0, y / 600.0) is { } p && test(p)) n++;
        return n;
    }

    /// <summary>Some pixel in a box of window pixels passes a test.</summary>
    private static bool IpExAnyIn(CheckContext c, double t, int x0, int y0, int x1, int y1, Func<double[], bool> test) =>
        IpExCountIn(c, t, x0, y0, x1, y1, test) > 0;

    /// <summary>The share (0–1) of a box of window pixels that passes a test.</summary>
    private static double IpExShareIn(CheckContext c, double t, int x0, int y0, int x1, int y1, Func<double[], bool> test)
    {
        int all = ((y1 - y0) / 5 + 1) * ((x1 - x0) / 5 + 1);
        return IpExCountIn(c, t, x0, y0, x1, y1, test) / (double)all;
    }

    /// <summary>A grey (red = green = blue) between two brightnesses.</summary>
    private static bool IpExGrey(double[] p, double min, double max) =>
        Math.Abs(p[0] - p[1]) < 0.03 && Math.Abs(p[1] - p[2]) < 0.03 && p[0] >= min && p[0] <= max;

    /// <summary>Pure red (1, 0, 0).</summary>
    private static bool IpExRed(double[] p) => p[0] > 0.9 && p[1] < 0.1 && p[2] < 0.1;

    /// <summary>Orange (1, 0.5, 0).</summary>
    private static bool IpExOrange(double[] p) => p[0] > 0.9 && p[1] > 0.4 && p[1] < 0.6 && p[2] < 0.1;

    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesInPractice => new()
    {
        ["debugging"] = new()
        {
            // v alone as grey: bright at the face's top and dark at its bottom (Direct3D's v runs downwards: the other way round).
            ["ex-v-grey"] = c => c.Drew && At(c, 100, 100, Teal) && At(c, 400, 300, p => IpExGrey(p, 0.35, 0.7))
                && At(c, 400, 150, p => c.Api == Apis.D3D12 ? IpExGrey(p, 0, 0.15) : IpExGrey(p, 0.85, 1))
                && At(c, 560, 450, p => c.Api == Apis.D3D12 ? IpExGrey(p, 0.85, 1) : IpExGrey(p, 0, 0.15)),
            // The coordinates × 3, fract: across the middle the red rises to full and starts again at 0 – twice.
            ["ex-tiles"] = c => c.Drew && At(c, 100, 100, Teal) && At(c, 340, 300, p => p[0] > 0.8 && p[2] < 0.05) && At(c, 360, 300, p => p[0] < 0.15 && p[1] > 0.25 && p[2] < 0.05)
                && At(c, 460, 300, p => p[0] > 0.8 && p[2] < 0.05) && At(c, 480, 300, p => p[0] < 0.15 && p[1] > 0.25 && p[2] < 0.05),
            // The wood again, but red where u > 0.5: the face's right half red, its left half wood.
            ["ex-highlight"] = c => c.Drew && At(c, 100, 100, Teal) && At(c, 560, 450, IpExRed) && At(c, 500, 400, IpExRed) && At(c, 300, 300, Wood) && At(c, 280, 200, Wood),
        },
        ["text-rendering"] = new()
        {
            // Line 1 in orange, line 2 still light blue.
            ["ex-colour"] = c => c.Drew && At(c, 40, 541, IpExOrange) && At(c, 92, 561, IpExOrange) && At(c, 706, 16, TextBlue) && At(c, 400, 300, Teal),
            // Line 1 at 1.5 × the size: it reaches far further to the right (the normal line ends at x ≈ 470).
            ["ex-bigger"] = c => c.Drew && IpExAnyIn(c, 1.0, 560, 500, 720, 595, TextGreen) && At(c, 706, 16, TextBlue) && At(c, 400, 300, Teal),
            // The glyphs' whole quads: about twice as much green in line 1's box as the letters alone.
            ["ex-quads"] = c => c.Drew && IpExShareIn(c, 1.0, 20, 520, 470, 580, TextGreen) > 0.28 && At(c, 706, 16, TextBlue),
            // A black copy behind line 1, a little to the lower right: black pixels next to the green letters.
            ["ex-shadow"] = c => c.Drew && c.AnyDrawnPixel(Black) && At(c, 40, 541, TextGreen) && At(c, 92, 561, TextGreen) && At(c, 706, 16, TextBlue),
        },
    };
}
