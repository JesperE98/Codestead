namespace Codestead.GP.Course.Checks;

// PBR: learnopengl's 7 × 7 spheres (rows metallic, columns roughness) lit by four lights, then by the environment
// (diffuse irradiance, specular IBL), and the course's riveted steel material – at named points of the 800×600 window,
// the same pixels in every API (see projects/opengl/<chapter>/tasks.md for the values measured there).
public static partial class TaskChecks
{
    /// <summary>A grey, unlit-by-colour pixel of the steel: bright, red ≈ blue.</summary>
    private static bool Steel(double[] p) => p[0] > 0.65 && Math.Abs(p[0] - p[2]) < 0.07;

    /// <summary>Rust: orange-brown, red well above blue.</summary>
    private static bool Rust(double[] p, double min, double max) => p[0] > min && p[0] < max && p[0] > p[2] + 0.15;

    /// <summary>The environment's sky: blue above red.</summary>
    private static bool Sky(double[] p) => p[2] > 0.65 && p[2] > p[0] + 0.03;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> Pbr =>
    [
        ("pbr-lighting", new()
        {
            // Lambert only: matt red spheres, all alike, brighter towards the grid's corners.
            ["lambert"] = c => c.Drew && At(c, 400, 300, p => p[0] > 0.3 && p[0] < 0.46 && p[1] < 0.05) && At(c, 153, 547, p => p[0] > 0.47 && p[0] < 0.63 && p[1] < 0.05),
            // The NDF alone as the specular term: the roughest spheres turn white, the smooth ones keep their red centre.
            ["ndf"] = c => c.Drew && At(c, 647, 547, p => p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95) && At(c, 153, 547, p => p[0] > 0.47 && p[1] < 0.05),
            // NDF · G / (4 NdotV NdotL): the rough spheres pink instead of white.
            ["geometry"] = c => c.Drew && At(c, 647, 547, p => p[0] > 0.95 && p[1] > 0.3 && p[1] < 0.63),
            // The whole reflectance equation: the metal rows lose their diffuse light (the top left sphere dark).
            ["fresnel"] = c => c.Drew && At(c, 153, 53, p => p[0] < 0.12) && At(c, 153, 547, p => p[0] > 0.45 && p[1] < 0.05),
            // Reinhard and gamma: brighter, softer spheres.
            ["tone-map"] = c => c.Drew && At(c, 153, 53, p => p[0] > 0.2 && p[0] < 0.34) && At(c, 153, 547, p => p[0] > 0.55 && p[0] < 0.7),
            // The material from the maps: grey steel and orange rust on the centre sphere, the clear colour around.
            ["textured"] = c => c.Drew && c.HasInShaders("albedoMap") && At(c, 377, 327, Steel) && At(c, 450, 330, p => Rust(p, 0.33, 0.56)) && At(c, 20, 20, p => p[0] < 0.15),
        }),
        ("diffuse-irradiance", new()
        {
            // The environment cube map as the background: sky above, ground below; the spheres unchanged.
            ["environment-map"] = c => c.Drew && At(c, 60, 60, Sky) && At(c, 60, 500, p => p[0] > 0.33 && p[0] < 0.5 && p[0] > p[2]) && At(c, 400, 300, p => p[0] > 0.4 && p[0] < 0.5),
            // The irradiance map as the background: a soft pale blur, the dark hills gone.
            ["irradiance-map"] = c => c.Drew && At(c, 60, 270, p => p[0] > 0.55 && p[1] > 0.55) && At(c, 60, 500, p => p[0] > 0.52),
            // The ambient light from the irradiance map: the non-metal spheres brighter; the sharp environment behind.
            ["ambient"] = c => c.Drew && At(c, 60, 270, p => p[0] < 0.32 && p[1] > p[0]) && At(c, 153, 547, p => p[0] > 0.69 && p[1] < 0.05),
        }),
        ("specular-ibl", new()
        {
            // The pre-filtered map at mip level 1.2 as the background: blurred, the orange lamp's glow at the bottom left.
            ["prefilter-map"] = c => c.Drew && At(c, 20, 560, p => p[0] > 0.72 && p[0] > p[2] + 0.1) && At(c, 60, 270, p => p[0] > 0.55),
            // The BRDF look-up texture on the screen: red at the bottom right, green at the bottom left, no blue.
            ["brdf-lut"] = c => c.Drew && At(c, 760, 570, p => p[0] > 0.93 && p[1] < 0.05 && p[2] < 0.05) && At(c, 30, 580, p => p[1] > 0.7 && p[2] < 0.05) && At(c, 760, 30, p => p[0] > 0.28 && p[0] < 0.46),
            // The split sum: the spheres reflect the environment (green and blue on the smooth ones), the sky behind them.
            ["specular"] = c => c.Drew && At(c, 153, 547, p => p[1] > 0.15 && p[2] > 0.15) && At(c, 60, 60, Sky),
            // The material from the maps, lit by the environment: steel and rust in front of the sky.
            ["textured"] = c => c.Drew && c.HasInShaders("albedoMap") && At(c, 377, 327, Steel) && At(c, 450, 330, p => Rust(p, 0.46, 0.7)) && At(c, 20, 20, Sky),
        }),
    ];
}
