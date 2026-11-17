using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// The exercises' checks of getting-started and lighting, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner.
public static partial class TaskChecks
{
    /// <summary>The colour at a point of the frame at a time is (r, g, b), within a tolerance per channel.</summary>
    private static bool PixelAtIs(CheckContext c, double time, double x, double y, double r, double g, double b, double tolerance = 0.03) =>
        c.PixelAt(time, x, y) is { } p && CheckContext.Near(p[0], r, tolerance) && CheckContext.Near(p[1], g, tolerance) && CheckContext.Near(p[2], b, tolerance);

    /// <summary>The sum of a point's colour channels at a time (0 when nothing is shown).</summary>
    private static double BrightnessAt(CheckContext c, double time, double x, double y) => c.PixelAt(time, x, y) is { } p ? p[0] + p[1] + p[2] : 0;

    /// <summary>Something is drawn at a point and its colour is a grey (all three channels within 0.02).</summary>
    private static bool GreyAt(CheckContext c, double x, double y) =>
        c.DrawnAt(x, y) && c.Pixel(x, y) is { } p && CheckContext.Near(p[0], p[1], 0.02) && CheckContext.Near(p[1], p[2], 0.02);

    /// <summary>A colour is the frame's clear colour (±0.02 per channel).</summary>
    private static bool IsClearColour(CheckContext c, double[] p) => c.Scene?.ClearColor is { } clear
        && CheckContext.Near(p[0], clear[0], 0.02) && CheckContext.Near(p[1], clear[1], 0.02) && CheckContext.Near(p[2], clear[2], 0.02);

    /// <summary>
    /// How many points of a grid over a box (relative x0…x1, y0…y1, 0.025 apart) have another colour at time t2 than
    /// at t1 (by more than 0.1 in some channel).
    /// </summary>
    private static int ChangedPoints(CheckContext c, double x0, double y0, double x1, double y1, double t1 = 1.0, double t2 = 2.3)
    {
        if (c.FrameAt(t1) is not { } a || c.FrameAt(t2) is not { } b) return 0;
        int n = 0;
        for (double y = y0; y <= y1 + 1e-9; y += 0.025)
            for (double x = x0; x <= x1 + 1e-9; x += 0.025)
            {
                var p = a.AtRelative(x, y);
                var q = b.AtRelative(x, y);
                if (Math.Abs(p[0] - q[0]) > 0.1 || Math.Abs(p[1] - q[1]) > 0.1 || Math.Abs(p[2] - q[2]) > 0.1) n++;
            }
        return n;
    }

    /// <summary>Some drawn pixel has a colour (±0.03 per channel): a small object somewhere in the frame, such as a lamp.</summary>
    private static bool AnyPixelIs(CheckContext c, double r, double g, double b) =>
        c.AnyDrawnPixel(p => CheckContext.Near(p[0], r, 0.03) && CheckContext.Near(p[1], g, 0.03) && CheckContext.Near(p[2], b, 0.03));

    /// <summary>The mean of r + g + b over a grid in a box of the frame (relative x0…x1, y0…y1, 0.01 apart); 0 when nothing is shown.</summary>
    private static double MeanBrightness(CheckContext c, double x0, double y0, double x1, double y1)
    {
        if (c.Frame is not { } f) return 0;
        double sum = 0;
        int n = 0;
        for (double y = y0; y <= y1 + 1e-9; y += 0.01)
            for (double x = x0; x <= x1 + 1e-9; x += 0.01)
            {
                var p = f.AtRelative(x, y);
                sum += p[0] + p[1] + p[2];
                n++;
            }
        return sum / n;
    }

