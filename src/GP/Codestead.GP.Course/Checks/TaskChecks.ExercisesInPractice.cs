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

    /// <summary>A purple brick (0.6, 0.2, 0.8 × the brick texture).</summary>
    private static bool IpExPurple(double[] p) => p[0] > 0.35 && p[2] > 0.5 && p[1] < 0.25 && p[2] > p[0];

    /// <summary>A green brick (0, 0.7, 0 × the brick texture).</summary>
    private static bool IpExGreenBrick(double[] p) => p[1] > 0.4 && p[0] < 0.1 && p[2] < 0.1;

    /// <summary>The paddle's brass ends (214, 170, 72).</summary>
    private static bool IpExBrass(double[] p) => p[0] > 0.7 && p[1] > 0.55 && p[1] < 0.78 && p[2] < 0.4;

    /// <summary>A brick tinted (1, 0.2, 0.2): red.</summary>
    private static bool IpExHitRed(double[] p) => p[0] > 0.6 && p[1] < 0.3 && p[2] < 0.3;

    /// <summary>An orange brick darkened to about a third (81, 40, 0).</summary>
    private static bool IpExDimOrange(double[] p) => p[0] > 0.18 && p[0] < 0.45 && p[1] < p[0] * 0.65 && p[1] > p[0] * 0.3 && p[2] < 0.05;

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
        ["rendering-sprites"] = new()
        {
            // White instead of green: the ball's own pale glass colours.
            ["ex-own-colours"] = c => c.Drew && At(c, 350, 400, GlassBall) && At(c, 400, 300, GlassBall) && At(c, 100, 100, Black),
            // 200 × 200 in the middle of the window: a round ball around (400, 300), nothing where the ellipse was.
            ["ex-round"] = c => c.Drew && At(c, 400, 300, BallGreen) && At(c, 330, 300, BallGreen) && At(c, 400, 215, BallGreen) && At(c, 400, 190, Black)
                && At(c, 350, 400, Black) && At(c, 200, 400, Black),
            // A second, small red ball in the top right corner; the green one still there.
            ["ex-second"] = c => c.Drew && At(c, 700, 100, p => p[0] > 0.6 && p[1] < 0.1 && p[2] < 0.1) && At(c, 350, 400, BallGreen) && At(c, 100, 100, Black),
            // 90° per second: lying down at 1 s (90°), upright again at 2 s (180°).
            ["ex-spin"] = c => c.Drew && At(c, 1.0, 180, 400, BallGreen) && At(c, 1.0, 520, 400, BallGreen) && At(c, 1.0, 350, 215, Black)
                && At(c, 2.0, 350, 225, BallGreen) && At(c, 2.0, 350, 575, BallGreen) && At(c, 2.0, 180, 400, Black),
        },
        ["levels"] = new()
        {
            // Level two: stone pillars at the sides, its blue top row, the hollow middle.
            ["ex-start-level"] = c => c.Drew && At(c, 13, 29, Stone) && At(c, 396, 29, BlueBrick) && At(c, 396, 104, NightSky),
            // The blue bricks purple; the other rows unchanged.
            ["ex-brick-colour"] = c => c.Drew && At(c, 396, 141, IpExPurple) && At(c, 13, 141, IpExPurple) && At(c, 396, 29, OrangeBrick) && At(c, 396, 104, IpExGreenBrick),
            // The top row of level one solid stones; the rows below unchanged.
            ["ex-stone-row"] = c => c.Drew && At(c, 396, 29, Stone) && At(c, 13, 29, Stone) && At(c, 396, 104, IpExGreenBrick) && At(c, 396, 141, BlueBrick),
            // A 150-pixel paddle, still centred: its brass ends at x ≈ 333 and 467 (the 100-pixel one ends at 350 and 450).
            ["ex-wide-paddle"] = c => c.Drew && At(c, 333, 588, IpExBrass) && At(c, 470, 588, p => !DarkGround(p)) && At(c, 396, 29, OrangeBrick),
            // Level one in the top 200 pixels: rows of 25 pixels – the second row (yellow) at y = 29, the blue row at 90,
            // the stones at 140, the sky below 150.
            ["ex-flatter"] = c => c.Drew && At(c, 396, 29, p => p[0] > 0.55 && Math.Abs(p[0] - p[1]) < 0.05 && p[2] < 0.45) && At(c, 396, 90, BlueBrick)
                && At(c, 13, 140, Stone) && At(c, 396, 104, p => p[2] > p[0] + 0.05 && p[0] < 0.2) && At(c, 13, 209, p => !Stone(p)),
        },
        ["ball"] = new()
        {
            // Twice the speed: at 1.0 s (30 frames after the launch) the ball is at (500, 205) instead of (450, 385).
            ["ex-faster"] = c => c.Drew && At(c, 1.0, 500, 205, GlassBall) && At(c, 1.0, 450, 385, p => !GlassBall(p)),
            // Radius 25, still sitting on the paddle (reaching up to y = 530) and launched from there.
            ["ex-big-ball"] = c => c.Drew && At(c, 0.4, 400, 537, GlassBall) && At(c, 0.4, 400, 550, GlassBall) && At(c, 1.0, 450, 360, GlassBall) && At(c, 1.0, 450, 370, GlassBall),
            // Launched to the upper left: at 1.0 s at (350, 385), the mirror image of the usual (450, 385).
            ["ex-launch-left"] = c => c.Drew && At(c, 1.0, 348, 385, GlassBall) && At(c, 1.0, 450, 385, p => !GlassBall(p)),
            // The bottom edge bounces too: at 4.5 s the ball is on its way up again at the right edge, not gone.
            ["ex-bottom-bounce"] = c => c.Drew && At(c, 4.5, 772, 317, GlassBall),
        },
        ["collision-detection"] = new()
        {
            // The bricks the ball touches turn red instead of disappearing: at 3.0 s the channel is red, the stone grey.
            ["ex-mark-hits"] = c => c.Drew && At(c, 3.0, 506, 141, IpExHitRed) && At(c, 3.0, 560, 18, IpExHitRed) && At(c, 3.0, 506, 206, Stone),
            // Solid stones break too: at 3.0 s the stone (5, 9) the ball flew through is gone as well.
            ["ex-break-stones"] = c => c.Drew && At(c, 3.0, 506, 206, DuskSky) && At(c, 3.0, 506, 141, NightSky) && At(c, 3.0, 13, 209, Stone),
            // The ball stops at its first collision – the underside of the stone (5, 9) – and no brick is destroyed.
            ["ex-freeze"] = c => c.Drew && At(c, 3.0, 493, 235, GlassBall) && At(c, 3.0, 506, 141, BlueBrick) && At(c, 3.0, 560, 18, OrangeBrick),
        },
        ["collision-resolution"] = new()
        {
            // A 500-pixel paddle catches the ball coming down from the stone: at 3.0 s it flies up again at (678, 361)
            // instead of lying on the paddle after a reset.
            ["ex-catch"] = c => c.Drew && At(c, 3.0, 678, 361, GlassBall) && At(c, 3.0, 400, 567, p => !GlassBall(p)),
            // Losing the ball (frame 151) moves on to level two: at 3.0 s its stone pillars and blue top row.
            ["ex-next-level"] = c => c.Drew && At(c, 3.0, 13, 29, Stone) && At(c, 3.0, 396, 29, BlueBrick) && At(c, 3.0, 400, 567, GlassBall),
            // The stones let the ball through: at 2.0 s it has broken the blue brick above the stone and is on its way down.
            ["ex-ghost-stones"] = c => c.Drew && At(c, 2.0, 506, 141, NightSky) && At(c, 2.0, 549, 282, GlassBall) && At(c, 2.0, 506, 206, Stone),
        },
        ["particles"] = new()
        {
            // Orange embers: the trail behind the ball at 2.0 s red over green over blue instead of white.
            ["ex-embers"] = c => c.Drew && At(c, 2.0, 542, 410, p => p[0] > 0.9 && p[1] > 0.5 && p[1] < 0.85 && p[2] < 0.55) && At(c, 2.0, 530, 366, p => p[0] > p[1] + 0.15 && p[1] > p[2])
                && At(c, 2.0, 551, 435, GlassBall),
            // 20-pixel particles: a broad bright trail – many more nearly white pixels around it.
            ["ex-big-particles"] = c => c.Drew && IpExCountIn(c, 2.0, 500, 300, 580, 425, p => p[0] > 0.85 && p[1] > 0.8 && p[2] > 0.85) >= 9 && At(c, 2.0, 551, 435, GlassBall),
            // A slower fade: at 2.0 s the trail still reaches back up to the stone the ball bounced off (frame 86).
            ["ex-long-trail"] = c => c.Drew && IpExAnyIn(c, 2.0, 480, 230, 515, 265, p => p[0] > 0.5 && p[2] > 0.55) && At(c, 2.0, 522, 332, p => p[0] > 0.85 && p[2] > 0.85),
            // Normal blending instead of additive: the trail no longer glows white next to the ball.
            ["ex-no-glow"] = c => c.Drew && At(c, 2.0, 542, 410, p => p[0] > 0.45 && p[0] < 0.8 && p[2] > 0.45 && p[2] < 0.8) && At(c, 2.0, 530, 366, p => p[0] > 0.4 && p[0] < 0.7)
                && At(c, 2.0, 551, 435, GlassBall),
        },
        ["postprocessing"] = new()
        {
            // The normal picture in grey (luminance): bricks, sky and paddle red = green = blue at 1.0 s.
            ["ex-greyscale"] = c => c.Drew && At(c, 1.0, 396, 29, p => IpExGrey(p, 0.33, 0.57)) && At(c, 1.0, 13, 29, p => IpExGrey(p, 0.42, 0.67))
                && At(c, 1.0, 358, 588, p => IpExGrey(p, 0.55, 0.8)) && At(c, 1.0, 200, 250, p => IpExGrey(p, 0.1, 0.3)),
            // A shake of half a second from frame 86: still blurred and moving at 1.8 s (frame 108); before the hit as normal.
            ["ex-long-shake"] = c => c.Drew && At(c, 1.8, 358, 588, p => p[0] > 0.3 && p[0] < 0.79 && p[2] < 0.35) && At(c, 1.8, 200, 250, DuskSky)
                && At(c, 1.0, 358, 588, IpExBrass),
            // Confuse turned on without the inversion: upside down and mirrored – the paddle in its own colours at the top,
            // the bricks at the bottom, the sky not inverted.
            ["ex-flip-only"] = c => c.Drew && At(c, 1.0, 442, 12, IpExBrass) && At(c, 1.0, 358, 588, OrangeBrick)
                && At(c, 1.0, 200, 250, p => p[2] > p[0] && p[0] > p[1] && p[0] < 0.35),
            // Darker towards the corners: the corner bricks dim orange, the middle of the window as before.
            ["ex-vignette"] = c => c.Drew && At(c, 1.0, 13, 29, IpExDimOrange) && At(c, 1.0, 787, 29, IpExDimOrange) && At(c, 1.0, 400, 300, DuskSky),
        },
    };
}
