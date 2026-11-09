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
        ("framebuffers", new()
        {
            // The scene goes into the off-screen target: the window shows only its (white) clear colour.
            ["offscreen-target"] = c => c.Shows && At(c, 193, 300, White) && At(c, 400, 300, White),
            ["screen-quad"] = c => c.Drew && At(c, 193, 300, Marble) && At(c, 100, 500, Metal),
            ["inversion"] = c => c.Drew && At(c, 400, 100, p => Grey(p) && p[0] > 0.8),
            ["grayscale"] = c => c.Drew && At(c, 100, 500, Grey) && At(c, 400, 100, p => p[0] < 0.15),
            ["sharpen"] = c => c.Drew && c.HasInShaders(@"-1\.0f? , 9\.0f? , -1\.0f?"),
            ["blur"] = c => c.Drew && c.HasInShaders(@"/ 16"),
            ["edge-detection"] = c => c.Drew && c.HasInShaders(@"-8\.0f?") && At(c, 400, 100, p => p[0] < 0.03 && p[1] < 0.03 && p[2] < 0.03),
        }),
        ("cubemaps", new()
        {
            ["load-cubemap"] = c => c.Drew && c.Has(@"GL_TEXTURE_CUBE_MAP_POSITIVE_X \+ i|VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT|D3D12_SRV_DIMENSION_TEXTURECUBE"),
            // The sky behind the cubes: blue at the top of the window.
            ["skybox"] = c => c.Drew && At(c, 400, 100, p => p[2] > p[0] + 0.1),
            ["skybox-last"] = c => c.Drew && At(c, 400, 100, p => p[2] > p[0] + 0.1) && c.HasInShaders(@"\.xyww") && c.Has(@"GL_LEQUAL|VK_COMPARE_OP_LESS_OR_EQUAL|D3D12_COMPARISON_FUNC_LESS_EQUAL"),
            ["reflection"] = c => c.Drew && c.HasInShaders(@"reflect \(") && At(c, 193, 300, p => p[2] > p[0]),
            ["refraction"] = c => c.Drew && c.HasInShaders(@"refract \("),
        }),
        ("advanced-data", new()
        {
            // No step changes the picture: the scene stays, the code changes.
            ["buffer-sub-data"] = c => Scene(c) && c.Has(@"glBufferSubData \( GL_ARRAY_BUFFER"),
            ["map-buffer"] = c => Scene(c) && (c.Api == "opengl" ? c.Has(@"glMapBuffer \(") : c.Has("m_floorVertexBufferView")),
            ["batched-attributes"] = c => Scene(c) && c.Api switch
            {
                "opengl" => c.Has(@"sizeof \( cubePositions \)"),
                "vulkan" => c.Has(@"getBindingDescriptions \( \)"),
                _ => c.Has(@"m_vertexBufferViews \[ 2 \]"),
            },
            ["copy-buffer"] = c => Scene(c) && c.Api switch
            {
                "opengl" => c.Has(@"glCopyBufferSubData \("),
                "vulkan" => c.Has(@"vkCmdCopyBuffer \(") && c.Has(@"VK_BUFFER_USAGE_TRANSFER_DST_BIT \| VK_BUFFER_USAGE_VERTEX_BUFFER_BIT"),
                _ => c.Has("m_floorCopyBuffer"),
            },
            ["map-memory"] = c => Scene(c) && c.Has(@"vertices \. data \( \) \+ 36"),
            ["update-buffer"] = c => Scene(c) && c.Has(@"vkCmdUpdateBuffer \("),
            ["default-heap"] = c => Scene(c) && c.Has(@"CopyBufferRegion \( m_vertexBuffer"),
        }),
        ("advanced-glsl", new()
        {
            // Left of x = 400 red, right of it green.
            ["frag-coord"] = c => c.Drew && At(c, 193, 300, p => p[0] > 0.5 && p[1] < 0.2) && At(c, 600, 450, p => p[1] > 0.5 && p[0] < 0.2),
            // Front faces culled: the cubes' insides (back faces) show the metal texture.
            ["front-facing"] = c => c.Drew && At(c, 193, 300, Metal) && c.HasInShaders(@"gl_FrontFacing|SV_IsFrontFace"),
            ["interface-block"] = c => c.Drew && At(c, 193, 300, Metal) && c.HasInShaders("VS_OUT"),
            // learnopengl's four cubes: yellow bottom-right … green top-right.
            ["uniform-buffer"] = c => c.Drew && At(c, 100, 500, p => p[0] > 0.9 && p[1] > 0.9 && p[2] < 0.1) && At(c, 470, 230, p => p[1] > 0.9 && p[0] < 0.1),
        }),
    ];

    /// <summary>The depth-testing scene, unchanged: marble cube 0 and the metal floor.</summary>
    private static bool Scene(CheckContext c) => c.Drew && At(c, 193, 300, Marble) && At(c, 100, 500, Metal);
}