    /// <summary>The pixels of the check frame that show the emission map's green letters.</summary>
    private static int GreenLetters(CheckContext c) => c.CountPixels(p => p[1] > p[0] + 0.3 && p[1] > p[2] + 0.2);

    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesGettingStarted => new()
    {
        // OpenGL has none: its program ends at once (no render loop yet). Nothing is drawn in any API.
        ["creating-a-window"] = new()
        {
            // Nothing is run without a surface yet, so the code says it: the properties are read and the limit printed.
            ["ex-texture-limit"] = c => c.Built && c.Has(@"vkGetPhysicalDeviceProperties \( physicalDevice ,") && c.Has(@"(?:std :: )?(?:cout|cerr) <<[^;]*\. limits \. maxImageDimension2D|printf \([^;]*\. limits \. maxImageDimension2D"),
            // Both the adapter test and the device ask for 12_0, none for 11_0 any more.
            ["ex-feature-level"] = c => c.Built && c.Count("D3D_FEATURE_LEVEL_12_0") >= 2 && !c.Has("D3D_FEATURE_LEVEL_11_0"),
        },
        ["hello-window"] = new()
        {
            // The whole window in the new colour.
            ["ex-clear-colour"] = c => c.PixelIs(0.5, 0.5, 0.6, 0.2, 0.4) && c.PixelIs(0.1, 0.9, 0.6, 0.2, 0.4),
            // A 1024×576 window, still cleared to the chapter's colour (the simulator reads D3D12's swap chain size from
            // m_width/m_height, which it cannot follow: there the code says it).
            ["ex-window-size"] = c => c.PixelIs(0.5, 0.5, 0.2, 0.3, 0.3) && (c.Api == Apis.D3D12
                ? c.Has(@"width = 1024 ;") && c.Has(@"height = 576 ;")
                : c.Scene!.Width == 1024 && c.Scene.Height == 576),
            ["ex-quit-key"] = PerApi(
                opengl: c => c.Shows && c.Has(@"glfwGetKey \( window , GLFW_KEY_Q \) == GLFW_PRESS"),
                vulkan: c => c.Shows && c.Has(@"glfwGetKey \( window , GLFW_KEY_ESCAPE \) == GLFW_PRESS") && c.Has(@"glfwSetWindowShouldClose \( window ,"),
                d3d12: c => c.Shows && c.Has(@"wParam == (?:'Q'|0x51)")),
        },
        ["shaders"] = new()
        {
            // The upside-down triangle on the left half instead of the right.
            ["ex-offset-left"] = c => c.DrawnAt(0.25, 0.4) && c.DrawnAt(0.25, 0.6) && c.IsClear(0.75, 0.4),
            // 1 - colour: blue (z = 0 everywhere) becomes 1 all over the triangle.
            ["ex-invert"] = c => c.Pixel(0.75, 0.4) is { } a && a[2] > 0.9 && c.Pixel(0.75, 0.6) is { } b && b[2] > 0.9 && c.IsClear(0.25, 0.5),
            // The colours fade with sin(t) / 2 + 0.5: bright at 1 s (0.92), almost black at 4 s (0.12) – the red top right corner.
            ["ex-pulse"] = c => c.DrawnAt(0.75, 0.4) && BrightnessAt(c, 1.0, 0.85, 0.28) > BrightnessAt(c, 4.0, 0.85, 0.28) + 0.15,
        },
        ["textures"] = new()
        {
            // Tinted by the vertex colours: red towards the top right corner, green towards the bottom right.
            ["ex-tint"] = c => c.Dominant(0.68, 0.32) == 'r' && c.Dominant(0.68, 0.68) == 'g',
            ["ex-grey"] = c => GreyAt(c, 0.35, 0.35) && GreyAt(c, 0.5, 0.5) && GreyAt(c, 0.65, 0.65) && GreyAt(c, 0.4, 0.6),
            // Zoomed in on the middle of both pictures: none of the dark outlines (the container's frame, the faces'
            // eyes and mouths) is left; and the magnification filter is "nearest".
            ["ex-pixels"] = c => c.DrawnAt(0.5, 0.5) && c.CountPixels(p => p[0] + p[1] + p[2] < 0.6) < 10 && c.Api switch
            {
                Apis.OpenGL => c.Has(@"GL_TEXTURE_MAG_FILTER , GL_NEAREST"),
                Apis.Vulkan => c.Has(@"magFilter = VK_FILTER_NEAREST"),
                _ => c.Has(@"Filter = D3D12_FILTER_(?:MIN_MAG_MIP_POINT|MIN_LINEAR_MAG_MIP_POINT|MIN_MAG_POINT_MIP_LINEAR|MIN_LINEAR_MAG_POINT_MIP_LINEAR)"),
            },
        },
        ["transformations"] = new()
        {
            // At 1 s the orbiting container has turned 2 radians instead of 1: its centre is near (0.62, 0.17) of the
            // window instead of (0.85, 0.43).
            ["ex-faster"] = c => c.DrawnAt(0.62, 0.17) && c.IsClear(0.85, 0.43),
            // A small container at the bottom left (centre (0.25, 0.75), 0.25 × 0.25 of the window), clear around it.
            ["ex-third-container"] = c => c.DrawnAt(0.25, 0.75) && c.DrawnAt(0.18, 0.68) && c.IsClear(0.25, 0.6) && c.IsClear(0.1, 0.75),
            // At 4 s sin is −0.76: before, the top-left container was 0.76 wide (flipped); now 0.75 − 0.19 = 0.56 –
            // its right edge moves from 0.44 to 0.39 of the window. At 1.57 s (sin = 1) it is the full size.
            ["ex-no-flip"] = c => c.PixelAt(4.0, 0.25, 0.25) is { } mid && !IsClearColour(c, mid)
                && c.PixelAt(4.0, 0.415, 0.25) is { } edge && IsClearColour(c, edge)
                && c.PixelAt(1.5708, 0.48, 0.25) is { } full && !IsClearColour(c, full),
            // The top-left container at 1 s (scale 0.84) turned 45°: a diamond – drawn straight right of its centre
            // where the square ends, clear in the square's corner.
            ["ex-tilt"] = c => c.DrawnAt(0.25, 0.25) && c.DrawnAt(0.5, 0.25) && c.IsClear(0.44, 0.06),
        },
        ["coordinate-systems"] = new()
        {
            // A 90° field of view: every cube is smaller, the middle one still in the centre, the space around it clear.
            ["ex-fov"] = c => c.DrawnAt(0.5, 0.5) && c.IsClear(0.5, 0.3) && c.IsClear(0.25, 0.2) && c.IsClear(0.8, 0.5) && c.IsClear(0.5, 0.7),
            // The camera one unit higher: the scene moves down – the middle cube now near the bottom edge, its old
            // place clear.
            ["ex-camera-up"] = c => c.DrawnAt(0.5, 0.88) && c.DrawnAt(0.2, 0.55) && c.IsClear(0.5, 0.45),
            // Orthographic, 8 × 6 units: all cubes the same small size, wherever they are in depth.
            ["ex-ortho"] = c => c.DrawnAt(0.5, 0.5) && c.DrawnAt(0.3, 0.8) && c.DrawnAt(0.67, 0.22) && c.IsClear(0.5, 0.3) && c.IsClear(0.5, 0.7),
            // The cubes on the right (4 and 8) stood still before; now they turn too.
            ["ex-spin-all"] = c => ChangedPoints(c, 0.75, 0.35, 0.95, 0.6) > 5,
        },
        // Keys and the mouse do not move the simulated camera: those exercises are checked in the code.
        ["camera"] = new()
        {
            // From (−3, 0, 0) along +x: the middle cube still in the centre, cube 9 (−1.3, 1, −1.5) now big on the left,
            // the right side (cubes 4 and 8 before) empty.
            ["ex-side-view"] = c => c.DrawnAt(0.5, 0.5) && c.DrawnAt(0.2, 0.5) && c.IsClear(0.85, 0.45) && c.IsClear(0.75, 0.25),
            ["ex-sprint"] = c => c.Shows && (c.Api == Apis.D3D12
                ? c.Has(@"keys \[ VK_[LR]?SHIFT \]")
                : c.Has(@"glfwGetKey \( window , GLFW_KEY_(?:LEFT|RIGHT)_SHIFT \)")),
            ["ex-invert-mouse"] = c => c.Shows && (c.Has(@"yoffset = ypos - lastY") || c.Has(@"pitch -= yoffset")),
            ["ex-ground"] = c => c.Shows && (c.Api == Apis.D3D12
                ? c.Has(@"cameraPos = XMVectorSetY \( cameraPos , 0(?:\.0*)?f? \)")
                : c.Has(@"cameraPos \. y = 0(?:\.0*)?f? ;")),
        },
        ["colors"] = new()
        {
            // Coral (1, 0.5, 0.31) in green light: only the green part is reflected; the lamp is still white.
            ["ex-green-light"] = c => c.PixelIs(0.28, 0.6, 0.0, 0.5, 0.0) && AnyPixelIs(c, 1.0, 1.0, 1.0),
            // A cyan object reflects no red: in red light it is black.
            ["ex-black-cube"] = c => c.PixelIs(0.28, 0.6, 0.0, 0.0, 0.0) && c.PixelIs(0.2, 0.55, 0.0, 0.0, 0.0),
            // Warm light (1, 0.8, 0.6): the cube (1, 0.4, 0.19), and the lamp in the light's colour – no white left.
            ["ex-lamp-colour"] = c => c.PixelIs(0.28, 0.6, 1.0, 0.4, 0.186) && AnyPixelIs(c, 1.0, 0.8, 0.6) && !AnyPixelIs(c, 1.0, 1.0, 1.0),
        },
        ["basic-lighting"] = new()
        {
            // The unlit left face shows only the ambient part: 0.3 × coral instead of 0.1 × coral.
            ["ex-ambient"] = c => c.PixelIs(0.2, 0.6, 0.3, 0.15, 0.093),
            // A shininess of 4: the highlight spreads over most of the lit face (bright out to its left edge).
            ["ex-shininess"] = c => c.Pixel(0.3, 0.5) is { } a && a[0] > 0.88 && c.Pixel(0.31, 0.55) is { } b && b[0] > 0.88,
            // Specular added after the object colour: the highlight turns whitish – more blue than coral can reflect
            // (at most (0.1 + 1 + 0.5) × 0.31 = 0.5) – but not the white lamp.
            ["ex-white-highlight"] = c => c.AnyDrawnPixel(p => p[2] > 0.55 && p[2] < 0.9 && p[1] > 0.6 && p[0] > 0.9),
            // The light circles at height 1, radius 2: at 1 s it is at (1.68, 1, 1.08) – the lamp higher and further
            // left on screen than the chapter's (2.68, 0.48, 2).
            ["ex-orbit"] = c => c.PixelIs(0.655, 0.375, 1.0, 1.0, 1.0) && !c.PixelIs(0.866, 0.506, 1.0, 1.0, 1.0),
        },
        ["materials"] = new()
        {
            // Cyan plastic reflects no red: on the lit face red is (almost) nothing, green and blue are there.
            ["ex-cyan-plastic"] = c => c.Pixel(0.42, 0.6) is { } p && p[0] < 0.05 && p[1] > 0.08 && p[2] > 0.12,
            // Between 4.71 s and 4.83 s all three sines are negative: the chapter's cube goes black there (no light at
            // all); with 0.5 + 0.5 · sin the light is about (0.44, 0.40, 0.46) and the lit face still shows.
            ["ex-positive"] = c => BrightnessAt(c, 4.77, 0.42, 0.62) > 0.25,
            // Gold under a steady white light: yellow-brown (green about 0.8 of red, little blue), the same at 1 s and 4 s.
            ["ex-gold"] = c => c.Pixel(0.42, 0.6) is { } p && p[0] > 0.25 && p[1] > 0.7 * p[0] && p[1] < 0.95 * p[0] && p[2] < 0.5 * p[1]
                && PixelAtIs(c, 4.0, 0.42, 0.6, p[0], p[1], p[2], 0.01),
        },
        ["lighting-maps"] = new()
        {
            // Twice the diffuse light: the lit face (wood and letters) about 1.5 times as bright (0.73 → 1.12).
            ["ex-bright-light"] = c => MeanBrightness(c, 0.36, 0.52, 0.42, 0.64) > 0.95,
            // The highlight on the lit face's steel frame goes (1.41 → 0.92); the wood takes the specular light instead.
            ["ex-invert-specular"] = c => c.DrawnAt(0.32, 0.45) && MeanBrightness(c, 0.29, 0.43, 0.35, 0.48) < 1.15,
            // No letters on the steel frame any more (about a third of them), but still on the wood.
            ["ex-emission-mask"] = c => GreenLetters(c) is > 80 and < 290,
            // The letters move: the picture changes over time (the chapter's scene stands still).
            ["ex-scroll-emission"] = c => GreenLetters(c) > 80 && c.ChangesOverTime,
        },
        ["light-casters"] = new()
        {
            // A cone of 25°/30°: the cube to the right of the middle one is lit too (mean brightness 0.14 → 0.42).
            ["ex-wide-cone"] = c => MeanBrightness(c, 0.7, 0.25, 0.85, 0.45) > 0.3,
            // A red flashlight: the middle cube keeps its red (0.38), green and blue are only the white ambient part.
            ["ex-red-light"] = c => c.Pixel(0.5, 0.5) is { } p && p[0] > 0.3 && p[1] < 0.06 && p[2] < 0.04,
            // A range of about 13 units: the middle cube, 3 units away, gets about a third of the light (0.81 → 0.25).
            ["ex-short-range"] = c => BrightnessAt(c, 1.0, 0.5, 0.5) is > 0.12 and < 0.45,
            // The strength follows 0.5 + 0.5 · sin(2t): nearly full at 1 s, (almost) out at 2.36 s (3π/4).
            ["ex-fading"] = c => BrightnessAt(c, 1.0, 0.5, 0.5) > 0.6 && BrightnessAt(c, 2.356, 0.5, 0.5) < 0.2,
        },
    };
}
