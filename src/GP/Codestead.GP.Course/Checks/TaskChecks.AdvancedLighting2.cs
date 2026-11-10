namespace Codestead.GP.Course.Checks;

// Advanced Lighting, round 2: learnopengl's room with point shadows, the normal-mapped brick wall and the
// parallax-mapped bricks – at named points of the 800×600 window, the same pixels in every API.
public static partial class TaskChecks
{
    /// <summary>The wood of the room's walls in the light: red well above blue.</summary>
    private static bool LitWood(double[] p) => p[0] > 0.35 && p[0] > p[2] + 0.1;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedLighting2 =>
    [
        ("point-shadows", new()
        {
            // The depth cube map shown in grey (distance / far plane), looked up along each fragment's direction.
            ["depth-cubemap"] = c => c.Drew && At(c, 400, 300, p => Grey(p) && p[0] > 0.1 && p[0] < 0.35) && At(c, 700, 450, p => Grey(p) && p[0] > 0.1),
            // The rotated cube's shadow on the wall at the top left; the wall in the middle still lit.
            ["shadows"] = c => c.Drew && At(c, 350, 300, LitWood) && At(c, 60, 40, p => p[0] < 0.12) && c.HasInShaders("ShadowCalculation"),
            ["pcf"] = c => c.Drew && At(c, 350, 300, LitWood) && At(c, 60, 40, p => p[0] < 0.15) && c.HasInShaders("gridSamplingDisk"),
        }),
        ("normal-mapping", new()
        {
            // The normal map's normals taken as they are: wrong on the rotated wall, the bevels facing up go dark.
            ["normal-map"] = c => c.Drew && c.HasInShaders("normalMap") && At(c, 544, 476, p => p[0] < 0.17),
            // Tangents and bitangents from the triangles' edges and UVs: no visible change yet.
            ["tangents"] = c => c.Drew && c.Has(@"\bedge1\b") && c.Has(@"deltaUV1") && At(c, 544, 476, p => p[0] < 0.17),
            ["tbn"] = c => c.Drew && c.HasInShaders("TBN") && At(c, 544, 476, p => p[0] > 0.33),
            // Gram-Schmidt: T made perpendicular to N again – no visible change.
            ["gram-schmidt"] = c => c.Drew && c.HasInShaders(@"dot \( T , N \) \* N") && At(c, 544, 476, p => p[0] > 0.33),
        }),
        ("parallax-mapping", new()
        {
            ["parallax"] = c => c.Drew && c.HasInShaders("ParallaxMapping") && At(c, 400, 300, p => p[0] > 0.6),
            // Texture coordinates pushed past the quad's edges are thrown away: ragged edges, background there.
            ["discard-edges"] = c => c.Drew && c.HasInShaders(@"\bdiscard\b|\bclip \(") && At(c, 400, 165, Background) && At(c, 400, 300, p => p[0] > 0.4),
            ["steep"] = c => c.Drew && c.HasInShaders("numLayers") && At(c, 400, 300, p => p[0] > 0.4),
            // Parallax occlusion mapping: the depths before and after the last layer interpolated.
            ["occlusion"] = c => c.Drew && c.HasInShaders(@"afterDepth|beforeDepth") && At(c, 400, 300, p => p[0] > 0.4),
        }),
    ];
}
