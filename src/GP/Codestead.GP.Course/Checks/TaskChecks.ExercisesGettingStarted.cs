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
    };
}
