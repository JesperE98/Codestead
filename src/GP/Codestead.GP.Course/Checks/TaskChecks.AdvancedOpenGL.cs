namespace Codestead.GP.Course.Checks;

// Advanced OpenGL: learnopengl's scene (two marble cubes on a metal floor, camera at (0, 0, 3)) at named points of the
// 800×600 window – the same pixels in every API – and the state calls where a step changes nothing visible.
public static partial class TaskChecks
{
    /// <summary>The metal floor: a cool grey, a little bluer than red (marble is warmer: red above blue).</summary>
    private static bool Metal(double[] p) => p[2] > p[0] + 0.02 && p[0] > 0.3;

    private static bool Marble(double[] p) => p[0] >= p[2] && p[0] > 0.4;

    private static bool Grey(double[] p) => Math.Abs(p[0] - p[1]) < 0.02 && Math.Abs(p[1] - p[2]) < 0.02;

    private static bool At(CheckContext c, int x, int y, Func<double[], bool> test) => c.Pixel(x / 800.0, y / 600.0) is { } p && test(p);

    /// <summary>The teal of learnopengl's outline, (0.04, 0.28, 0.26).</summary>
    private static bool Outline(double[] p) => Math.Abs(p[0] - 0.04) < 0.03 && Math.Abs(p[1] - 0.28) < 0.03 && Math.Abs(p[2] - 0.26) < 0.03;

    /// <summary>The cube's back face counter-clockwise: (-0.5, -0.5, -0.5) followed by (0.5, 0.5, -0.5), whatever the syntax.</summary>
    private const string CcwBackFace = @"-0\.5f?[^\w.-]+-0\.5f?[^\w.-]+-0\.5f?[^\w.-]+[01]\.0f?[^\w.-]+[01]\.0f?[^\w.-]+0\.5f?[^\w.-]+0\.5f?[^\w.-]+-0\.5f?";

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedOpenGL =>
    [
        ("depth-testing", new()
        {
            // The floor, drawn last, covers the bottom of cube 0 (193, 390).
            ["depth-always"] = c => c.Drew && At(c, 193, 390, Metal),
            ["depth-less"] = c => c.Drew && At(c, 193, 390, Marble) && At(c, 100, 500, Metal),
            ["visualize-depth"] = c => c.Drew && At(c, 193, 300, p => Grey(p) && p[0] > 0.9),
            ["linear-depth"] = c => c.Drew && At(c, 193, 300, p => Grey(p) && p[0] < 0.08) && c.HasInShaders(@"(?i)linearizeDepth|near \* far"),
        }),
        ("stencil-testing", new()
        {
            ["stencil-buffer"] = c => c.Drew && (c.Api switch
            {
                "opengl" => c.Has(@"glEnable \( GL_STENCIL_TEST \)"),
                "vulkan" => c.Has(@"stencilTestEnable = VK_TRUE"),
                _ => c.Has(@"StencilEnable = TRUE"),
            }),
            ["single-color"] = c => c.Built && c.HasInShaders(@"0\.04f? , 0\.28f? , 0\.26f?"),
            ["write-stencil"] = c => c.Drew && At(c, 193, 300, Marble) && (c.Api switch
            {
                "opengl" => c.Has(@"glStencilMask \( 0x00 \)") && c.Has(@"glStencilFunc \( GL_ALWAYS , 1 , 0xFF \)"),
                "vulkan" => c.Has(@"floorPipeline"),
                _ => c.Has(@"m_floorPipelineState"),
            }),
            ["outline"] = c => c.Drew && At(c, 82, 300, Outline) && At(c, 702, 300, Outline) && At(c, 193, 300, Marble),
        }),
        ("blending", new()
        {
            ["grass"] = c => c.Drew && c.Has(@"grass\.png") && c.Has("vegetation"),
            ["discard"] = c => c.Drew && c.HasInShaders(@"\bdiscard\b|\bclip \("),
            // A window over the background (470, 230): the red glass blended with the dark grey.
            ["blend"] = c => c.Drew && c.Has(@"window\.png") && At(c, 470, 230, p => p[0] > 0.4 && p[0] < 0.7 && p[1] < 0.2),
            ["sort"] = c => c.Drew && c.Has(@"reverse_iterator") && c.Has(@"rbegin \( \)") && At(c, 470, 230, p => p[0] > 0.4 && p[1] < 0.2),
        }),
        ("face-culling", new()
        {
            ["ccw-cube"] = c => c.Drew && c.Has(CcwBackFace),
            ["cull-back"] = c => c.Drew && At(c, 100, 500, Metal) && At(c, 193, 300, Marble) && (c.Api switch
            {
                "opengl" => c.Has(@"glEnable \( GL_CULL_FACE \)"),
                "vulkan" => c.Has(@"cullMode = VK_CULL_MODE_BACK_BIT"),
                _ => c.Has(@"CullMode = D3D12_CULL_MODE_BACK"),
            }),
            // Front faces culled: the floor (facing up at the camera) disappears, the cubes show their inside.
            ["cull-front"] = c => c.Drew && c.IsClear(100 / 800.0, 500 / 600.0) && At(c, 193, 300, Marble),
        }),
    ];
}
