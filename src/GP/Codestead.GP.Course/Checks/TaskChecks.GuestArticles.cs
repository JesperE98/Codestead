using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// Guest Articles, round 1: weighted blended OIT (the three quads), the scene graph and frustum culling (the ringed
// planets, at 2.0 s), cascaded shadow maps, OpenGL's DSA rectangle and the physically based bloom – at the named points
// of the 800×600 window each tasks.md lists, the same in every API. Tasks that change nothing visible are checked in the
// code, every API's spelling. (OIT Introduction has no tasks; DSA has tasks only in OpenGL.)
public static partial class TaskChecks
{
    // ---- Weighted blended OIT: red (opaque), green (near, half transparent) and blue (far, half transparent) quads.

    private static bool OitRed(double[] p) => p[0] > 0.9 && p[1] < 0.1 && p[2] < 0.1;

    /// <summary>A half transparent quad over black: one channel at about 128.</summary>
    private static bool Half(double[] p, int channel) => p[channel] > 0.4 && p[channel] < 0.6 && Enumerable.Range(0, 3).Where(i => i != channel).All(i => p[i] < 0.05);

    /// <summary>The ordinary blending of the start: red alone, green over the background, green over red.</summary>
    private static bool OitScene(CheckContext c) =>
        c.Drew && At(c, 620, 300, OitRed) && At(c, 200, 450, p => Half(p, 1)) && At(c, 450, 400, p => p[0] > 0.4 && p[0] < 0.6 && p[1] > 0.4 && p[1] < 0.6 && p[2] < 0.05);

    // ---- Scene graph and frustum culling: the course's planet on the clear colour 13,13,13.

    /// <summary>A planet (its texture, whatever the colour): not the clear colour (0.05, 0.05, 0.05).</summary>
    private static bool Planet(double[] p) => Math.Abs(p[0] - 0.051) > 0.04 || Math.Abs(p[1] - 0.051) > 0.04 || Math.Abs(p[2] - 0.051) > 0.04;

    private static bool Space(double[] p) => !Planet(p);

    /// <summary>The 10 × 10 grid around the root at 2.0 s (turned 40°), also its far back (far42).</summary>
    private static bool PlanetGrid(CheckContext c) =>
        At(c, 2.0, 680, 459, Planet) && At(c, 2.0, 429, 327, Planet) && At(c, 2.0, 396, 76, Planet) && At(c, 2.0, 600, 560, Space);

    /// <summary>The frustum culling demo's title: "… drawn: 37 / 101".</summary>
    private static bool DrawnInTitle(CheckContext c, int drawn) =>
        System.Text.RegularExpressions.Regex.IsMatch(c.WindowTitleAt(2.0), $@"\b{drawn}\s*/\s*101\b");

    // ---- Cascaded shadow maps: the wooden floor and the ten cubes, the light from above right in front.

    /// <summary>The lit wood (60,41,25 here): brown, red over green over blue.</summary>
    private static bool CsmWood(double[] p) => p[0] > 0.17 && p[0] < 0.35 && p[0] > p[1] + 0.04 && p[1] > p[2] + 0.03;

    /// <summary>The wood in shadow: only the ambient term (15,10,6), still brown.</summary>
    private static bool CsmShadow(double[] p) => p[0] < 0.1 && p[0] > p[1] && p[1] >= p[2];

    /// <summary>The shadows of the cubes in cascades 1 and 2, the floor lit beside them.</summary>
    private static bool CsmShadows(CheckContext c) =>
        c.Drew && At(c, 490, 475, CsmShadow) && At(c, 290, 273, CsmShadow) && At(c, 405, 221, CsmShadow) && At(c, 155, 335, CsmShadow)
        && At(c, 650, 470, CsmWood) && At(c, 200, 280, CsmWood) && At(c, 480, 230, CsmWood) && At(c, 400, 40, p => Grey(p) && p[0] > 0.07 && p[0] < 0.14);

