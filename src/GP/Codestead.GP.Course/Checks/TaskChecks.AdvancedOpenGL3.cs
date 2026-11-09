namespace Codestead.GP.Course.Checks;

// Advanced OpenGL, round 3: geometry shaders (learnopengl's houses, the exploding planet, its normals), instancing (the
// quads, the asteroid field) and anti-aliasing (the green cube's edges) – the same pixels in every API.
public static partial class TaskChecks
{
    /// <summary>The background, clear (0.1, 0.1, 0.1).</summary>
    private static bool Background(double[] p) => Math.Abs(p[0] - 0.1) < 0.03 && Math.Abs(p[1] - 0.1) < 0.03 && Math.Abs(p[2] - 0.1) < 0.03;

    private static bool Red(double[] p) => p[0] > 0.8 && p[1] < 0.2 && p[2] < 0.2;

    private static bool Yellow(double[] p) => p[0] > 0.8 && p[1] > 0.8 && p[2] < 0.2;

    /// <summary>The planet's continents: green above red and blue.</summary>
    private static bool Land(double[] p) => p[1] > p[0] + 0.05 && p[1] > p[2] + 0.05;

    /// <summary>The rock: grey, a little warm (not the background's dark grey).</summary>
    private static bool Rock(double[] p) => p[0] > 0.35 && Math.Abs(p[0] - p[1]) < 0.05 && Math.Abs(p[1] - p[2]) < 0.05;

    /// <summary>The geometry stage is part of the program: a geometry shader created and used.</summary>
    private static bool UsesGeometryShader(CheckContext c) => c.Api switch
    {
        "opengl" => c.Has(@"GL_GEOMETRY_SHADER|\.gs"""),
        "vulkan" => c.Has(@"VK_SHADER_STAGE_GEOMETRY_BIT") && c.Has(@"geometryShader = VK_TRUE"),
        _ => c.Has(@"gs_5_0") && c.Has(@"\.GS = "),
    } && c.HasInShaders(@"EmitVertex|\.Append \(");

    /// <summary>
    /// The edge pixels of the green cube (or its grey picture): neither the background nor pure green / pure grey –
    /// with 4 samples per pixel a few hundred at 800 × 600, a few dozen in the small check frame.
    /// </summary>
    private static int MixedEdges(CheckContext c) => c.CountPixels(p => !Background(p) && !(p[0] < 0.05 && p[1] > 0.95 && p[2] < 0.05)
        && !(Math.Abs(p[0] - 0.714) < 0.02 && Math.Abs(p[1] - 0.714) < 0.02 && Math.Abs(p[2] - 0.714) < 0.02));

    private static bool Smooth(CheckContext c) => c.Drew && MixedEdges(c) > 30;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedOpenGL3 =>
    [
        ("geometry-shader", new()
        {
            ["pass-through"] = c => c.Shows && UsesGeometryShader(c),
            // The red house around the point (-0.5, 0.5), its roof up to y = 0.9.
            ["houses"] = c => c.Drew && UsesGeometryShader(c) && At(c, 170, 170, Red) && At(c, 230, 170, Red) && At(c, 200, 40, Red),
            ["roof-white"] = c => c.Drew && At(c, 170, 170, Red) && At(c, 200, 38, p => p[0] > 0.9 && p[1] > 0.6 && p[2] > 0.6),
            ["planet"] = c => c.Drew && At(c, 400, 300, Land) && At(c, 300, 300, Land) && At(c, 170, 170, Background),
            // At t = 1 s the triangles are 1.84 units out: the planet's middle is empty.
            ["explode"] = c => c.Drew && At(c, 400, 300, Background) && c.HasInShaders(@"sin \( (?:\w+\.)?time \)"),
            ["normals"] = c => c.Drew && At(c, 400, 300, Land) && c.CountPixels(Yellow) > 20,
        }),
        ("instancing", new()
        {
            // 100 quads: the corners of the grid, none in the middle any more.
            ["offsets"] = c => c.Drew && At(c, 40, 30, p => !Background(p)) && At(c, 760, 570, p => !Background(p)) && At(c, 400, 300, Background),
            ["instanced-array"] = c => c.Drew && At(c, 40, 30, p => !Background(p)) && At(c, 760, 570, p => !Background(p)) && c.Api switch
            {
                "opengl" => c.Has(@"glVertexAttribDivisor \( 2 , 1 \)"),
                "vulkan" => c.Has(@"VK_VERTEX_INPUT_RATE_INSTANCE"),
                _ => c.Has(@"D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA"),
            },
            // Instance 0 (bottom left) scaled to nothing, instance 99 (top right) full size.
            ["scale-quads"] = c => c.Drew && At(c, 40, 570, Background) && At(c, 760, 30, p => !Background(p)),
            ["planet"] = c => c.Drew && At(c, 420, 300, Land) && At(c, 40, 30, Background),
            ["asteroids"] = c => c.Drew && At(c, 420, 300, Land) && c.CountPixels(Rock) > 40,
        }),
        ("anti-aliasing", new()
        {
            // Vulkan: how many samples the device can do – code only.
            ["sample-count"] = c => c.Drew && c.Has(@"getMaxUsableSampleCount \( \)") && c.Has(@"msaaSamples"),
            ["msaa"] = c => Smooth(c) && At(c, 400, 300, p => p[1] > 0.95 && p[0] < 0.05) && c.Api switch
            {
                "opengl" => c.Has(@"glfwWindowHint \( GLFW_SAMPLES , 4 \)"),
                "vulkan" => c.Has(@"rasterizationSamples = msaaSamples") && c.Has(@"pResolveAttachments"),
                _ => c.Has(@"SampleDesc\.Count = (?:4|SampleCount)") && c.Has(@"ResolveSubresource \("),
            },
            ["offscreen-msaa"] = c => Smooth(c) && c.Has(@"glTexImage2DMultisample \(") && c.Has(@"glRenderbufferStorageMultisample \("),
            ["resolve"] = c => Smooth(c) && At(c, 400, 300, p => p[1] > 0.95 && p[0] < 0.05) && c.Api switch
            {
                "opengl" => c.Has(@"glBlitFramebuffer \(") && c.Has("intermediateFBO"),
                "vulkan" => c.Has(@"createOffscreenRenderPass \( \)") && c.HasInShaders("screenTexture"),
                _ => c.Has(@"ResolveSubresource \( m_screenTexture"),
            },
            // learnopengl's grayscale: the green 0.7152 grey, the edges still smooth.
            ["post-process"] = c => Smooth(c) && At(c, 400, 300, p => Grey(p) && Math.Abs(p[0] - 0.714) < 0.03),
        }),
    ];
}
