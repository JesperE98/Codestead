namespace Codestead.GP.Course.Checks;

// Advanced Lighting, round 3: learnopengl's HDR tunnel and its bloom scene – at named points of the 800×600 window, the
// same pixels in every API.
public static partial class TaskChecks
{
    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedLighting3 =>
    [
        ("hdr", new()
        {
            // The scene in a floating-point target, shown without tone mapping: no visible change, the end still white.
            ["float-buffer"] = c => c.Drew && At(c, 400, 300, p => p[2] > 0.97) && c.Api switch
            {
                "opengl" => c.Has(@"GL_RGBA16F"),
                "vulkan" => c.Has(@"VK_FORMAT_R16G16B16A16_SFLOAT"),
                _ => c.Has(@"DXGI_FORMAT_R16G16B16A16_FLOAT"),
            },
            // Reinhard: the bright end of the tunnel shows its boards (no longer white).
            ["reinhard"] = c => c.Drew && At(c, 400, 300, p => p[2] > 0.7 && p[2] < 0.82),
            // Exposure tone mapping (exposure 1.0): brighter than Reinhard, still not white.
            ["exposure"] = c => c.Drew && c.HasInShaders(@"\bexp \(") && At(c, 400, 300, p => p[2] > 0.82 && p[2] < 0.95),
        }),
        ("bloom", new()
        {
            // The second render target: only what is brighter than 1.0 – the white light cube; the box above it black.
            ["bright-pass"] = c => c.Drew && At(c, 400, 200, p => p[0] > 0.9) && At(c, 400, 60, p => p[0] < 0.05),
            // The bright parts blurred: a glow beside the white cube, the rest still black.
            ["blur"] = c => c.Drew && At(c, 465, 200, p => p[0] > 0.12) && At(c, 400, 60, p => p[0] < 0.05),
            // The scene and the blurred bright parts together: the boxes back, the lights glowing into the dark.
            ["combine"] = c => c.Drew && At(c, 400, 60, p => p[0] > 0.5) && At(c, 480, 130, p => p[0] > 0.35),
        }),
    ];
}
