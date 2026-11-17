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

    /// <summary>How many points of a box of the window (relative, 0.01 apart) pass a test.</summary>
    private static int CountInBox(CheckContext c, double x0, double y0, double x1, double y1, Func<double[], bool> test)
    {
        int n = 0;
        for (double y = y0; y <= y1; y += 0.01)
            for (double x = x0; x <= x1; x += 0.01)
                if (c.Pixel(x, y) is { } p && test(p)) n++;
        return n;
    }

    /// <summary>A pixel lit at all (any channel above 0.05): the edge-detection picture is black where nothing changes.</summary>
    private static bool LitAboveBlack(double[] p) => Math.Max(p[0], Math.Max(p[1], p[2])) > 0.05;

    private static bool OrangeOutline(double[] p) => p[0] > 0.9 && p[1] > 0.5 && p[1] < 0.7 && p[2] < 0.1;

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
        // Advanced OpenGL: learnopengl's scene at the same named points as the steps' checks (TaskChecks.AdvancedOpenGL.cs).
        ["depth-testing"] = new()
        {
            // Linear depth over 10 units instead of 100: cube 0 (4 units away) a middle grey, the far floor lighter.
            ["ex-depth-range"] = c => At(c, 193, 300, p => Grey(p) && p[0] > 0.25 && p[0] < 0.45) && At(c, 600, 370, p => Grey(p) && p[0] > 0.4),
            // The textures again, faded into the background grey with the distance: the near floor still metal, the far floor darker.
            ["ex-fog"] = c => At(c, 100, 500, Metal) && At(c, 600, 370, p => p[0] < 0.36 && p[0] > 0.15) && At(c, 193, 300, p => !Grey(p) || p[0] > 0.3),
            // The near plane at 3.7: the near floor and cube 1's face are cut away, cube 0 shows its inside.
            ["ex-near-clip"] = c => c.IsClear(100 / 800.0, 500 / 600.0) && c.IsClear(760 / 800.0, 250 / 600.0) && c.DrawnAt(193 / 800.0, 300 / 600.0),
        },
        ["stencil-testing"] = new()
        {
            ["ex-orange-outline"] = c => At(c, 82, 300, OrangeOutline) && At(c, 702, 300, OrangeOutline) && At(c, 193, 300, Marble),
            // Scaled by 1.2: the outline reaches further out (64, 300), where 1.1 left the background.
            ["ex-thick-outline"] = c => At(c, 64, 300, Outline) && At(c, 82, 300, Outline) && At(c, 193, 300, Marble),
            // Only cube 0 is outlined.
            ["ex-left-only"] = c => At(c, 82, 300, Outline) && At(c, 702, 300, Background) && At(c, 193, 300, Marble),
            // GL_EQUAL: the single colour covers the cubes (stencil 1) instead of the ring around them.
            ["ex-silhouette"] = c => At(c, 193, 300, Outline) && At(c, 82, 300, Background) && At(c, 100, 500, Metal),
        },
        ["blending"] = new()
        {
            // Without blending the glass is its own red, not mixed with the background behind it (470, 230).
            ["ex-opaque-glass"] = c => At(c, 470, 230, p => p[0] > 0.8 && p[1] < 0.2),
            // Alpha below 0.6 discarded: the glass is gone, the frame stays.
            ["ex-threshold"] = c => At(c, 470, 240, Background) && At(c, 450, 330, Background) && c.AnyDrawnPixel(p => p[0] > 0.35 && p[1] < 0.1 && p[2] < 0.1),
            // A sixth window at (-0.8, 0, 1.0): red glass over the background up to the left (130, 150).
            ["ex-sixth-window"] = c => At(c, 130, 150, p => p[0] > 0.4 && p[0] < 0.7 && p[1] < 0.2) && At(c, 470, 230, p => p[0] > 0.4 && p[1] < 0.2),
        },
        ["face-culling"] = new()
        {
            // Front faces clockwise while the front is culled: the outsides (counter-clockwise) count as back faces and stay.
            ["ex-clockwise"] = c => At(c, 100, 500, Metal) && At(c, 193, 300, Marble)
                && c.Has(@"glFrontFace \( GL_CW \)|frontFace = VK_FRONT_FACE_CLOCKWISE|FrontCounterClockwise = FALSE"),
            // Every face culled: nothing but the background.
            ["ex-cull-all"] = c => c.Shows && c.IsClear(193 / 800.0, 300 / 600.0) && c.IsClear(100 / 800.0, 500 / 600.0) && c.IsClear(760 / 800.0, 250 / 600.0)
                && c.Has("GL_FRONT_AND_BACK|VK_CULL_MODE_FRONT_AND_BACK"),
            // Under the floor, looking up at its back: the floor shows above the middle of the window although front faces are culled.
            ["ex-under-floor"] = c => At(c, 400, 150, p => p[2] > p[0] + 0.02 && p[0] > 0.25) && At(c, 400, 200, p => p[2] > p[0] + 0.02 && p[0] > 0.25),
        },
        ["framebuffers"] = new()
        {
            // Upside down: the floor's edges at the top of the window, the bottom black (the edge kernel stays).
            ["ex-upside-down"] = c => CountInBox(c, 0.02, 0.02, 0.98, 0.3, LitAboveBlack) > 60 && CountInBox(c, 0.02, 0.8, 0.98, 0.98, LitAboveBlack) < 5,
            // The emboss kernel (its weights add up to 1): flat areas keep their colour – the background grey, the floor metal.
            ["ex-emboss"] = c => c.PixelIs(0.5, 100 / 600.0, 0.1, 0.1, 0.1) && At(c, 100, 500, p => p[0] > 0.4 && p[2] > p[0]),
            // Sepia: every grey turns brown – red above green above blue, even the background.
            ["ex-sepia"] = c => At(c, 400, 100, p => p[0] > p[1] + 0.01 && p[1] > p[2] + 0.02) && At(c, 100, 500, p => p[0] > 0.6 && p[0] > p[1] + 0.05 && p[1] > p[2] + 0.1),
            // The picture in the top right quarter only, the rest the window's white clear colour.
            ["ex-quarter"] = c => At(c, 200, 450, White) && At(c, 100, 100, White) && At(c, 193, 300, White) && At(c, 600, 150, p => !White(p)),
        },
        ["cubemaps"] = new()
        {
            // Diamond (2.42) bends the light more: other parts of the sky in the cubes.
            ["ex-diamond"] = c => c.PixelIs(193 / 800.0, 0.5, 0.553, 0.643, 0.725) && c.PixelIs(0.95, 250 / 600.0, 0.663, 0.788, 0.918),
            // Green-tinted glass: green above blue in the cubes, the sky behind them still blue.
            ["ex-tinted-glass"] = c => At(c, 193, 300, p => p[1] > p[2] && p[0] < p[2] - 0.15) && At(c, 400, 100, p => p[2] > p[0] + 0.1),
            // Half reflection, half refraction.
            ["ex-half-mirror"] = c => c.PixelIs(150 / 800.0, 250 / 600.0, 0.514, 0.604, 0.729) && c.HasInShaders(@"reflect \(") && c.HasInShaders(@"refract \("),
        },
        ["advanced-data"] = new()
        {
            // Only half the floor's bytes copied: its second triangle (the far right half) is gone, the near left half stays.
            ["ex-half-floor"] = c => At(c, 100, 500, Metal) && At(c, 600, 370, Background) && At(c, 400, 370, Background) && At(c, 193, 300, Marble),
            // The texture coordinates block first, the positions after it: the same picture, other offsets.
            ["ex-swap-blocks"] = c => Scene(c) && c.Api switch
            {
                "opengl" => c.Has(@"glVertexAttribPointer \( 0 , 3 ,[^;]*sizeof \( cubeTexCoords \)") && c.Has(@"glVertexAttribPointer \( 1 , 2 ,[^;]*\( void \* \) 0 \)"),
                "vulkan" => c.Has(@"VkDeviceSize offsets \[ \] = \{ (?!0 ,)[^,}]+ , 0 \}"),
                _ => c.Has(@"m_vertexBufferViews \[ 0 \] \. BufferLocation = m_vertexBuffer -> GetGPUVirtualAddress \( \) \+ sizeof \( cubeTexCoords \)"),
            },
        },
        ["advanced-glsl"] = new()
        {
            // A 60° field of view in the shared matrices: all four cubes smaller, the window's corners free.
            ["ex-zoom-out"] = c => At(c, 60, 30, Background) && At(c, 200, 588, Background) && At(c, 200, 150, Red) && At(c, 600, 450, p => p[2] > 0.9 && p[0] < 0.1),
            // The yellow cube darker towards the bottom of the window: 0.4 at y = 360, almost black at the bottom edge.
            ["ex-gradient"] = c => At(c, 200, 360, p => p[0] > 0.3 && p[0] < 0.5 && Math.Abs(p[0] - p[1]) < 0.03 && p[2] < 0.05) && At(c, 200, 588, p => p[0] < 0.1) && At(c, 200, 150, Red),
            // The blue cube in 20-pixel squares, blue and white.
            ["ex-checkerboard"] = c => CountInBox(c, 0.6, 0.62, 0.92, 0.97, White) > 150 && CountInBox(c, 0.6, 0.62, 0.92, 0.97, p => p[2] > 0.95 && p[0] < 0.05) > 150 && At(c, 200, 450, Yellow),
        },
    };
}
