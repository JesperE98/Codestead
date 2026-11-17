using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// The exercises' checks of guest-articles, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are pixels of the 800×600 window from the top left (the same
// place in every API), as in the chapters' own checks (TaskChecks.GuestArticles*.cs).
public static partial class TaskChecks
{
    /// <summary>A colour within ±0.04 per channel.</summary>
    private static bool Rgb(double[] p, double r, double g, double b, double tolerance = 0.04) =>
        Math.Abs(p[0] - r) <= tolerance && Math.Abs(p[1] - g) <= tolerance && Math.Abs(p[2] - b) <= tolerance;

    /// <summary>The frustum culling demo's counts in the window title at 2.0 s ("… drawn: 37 / 101"); (-1, -1) when missing.</summary>
    private static (int Drawn, int Total) DrawnOf(CheckContext c) =>
        System.Text.RegularExpressions.Regex.Match(c.WindowTitleAt(2.0), @"drawn:\s*(\d+)\s*/\s*(\d+)") is { Success: true } m
            ? (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value)) : (-1, -1);

    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesGuestArticles => new()
    {
        ["oit-introduction"] = new()
        {
            // The green quad at 0.8: brighter over black, and the red mostly hidden under it.
            ["ex-opacity"] = c => c.Drew && At(c, 200, 450, p => Rgb(p, 0, 0.8, 0)) && At(c, 450, 400, p => Rgb(p, 0.2, 0.8, 0)) && At(c, 620, 300, OitRed),
            // Back to front: the blue corner shows through the green quad (green over blue over black).
            ["ex-sorted"] = c => c.Drew && At(c, 230, 300, p => Rgb(p, 0, 0.5, 0.25)) && At(c, 200, 450, p => Half(p, 1)) && At(c, 400, 180, OitRed),
            // No depth writes, the wrong order kept: the blue quad blended over the green one, as if it were in front.
            ["ex-depth-mask"] = c => c.Drew && At(c, 230, 300, p => Rgb(p, 0, 0.25, 0.5)) && At(c, 200, 450, p => Half(p, 1)) && At(c, 400, 180, OitRed),
        },
        ["weighted-blended"] = new()
        {
            // The green quad at 0.8: 0,204,0 over black, and it outweighs the blue one where they overlap (0,141,88).
            ["ex-opacity"] = c => c.Drew && At(c, 200, 450, p => Rgb(p, 0, 0.8, 0)) && At(c, 230, 300, p => Rgb(p, 0, 0.55, 0.35)) && At(c, 620, 300, OitRed),
            // Blue drawn before green: the same picture as the chapter's (overlap 0,96,96) – order independent.
            ["ex-order"] = c => c.Drew && At(c, 230, 300, p => Rgb(p, 0, 0.376, 0.376)) && At(c, 200, 450, p => Half(p, 1)) && At(c, 250, 120, p => Half(p, 2)) && c.Api switch
            {
                Apis.OpenGL => c.Has(@"vp \* blueModelMat \)[\s\S]*vp \* greenModelMat \)"),
                Apis.Vulkan => c.Has(@"vp \* blueModelMat ;[\s\S]*vp \* greenModelMat ;"),
                _ => c.Has(@"XMLoadFloat4x4 \( & m_blueModelMat \)[\s\S]*XMLoadFloat4x4 \( & m_greenModelMat \)"),
            },
            // The red quad half transparent with the others: 128,0,0 alone, and the blue quad shows behind it (96,0,96).
            ["ex-red-transparent"] = c => c.Drew && At(c, 620, 300, p => Half(p, 0)) && At(c, 400, 180, p => Rgb(p, 0.376, 0, 0.376)) && At(c, 450, 400, p => Rgb(p, 0.376, 0.376, 0)),
            // A weight that is larger near the camera: the green quad (nearer) counts more than the blue one where they overlap.
            ["ex-weight"] = c => c.Drew && At(c, 230, 300, p => p[0] < 0.03 && p[1] > p[2] + 0.06 && p[1] + p[2] > 0.6) && At(c, 200, 450, p => Half(p, 1)) && At(c, 250, 120, p => Half(p, 2)),
        },
        ["skeletal-animation"] = new()
        {
            // Half speed: at 2.5 s the animation is at 1.25 s (leaning right; the chapter's is at 0.5 s, leaning left), at 0.5 s at 0.25 s.
            ["ex-slow-motion"] = c => c.Drew && At(c, 2.5, 568, 100, Tentacle) && At(c, 2.5, 460, 300, Tentacle) && At(c, 2.5, 230, 100, Space) && At(c, 2.5, 400, 200, Space)
                && At(c, 0.5, 230, 100, Tentacle) && At(c, 0.5, 568, 100, Space),
            // The pose of 1.25 s, standing still: leaning right at 0.25 s too.
            ["ex-freeze-pose"] = c => c.Drew && new[] { 0.25, 1.25 }.All(t => At(c, t, 568, 100, Tentacle) && At(c, t, 460, 300, Tentacle) && At(c, t, 230, 100, Space) && At(c, t, 400, 200, Space)),
            // The base bone kept in its rest pose: the tentacle sways less far (the tip at x 490..530 at 1.25 s, 265..305 at 0.25 s).
            ["ex-still-base"] = c => c.Drew && At(c, 1.25, 510, 100, Tentacle) && At(c, 1.25, 568, 100, Space) && At(c, 1.25, 400, 200, Space)
                && At(c, 0.25, 285, 100, Tentacle) && At(c, 0.25, 230, 100, Space),
            // The Upper bone's weight as red: bright in the middle of the tube, black at the foot and the tip.
            ["ex-bone-weight"] = c => c.Drew && At(c, 1.25, 460, 300, p => p[0] > 0.85 && p[1] < 0.03 && p[2] < 0.03) && At(c, 1.25, 460, 250, p => p[0] > 0.4 && p[0] < 0.8 && p[1] < 0.03)
                && At(c, 1.25, 400, 520, Black) && At(c, 1.25, 568, 100, Black) && At(c, 1.25, 100, 300, Space),
        },
        ["scene-graph"] = new()
        {
            // Turned the other way: at 2.0 s the chain comes out of the screen, down to the right.
            ["ex-reverse"] = c => c.Shows && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 380, 380, Planet) && At(c, 2.0, 490, 435, Planet) && At(c, 2.0, 575, 465, Planet)
                && At(c, 2.0, 385, 273, Space) && At(c, 2.0, 456, 250, Space),
            // Children 0.8 times their parent: larger and farther apart (the positions are scaled too), the chain reaching x ≈ 690.
            ["ex-child-scale"] = c => c.Shows && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 475, 240, Planet) && At(c, 2.0, 650, 180, Planet) && At(c, 2.0, 600, 500, Space),
            // A second child of the root, high above it; the chain as before.
            ["ex-moon"] = c => c.Shows && At(c, 2.0, 222, 185, Planet) && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 385, 273, Planet) && At(c, 2.0, 456, 250, Planet) && At(c, 2.0, 222, 230, Space),
            // Every child tilted 30° about z on top of its parent: the chain curls upwards.
            ["ex-spiral"] = c => c.Shows && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 450, 207, Planet) && At(c, 2.0, 468, 152, Planet)
                && At(c, 2.0, 456, 250, Space) && At(c, 2.0, 494, 238, Space),
        },
        ["frustum-culling"] = new()
        {
            // A 30° culling frustum inside the camera's 45°: the top of the grid (far42) culled, fewer than 38 drawn (26).
            ["ex-narrow-fov"] = c => c.Shows && DrawnOf(c) is ( > 10 and < 38, 101) && At(c, 2.0, 396, 76, Space)
                && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 429, 327, Planet) && At(c, 2.0, 680, 459, Planet),
            // The near plane at 12: the planets close to the camera (near, and the one at the bottom left) culled (35 drawn).
            ["ex-near-plane"] = c => c.Shows && DrawnOf(c) is ( > 10 and < 38, 101) && At(c, 2.0, 680, 459, Space) && At(c, 2.0, 165, 430, Space)
                && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 429, 327, Planet) && At(c, 2.0, 396, 76, Planet),
            // 12 × 12 children around the root: 145 entities, more of them drawn (49), the old grid still there.
            ["ex-bigger-grid"] = c => c.Shows && DrawnOf(c) is ( > 38, 145) && PlanetGrid(c) && At(c, 2.0, 238, 320, Planet),
        },
        ["csm"] = new()
        {
            // Half the direct light in shadow: the shadows (17,11,7 before) about 41,28,17, the lit floor as before.
            ["ex-half-shadow"] = c => c.Drew && new[] { (490, 475), (290, 273), (155, 335) }.All(q => At(c, q.Item1, q.Item2, p => p[0] > 0.11 && p[0] < 0.2 && p[0] > p[1] && p[1] > p[2]))
                && At(c, 650, 470, CsmWood) && At(c, 480, 230, CsmWood),
            // The light from the left: the shadows fall to the right – the old shadow spots lit, the floor at (650,470) in shadow.
            ["ex-sun-left"] = c => c.Drew && At(c, 650, 470, CsmShadow) && At(c, 640, 460, CsmShadow) && At(c, 490, 475, CsmWood) && At(c, 155, 335, CsmWood) && At(c, 480, 230, CsmWood),
            // Layer 0 of the shadow maps: light grey everywhere (nothing white as in layer 2), the cubes a little darker.
            ["ex-debug-layer"] = c => c.Drew && At(c, 400, 40, p => Grey(p) && p[0] > 0.88 && p[0] < 0.95) && At(c, 650, 470, p => Grey(p) && p[0] > 0.84 && p[0] < 0.9)
                && At(c, 520, 400, p => Grey(p) && p[0] < 0.86),
        },
    };
}