    // ---- DSA (OpenGL): Hello Triangle's orange rectangle on teal.

    private static bool DsaRectangle(CheckContext c) => c.Drew && At(c, 400, 300, p => p[0] > 0.95 && Math.Abs(p[1] - 0.5) < 0.04 && Math.Abs(p[2] - 0.2) < 0.04) && At(c, 100, 100, Teal);

    // ---- Physically based bloom: the bloom chapter's scene (the light cubes, the boxes, the floor).

    private static bool BloomWhite(double[] p) => p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95;

    /// <summary>The scene with hard edges: the light cubes, the black background right beside them.</summary>
    private static bool BloomStart(CheckContext c) =>
        c.Drew && At(c, 400, 200, BloomWhite) && At(c, 465, 200, Black) && At(c, 400, 262, Black) && At(c, 600, 100, Black) && At(c, 400, 60, p => p[0] > 0.55 && p[0] > p[2] + 0.15);

    /// <summary>The scene with the bloom mixed in at 0.04: a soft grey glow beside the light cubes, the boxes as before.</summary>
    private static bool BloomCombined(CheckContext c) =>
        c.Drew && At(c, 400, 200, BloomWhite) && At(c, 465, 200, p => Grey(p) && p[0] > 0.3 && p[0] < 0.62) && At(c, 400, 262, p => p[0] > 0.3 && p[0] < 0.62)
        && At(c, 290, 55, p => p[1] > p[0] + 0.15 && p[1] > 0.3 && p[1] < 0.65) && At(c, 600, 100, p => p[0] < 0.15) && At(c, 400, 60, p => p[0] > 0.6 && p[0] < 0.8 && p[0] > p[2] + 0.15);

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> GuestArticles =>
    [
        ("weighted-blended", new()
        {
            // The scene drawn into an off-screen 16-bit float target and copied to the window: no visible change.
            ["opaque-pass"] = c => OitScene(c) && At(c, 230, 300, p => Half(p, 1)) && c.Api switch
            {
                Apis.OpenGL => c.Has(@"glBindFramebuffer \( GL_FRAMEBUFFER , opaqueFBO \)") && c.Has(@"\bscreenShader \. use \( \)"),
                Apis.Vulkan => c.Has(@"\bopaqueFramebuffer\b") && c.Has(@"vkCmdBindPipeline \([^;]*\bscreenPipeline\b"),
                _ => c.Has(@"SetPipelineState \( m_screenPipelineState") && c.Has(@"CreateRenderTargetView \( m_opaqueTexture"),
            },
            // The transparent quads drawn into accumulation and revealage targets nobody shows yet: only the red quad.
            ["transparent-pass"] = c => c.Drew && At(c, 620, 300, OitRed) && At(c, 450, 400, OitRed) && At(c, 400, 180, OitRed)
                && At(c, 200, 450, Black) && At(c, 250, 120, Black) && At(c, 230, 300, Black),
            // Composited: the quads back, and where green covers blue both count (0,96,96 – the blue corner shows through).
            ["composite"] = c => OitScene(c) && At(c, 250, 120, p => Half(p, 2)) && At(c, 400, 180, OitRed) && At(c, 700, 80, Black)
                && At(c, 230, 300, p => p[0] < 0.05 && p[1] > 0.3 && p[1] < 0.45 && p[2] > 0.3 && p[2] < 0.45),
        }),
        ("scene-graph", new()
        {
            // Transform and its functions; the planet drawn with a Transform's (identity) matrix: no visible change.
            ["transform"] = c => c.Drew && c.Has(@"struct Transform \{") && c.Has(@"\bgetLocalModelMatrix \(") && c.Has(@"\bcomputeModelMatrix \(")
                && At(c, 238, 320, Planet) && At(c, 427, 320, Space),
            // The chain of ten ever smaller children to the right of the root.
            ["entity"] = c => c.Drew && c.Has(@"\bupdateSelfAndChild \(") && At(c, 238, 320, Planet) && At(c, 427, 320, Planet) && At(c, 540, 320, Planet) && At(c, 456, 250, Space),
            // The dirty flag: the same picture.
            ["dirty-flag"] = c => c.Drew && c.Has(@"\bisDirty\b") && c.Has(@"\bforceUpdateSelfAndChild \(") && At(c, 427, 320, Planet) && At(c, 540, 320, Planet),
            // The root turned 20°/s, the graph updated every frame: at 2.0 s the chain points into the screen.
            ["animate"] = c => c.Shows && At(c, 2.0, 238, 320, Planet) && At(c, 2.0, 385, 273, Planet) && At(c, 2.0, 456, 250, Planet) && At(c, 2.0, 494, 238, Planet)
                && At(c, 2.0, 427, 320, Space) && At(c, 2.0, 540, 320, Space),
        }),
        ("frustum-culling", new()
        {
            // The grid of 10 × 10 planets around the root.
            ["grid"] = c => c.Shows && At(c, 2.0, 238, 320, Planet) && PlanetGrid(c),
            // Plane, Frustum and createFrustumFromCamera, not used yet.
            ["frustum"] = c => c.Shows && c.Has(@"struct Plane \{") && c.Has(@"struct Frustum \{") && c.Has(@"\bFrustum createFrustumFromCamera \(") && c.Has(@"\bgetSignedDistanceToPlane \(") && PlanetGrid(c),
            // Every entity's bounding sphere, not used yet.
            ["bounding-sphere"] = c => c.Shows && c.Has(@"struct Sphere \{") && c.Has(@"\bgenerateSphereBV \(") && c.Has(@"\bisOnFrustum \(") && PlanetGrid(c),
            // Culled against a frustum whose far plane is 15: the back of the grid gone, 8 of 101 drawn.
            ["cull"] = c => c.Shows && DrawnInTitle(c, 8) && At(c, 2.0, 680, 459, Planet) && At(c, 2.0, 429, 327, Planet)
                && At(c, 2.0, 283, 251, Space) && At(c, 2.0, 442, 208, Space) && At(c, 2.0, 396, 76, Space),
            // The projection's own frustum: the whole grid again, but only 37 of 101 drawn.
            ["camera-frustum"] = c => c.Shows && DrawnInTitle(c, 37) && PlanetGrid(c) && At(c, 2.0, 283, 251, Planet),
            // Axis-aligned boxes: the same picture, 38 of 101 drawn (the turned box is a little larger than the sphere).
            ["aabb"] = c => c.Shows && c.Has(@"struct AABB \{") && c.Has(@"\bgenerateAABB \(") && DrawnInTitle(c, 38) && PlanetGrid(c),
        }),
        ("csm", new()
        {
            // The five light-space matrices, computed every frame into the uniform buffer: no visible change yet.
            ["light-matrices"] = c => c.Drew && c.Has(@"\bshadowCascadeLevels\b") && c.Has(@"\bgetLightSpaceMatrix \(") && c.Has(@"\bgetFrustumCornersWorldSpace \(")
                && At(c, 490, 475, CsmWood) && At(c, 290, 273, CsmWood),
            // Layer 2 of the shadow maps on the screen: white where nothing is, the floor's corner grey.
            ["depth-maps"] = c => c.Drew && At(c, 490, 475, p => Grey(p) && p[0] > 0.55 && p[0] < 0.75) && At(c, 100, 560, p => Grey(p) && p[0] > 0.55 && p[0] < 0.75)
                && At(c, 650, 470, p => p[0] > 0.97 && Grey(p)) && At(c, 400, 40, p => p[0] > 0.97 && Grey(p)),
            // The scene tinted by cascade: red near the camera, green in the middle, blue at the back.
            ["cascade-layer"] = c => c.Drew && c.HasInShaders(@"\bCascadeLayer \(")
                && At(c, 100, 560, p => p[0] > p[1] + 0.03 && p[0] > p[2] + 0.03) && At(c, 490, 475, p => p[1] > p[0] + 0.05 && p[1] > p[2] + 0.05)
                && At(c, 290, 273, p => p[2] > p[1] + 0.02 && p[0] > p[1]) && At(c, 405, 221, p => p[2] > p[1] + 0.02),
            // One sample of the cascade's layer: the cubes' shadows on the floor in cascades 1 and 2.
            ["shadows"] = c => CsmShadows(c),
            // 3 × 3 PCF: soft edges, the named points as before.
            ["pcf"] = c => CsmShadows(c) && c.HasInShaders(@"textureSize \(|GetDimensions \(") && c.HasInShaders(@"/= 9\.0"),
        }),
        ("dsa", new()
        {
            // OpenGL 4.5 core: no visible change.
            ["context"] = c => DsaRectangle(c) && c.Has(@"GLFW_CONTEXT_VERSION_MAJOR , 4 \)") && c.Has(@"GLFW_CONTEXT_VERSION_MINOR , 5 \)"),
            ["vertex-buffer"] = c => DsaRectangle(c) && c.Has(@"glCreateBuffers \( 1 , & VBO \)") && c.Has(@"glNamedBufferStorage \( VBO ,"),
            ["element-buffer"] = c => DsaRectangle(c) && c.Has(@"glCreateBuffers \( 1 , & EBO \)") && c.Has(@"glNamedBufferSubData \( EBO ,"),
            ["vertex-array"] = c => DsaRectangle(c) && c.Has(@"glCreateVertexArrays \(") && c.Has(@"glVertexArrayAttribFormat \(") && c.Has(@"glVertexArrayVertexBuffer \(") && c.Has(@"glVertexArrayElementBuffer \("),
            // The container through DSA: wood in the middle, the light grey bolt at the top left, teal around it.
            ["texture"] = c => c.Drew && c.Has(@"glTextureStorage2D \(") && c.Has(@"glBindTextureUnit \(")
                && At(c, 400, 300, p => p[0] > 0.28 && p[0] < 0.45 && p[0] > p[1] + 0.08 && p[1] > p[2] + 0.08)
                && At(c, 300, 220, p => p[0] > 0.45 && p[0] < 0.65 && p[0] > p[2] + 0.2) && At(c, 218, 163, p => p[0] > 0.65 && Math.Abs(p[0] - p[1]) < 0.05)
                && At(c, 100, 100, Teal),
        }),
        ("physically-based-bloom", new()
        {
            // The bloom framebuffer and its six levels: not used yet.
            ["mip-chain"] = c => BloomStart(c) && c.Has(@"struct BloomMip \{") && c.Has(@"\bInitBloomFBO \([^;)]*\b6\b"),
            // The 100 × 75 level on the screen: the scene blurred, the light cubes smeared into their surroundings.
            ["downsample"] = c => c.Drew && At(c, 400, 200, BloomWhite) && At(c, 465, 200, p => Grey(p) && p[0] > 0.6 && p[0] < 0.97) && At(c, 400, 262, p => p[0] > 0.5 && p[0] < 0.97)
                && At(c, 290, 55, p => p[1] > 0.75 && p[0] < 0.15) && At(c, 600, 100, Black),
            // The bloom texture (level 0): everything soft and bright, the background lit too.
            ["upsample"] = c => c.Drew && At(c, 465, 200, p => p[0] > 0.95) && At(c, 400, 262, p => p[0] > 0.95) && At(c, 290, 55, p => p[1] > 0.95 && p[0] > 0.4)
                && At(c, 600, 100, p => p[0] > 0.1) && At(c, 200, 450, p => p[0] > 0.6),
            ["combine"] = c => BloomCombined(c) && c.HasInShaders(@"\bbloomStrength\b"),
            // The Karis average on the first downsample: the glow a little weaker (checked in the code).
            ["karis-average"] = c => BloomCombined(c) && c.HasInShaders(@"\bKarisAverage \(") && c.HasInShaders(@"\bmipLevel\b"),
        }),
    ];
}
