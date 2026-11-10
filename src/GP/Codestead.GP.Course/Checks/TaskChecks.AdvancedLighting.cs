namespace Codestead.GP.Course.Checks;

// Advanced Lighting: learnopengl's wooden floor (Blinn-Phong, gamma correction) and its shadow mapping scene, at named
// points of the 800×600 window – the same pixels in every API.
public static partial class TaskChecks
{
    /// <summary>The shadow under the floating cube (650, 450): the wood almost black.</summary>
    private static bool InShadow(CheckContext c) => At(c, 650, 450, p => p[0] < 0.12 && p[0] > p[2]);

    /// <summary>The lit floor at the left (200, 450): the wood in the light.</summary>
    private static bool LitFloor(CheckContext c) => At(c, 200, 450, p => p[0] > 0.18 && p[0] > p[2] + 0.05);

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedLighting =>
    [
        ("advanced-lighting", new()
        {
            // Blinn-Phong with Phong's exponent: a wider, brighter highlight.
            ["halfway"] = c => c.Drew && c.HasInShaders("halfwayDir") && At(c, 450, 440, p => p[0] > 0.63),
            // Exponent 32: the highlight shrinks again, the floor beside it darkens.
            ["shininess"] = c => c.Drew && c.HasInShaders("halfwayDir") && At(c, 300, 540, p => p[0] < 0.33),
        }),
        ("gamma-correction", new()
        {
            // The output corrected while the texture is still read as linear: everything washed out.
            ["gamma-shader"] = c => c.Drew && c.HasInShaders(@"1\.0f? / (?:2\.2|gamma)") && At(c, 450, 560, p => p[2] > 0.2),
            ["srgb-texture"] = c => c.Drew && At(c, 450, 560, p => p[0] > 0.25 && p[0] < 0.37) && c.Api switch
            {
                "opengl" => c.Has(@"GL_SRGB"),
                "vulkan" => c.Has(@"VK_FORMAT_R8G8B8A8_SRGB"),
                _ => c.Has(@"DXGI_FORMAT_R8G8B8A8_UNORM_SRGB"),
            },
            // 1 / d²: the light falls off faster – darker between the lights, brighter close to them.
            ["quadratic"] = c => c.Drew && At(c, 450, 560, p => p[0] > 0.15 && p[0] < 0.26) && At(c, 150, 430, p => p[0] > 0.7),
        }),
        ("shadow-mapping", new()
        {
            // The window shows the depth map: grey, white far away.
            ["depth-map"] = c => c.Drew && At(c, 200, 300, p => Grey(p) && p[0] > 0.5 && p[0] < 0.8) && At(c, 400, 100, p => Grey(p) && p[0] > 0.95),
            ["shadows"] = c => c.Drew && InShadow(c) && c.HasInShaders("ShadowCalculation"),
            ["bias"] = c => c.Drew && InShadow(c) && LitFloor(c) && c.HasInShaders(@"0\.005"),
            ["over-sampling"] = c => c.Drew && InShadow(c) && LitFloor(c) && c.HasInShaders(@"\.z > 1\.0") && c.Api switch
            {
                "opengl" => c.Has(@"GL_CLAMP_TO_BORDER"),
                "vulkan" => c.Has(@"VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER"),
                _ => c.Has(@"D3D12_TEXTURE_ADDRESS_MODE_BORDER"),
            },
            ["pcf"] = c => c.Drew && InShadow(c) && LitFloor(c) && c.HasInShaders(@"textureSize \(|GetDimensions \("),
        }),
    ];
}
