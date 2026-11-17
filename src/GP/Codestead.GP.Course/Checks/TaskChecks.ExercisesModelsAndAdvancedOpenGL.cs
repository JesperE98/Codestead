namespace Codestead.GP.Course.Checks;

// The exercises' checks of model-loading and advanced-opengl, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner.
public static partial class TaskChecks
{
    /// <summary>The 16-bit index type of an API, with the vector of indices to match (and its size per index).</summary>
    private static bool ShortIndices(CheckContext c) => c.Api switch
    {
        "opengl" => c.Has(@"std::vector < (?:unsigned short|uint16_t|GLushort) > indices") && c.Has("GL_UNSIGNED_SHORT")
            && c.Has(@"sizeof \( (?:unsigned short|uint16_t|GLushort|indices \[ 0 \]) \)"),
        "vulkan" => c.Has(@"std::vector < (?:uint16_t|unsigned short) > indices") && c.Has("VK_INDEX_TYPE_UINT16"),
        _ => c.Has(@"std::vector < (?:UINT16|uint16_t|unsigned short|WORD) > indices") && c.Has("DXGI_FORMAT_R16_UINT")
            && c.Has(@"sizeof \( (?:UINT16|uint16_t|unsigned short|WORD|indices \[ 0 \]) \)"),
    };

    /// <summary>The lit planet's north pole (light grey ice, ≈ 120,123,125) at the top of the model, at a time.</summary>
    private static bool LitPole(CheckContext c, double time = 1) => c.PixelAt(time, 0.5, 0.31) is { } p && p[0] > 0.4 && p[1] > 0.4 && p[2] > 0.4;

    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesModelsAndAdvancedOpenGL => new()
    {
        ["mesh"] = new()
        {
            // Vulkan: the test square (texture-coordinate colours) and a second one to its right, in the same buffers.
            ["ex-second-square"] = c => c.PixelIs(0.5, 0.5, 0.51, 0.51, 0) && c.DrawnAt(0.8, 0.5) && c.IsClear(0.95, 0.5),
            // Nothing changes in the picture (Vulkan: still the square), only the index type.
            ["ex-short-indices"] = c => (c.Api == "vulkan" ? c.PixelIs(0.5, 0.5, 0.51, 0.51, 0) : c.Shows) && ShortIndices(c),
            // OpenGL: the naming convention for a fourth kind of texture.
            ["ex-height-textures"] = c => c.Built && c.Has(@"""texture_height""") && c.Has(@"heightNr \+\+"),
        },
        ["model"] = new()
        {
            // The light up to the left: the left rim (an ocean) lit, the right side (land) in the shadow.
            ["ex-light-left"] = c => c.Pixel(0.365, 0.5) is { } l && l[2] > 0.25 && c.Pixel(0.635, 0.5) is { } r && r[1] < 0.15,
            // normal * 0.5 + 0.5: the left rim little red, the right rim much, the middle (facing the camera) blue, the pole green.
            ["ex-normals"] = c => c.Pixel(0.365, 0.5) is { } l && l[0] < 0.25 && c.Pixel(0.635, 0.5) is { } r && r[0] > 0.75
                && c.Pixel(0.5, 0.5) is { } m && m[2] > 0.9 && c.Pixel(0.5, 0.31) is { } n && n[1] > 0.85,
            // It turns about its own axis: the picture changes, the north pole stays where it is.
            ["ex-spin"] = c => c.ChangesOverTime && LitPole(c) && LitPole(c, 2.3),
            // A small second planet up to the right of the first: (1.2, 0.6, 0) is (690, 155) in the window.
            ["ex-moon"] = c => LitPole(c) && c.DrawnAt(0.862, 0.258),
        },
    };
}
