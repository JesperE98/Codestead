using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// Guest Articles, round 2: skeletal animation (the tentacle at 1.25 s and 0.25 s), the height map on the CPU and with
// tessellation (the terrain; the wireframes by how dense their lines are in two boxes of the full-size frame), compute
// shaders (the gradient texture) and area lights (the floor lit by LTC) – at the named points of the 800×600 window each
// tasks.md lists, the same in every API. Tasks that change nothing visible are checked by what the program prints, or in
// the code, every API's spelling.
public static partial class TaskChecks
{
    // ---- Skeletal animation: the tentacle on the clear colour 13,13,13 (the same as the planets' space).

    /// <summary>The tentacle's texture (whatever the colour): not the clear colour.</summary>
    private static bool Tentacle(double[] p) => Planet(p);

    /// <summary>A sucker or the light stripes near the foot (204,176,179 before the base turns).</summary>
    private static bool PaleFoot(double[] p) => p[0] > 0.6 && p[1] > 0.5 && p[2] > 0.5;

    /// <summary>The rest pose (the bones not used yet): a straight tentacle in the middle, the same at both times.</summary>
    private static bool RestPose(CheckContext c) =>
        c.Drew && At(c, 1.25, 400, 200, Tentacle) && At(c, 1.25, 280, 100, Space) && At(c, 1.25, 230, 100, Space) && At(c, 1.25, 568, 100, Space)
        && At(c, 1.25, 460, 300, Space) && At(c, 1.25, 400, 520, PaleFoot) && At(c, 1.25, 100, 300, Space);

    /// <summary>The animation's first pose (time 0): bent, the orange tip at the top left – at 1.25 s and 0.25 s alike.</summary>
    private static bool FirstPose(CheckContext c) =>
        c.Drew && new[] { 1.25, 0.25 }.All(t => At(c, t, 280, 100, p => p[0] > 0.6 && p[0] > p[2] + 0.2) && At(c, t, 400, 200, Space)
            && At(c, t, 230, 100, Space) && At(c, t, 568, 100, Space) && At(c, t, 460, 300, Space) && At(c, t, 400, 520, PaleFoot));

    // ---- The height map: the terrain on the clear colour 26,26,26.

    /// <summary>A grey of about <paramref name="value"/> / 255 (±<paramref name="tolerance"/> / 255).</summary>
    private static bool GreyOf(double[] p, int value, int tolerance = 10) => Grey(p) && Math.Abs(p[0] * 255 - value) <= tolerance;

    private static bool Ground(double[] p) => GreyOf(p, 26, 4);

    /// <summary>Nothing drawn: the window only cleared.</summary>
    private static bool OnlyClear(CheckContext c) =>
        c.Shows && !c.Drew && At(c, 420, 110, Ground) && At(c, 400, 300, Ground) && At(c, 600, 470, Ground);

    /// <summary>The cloud of white points: the peaks crowded, a quarter of the middle covered, nothing above or below.</summary>
    private static bool PointCloud(CheckContext c) =>
        c.Drew && At(c, 420, 110, p => p[0] > 0.97) && At(c, 400, 40, Ground) && At(c, 400, 560, Ground)
        && c.CoveredIn(150, 250, 650, 350) is > 0.15 and < 0.6;

    /// <summary>The terrain in grey (the CPU strips, or 8 × 8 tessellated patches): the valley at its real depth.</summary>
    private static bool GreyTerrain(CheckContext c) =>
        c.Drew && At(c, 420, 110, p => GreyOf(p, 212, 12)) && At(c, 230, 150, p => GreyOf(p, 142)) && At(c, 400, 300, p => GreyOf(p, 90))
        && At(c, 150, 380, p => GreyOf(p, 102)) && At(c, 380, 440, p => GreyOf(p, 88, 6)) && At(c, 580, 390, p => GreyOf(p, 28, 6))
        && At(c, 600, 470, p => GreyOf(p, 66)) && At(c, 400, 40, Ground) && At(c, 400, 560, Ground);

    /// <summary>The wireframe of the tessellated terrain: lines in the front and back boxes of the full-size frame.</summary>
    private static bool Wireframe(CheckContext c, double backMin, double backMax) =>
        c.Drew && At(c, 400, 40, Ground) && At(c, 400, 560, Ground)
        && c.CoveredIn(300, 400, 499, 449, fullSize: true) is > 0.6 and < 0.9
        && c.CoveredIn(250, 150, 449, 199, fullSize: true) is var back && back > backMin && back < backMax;

    // ---- Compute shaders: the 800 × 600 texture over the whole window (red across, green up, blue 0).

    private static bool Rg(double[] p, double r, double g) => Math.Abs(p[0] - r) < 0.03 && Math.Abs(p[1] - g) < 0.03 && p[2] < 0.03;

    private static bool DarkBlue(CheckContext c) =>
        c.Drew && new[] { (0, 0), (400, 300), (799, 599) }.All(q => At(c, q.Item1, q.Item2, p => p[0] < 0.03 && p[1] < 0.03 && Math.Abs(p[2] - 0.5) < 0.03));

    private static bool Limits(CheckContext c) =>
        c.Printed(@"maximum number of (work|thread) groups in X\b.*\b65535\b") && c.Printed(@"maximum size of a (work|thread) group in X dimension 1024\b")
        && c.Printed(@"Number of (invocations|threads) in a single .*\b1024\b");

    // ---- Area lights: the floor (wood) and the light's BurlyWood rectangle on black.

    private static bool BurlyWood(double[] p) => Math.Abs(p[0] - 0.871) < 0.03 && Math.Abs(p[1] - 0.722) < 0.03 && Math.Abs(p[2] - 0.529) < 0.03;

    /// <summary>One light over the black floor (its shader writes black until the diffuse term).</summary>
    private static bool DarkFloor(CheckContext c) =>
        c.Drew && At(c, 400, 263, BurlyWood) && At(c, 400, 380, Black) && At(c, 400, 420, Black) && At(c, 400, 560, Black) && At(c, 400, 100, Black);

    /// <summary>Warm wood: red over green over blue.</summary>
    private static bool Warm(double[] p) => p[0] > p[1] + 0.03 && p[1] > p[2] + 0.02;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> GuestArticles2 =>
    [
        ("skeletal-animation", new()
        {
            // The bone ids and weights in the vertices: no visible change.
            ["bone-weights"] = c => RestPose(c) && c.Has(@"\bm_BoneIDs \[") && c.Has(@"\bm_Weights \[") && c.Has(@"\bExtractBoneWeightForVertices \(") && c.Has(@"\bSetVertexBoneData \("),
            // The keyframes and their interpolation, not called yet.
            ["bone"] = c => RestPose(c) && c.Has(@"\bCreateBone \(") && c.Has(@"\bUpdateBone \(") && c.Has(@"\bInterpolateRotation \(") && c.Has(@"glm :: slerp \(|XMQuaternionSlerp \("),
            // The animation loaded (node tree, bones), not played.
            ["animation"] = c => RestPose(c) && c.Has(@"\bReadHierarchyData \(") && c.Has(@"\bReadMissingBones \(") && c.Has(@"\bFindBone \(") && c.Has(@"\bLoadAnimation \( \w*[sS]wayAnimation ,"),
            // The animator's 100 matrices at time 0, not used by the shader yet.
            ["animator"] = c => RestPose(c) && c.Has(@"\bInitAnimator \( \w*animator ,") && c.Has(@"\bCalculateBoneTransform \(") && c.Has(@"\bUpdateAnimation \( \w*animator , 0\.0f? \)"),
            // Skinned: the animation's first pose, standing still.
            ["skinning"] = FirstPose,
            // Played: leaning right at 1.25 s, left at 0.25 s.
            ["play"] = c => c.Drew && At(c, 1.25, 568, 100, Tentacle) && At(c, 1.25, 460, 300, Tentacle) && At(c, 1.25, 400, 520, Tentacle)
                && At(c, 1.25, 280, 100, Space) && At(c, 1.25, 230, 100, Space) && At(c, 1.25, 400, 200, Space)
                && At(c, 0.25, 230, 100, Tentacle) && At(c, 0.25, 568, 100, Space) && At(c, 0.25, 280, 100, Space) && At(c, 0.25, 460, 300, Space) && At(c, 0.25, 400, 200, Space),
        }),
        ("tessellation-height-map", new()
        {
            // Loaded, nothing drawn yet. (Vulkan and Direct3D 12 programs that draw nothing are not run by the simulator,
            // so there their print is found in the code.)
            ["load-heightmap"] = c => OnlyClear(c) && c.Has(@"\bstbi_load \(")
                && (c.Printed(@"Loaded heightmap of size 256 x 256") || c.Api != Apis.OpenGL && c.Has(@"Loaded heightmap of size")),
            ["vertices"] = PointCloud,
            // The strips' indices made and counted; still points.
            ["indices"] = c => PointCloud(c) && c.Printed(@"Created lattice of 255 strips with 510 triangles each"),
            // Solid white strips.
            ["strips"] = c => c.Drew && new[] { (420, 110), (230, 150), (400, 300), (150, 380), (380, 440), (580, 390), (600, 470) }.All(q => At(c, q.Item1, q.Item2, p => GreyOf(p, 255, 6)))
                && At(c, 400, 40, Ground) && At(c, 400, 560, Ground),
            ["height-colour"] = GreyTerrain,
        }),
        ("tessellation", new()
        {
            // The highest tessellation level printed; the CPU terrain as before.
            ["opengl-4-1"] = c => GreyTerrain(c) && c.Printed(@"Max available tess level: 64") && c.Has(@"GLFW_CONTEXT_VERSION_MAJOR , 4 \)") && c.Has(@"GLFW_CONTEXT_VERSION_MINOR , 1 \)"),
            ["tessellation-feature"] = c => GreyTerrain(c) && c.Printed(@"Max available tess level: 64") && c.Has(@"tessellationShader = VK_TRUE"),
            ["max-tess-level"] = c => GreyTerrain(c) && c.Printed(@"Max available tess level: 64"),
            // The height map as a texture; the CPU terrain gone: only the clear colour.
            ["height-texture"] = c => OnlyClear(c) && c.Api switch
            {
                Apis.OpenGL => c.Has(@"glTexImage2D \([^;]*\bGL_R8\b"),
                Apis.Vulkan => c.Has(@"\bheightMapImage\b") && c.Has(@"VK_FORMAT_R8_UNORM"),
                _ => c.Has(@"\bm_heightMap\b") && c.Has(@"DXGI_FORMAT_R8_UNORM"),
            },
            // The 20 × 20 patches of 4 control points; still nothing drawn. (As in the height map chapter: Vulkan and
            // Direct3D 12 programs that draw nothing are not run, so there the grid is found in the code.)
            ["patch-grid"] = c => OnlyClear(c) && c.Has(@"\bNUM_PATCH_PTS = 4\b") && c.Has(@"\brez = 20\b")
                && (c.Printed(@"Loaded 400 patches of 4 control points each") || c.Api != Apis.OpenGL),
            // Every patch one flat quad (levels 1): the valley shallow.
            ["tess-evaluation"] = c => c.Drew && At(c, 420, 110, p => GreyOf(p, 212, 12)) && At(c, 230, 150, p => GreyOf(p, 142)) && At(c, 400, 300, p => GreyOf(p, 87, 8))
                && At(c, 380, 440, p => GreyOf(p, 75, 6)) && At(c, 580, 390, p => GreyOf(p, 28, 6)) && At(c, 400, 40, Ground) && At(c, 400, 560, Ground),
            // Levels 8: the full terrain again.
            ["tess-control"] = GreyTerrain,
            // Lines: dense everywhere, densest at the back.
            ["wireframe"] = c => Wireframe(c, 0.75, 0.96),
            // Distance-based levels: the back opens up.
            ["distance-levels"] = c => Wireframe(c, 0.3, 0.65),
        }),
        ("compute-shaders", new()
        {
            // The limits printed (llvmpipe's / lavapipe's numbers, Direct3D 12's constants): no visible change.
            ["limits"] = c => DarkBlue(c) && Limits(c),
            ["image-unit"] = c => DarkBlue(c) && Limits(c) && c.Api switch
            {
                Apis.D3D12 => c.Has(@"D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS") && c.Has(@"CreateUnorderedAccessView \("),
                _ => c.Has(@"glBindImageTexture \( 0 , texture , 0 , GL_FALSE , 0 , GL_READ_WRITE , GL_RGBA32F \)"),
            },
            ["storage-image"] = c => DarkBlue(c) && Limits(c) && c.Has(@"VK_DESCRIPTOR_TYPE_STORAGE_IMAGE") && c.Has(@"VK_IMAGE_USAGE_STORAGE_BIT") && c.Has(@"\bcreateComputeDescriptorSet \( \)"),
            // The gradient: red across, green up.
            ["compute-shader"] = c => c.Drew && At(c, 0, 0, p => Rg(p, 0, 1)) && At(c, 100, 300, p => Rg(p, 0.13, 0.5)) && At(c, 400, 300, p => Rg(p, 0.5, 0.5))
                && At(c, 699, 300, p => Rg(p, 0.87, 0.5)) && At(c, 799, 599, p => Rg(p, 1, 0)) && At(c, 400, 0, p => Rg(p, 0.5, 1)) && At(c, 400, 599, p => Rg(p, 0.5, 0)),
            // At 1.0 s moved right by 100 texels: the brightest red at x = 699, from 0 again at x = 700.
            ["time"] = c => c.Drew && At(c, 0, 0, p => Rg(p, 0.13, 1)) && At(c, 100, 300, p => Rg(p, 0.25, 0.5)) && At(c, 400, 300, p => Rg(p, 0.625, 0.5))
                && At(c, 699, 300, p => Rg(p, 1, 0.5)) && At(c, 700, 300, p => Rg(p, 0, 0.5)) && At(c, 799, 599, p => Rg(p, 0.125, 0)),
        }),
        ("area-lights", new()
        {
            // The LTC tables as float textures: no visible change.
            ["ltc-textures"] = c => DarkFloor(c) && c.Has(@"#include ""ltc_matrix\.hpp""") && c.Api switch
            {
                Apis.OpenGL => c.Has(@"\bloadMTexture \( \)") && c.Has(@"\bloadLUTTexture \( \)") && c.Has(@"GL_RGBA32F"),
                Apis.Vulkan => c.Has(@"\bloadMTexture \(") && c.Has(@"\bloadLUTTexture \(") && c.Has(@"\bcreateLTCSampler \("),
                _ => c.Has(@"\bLoadLTCTexture \( LTC1 ,") && c.Has(@"\bLoadLTCTexture \( LTC2 ,"),
            },
            // The diffuse term: the floor warm, brightest in front of the light, dark near the camera.
            ["diffuse"] = c => c.Drew && At(c, 400, 263, BurlyWood) && At(c, 400, 380, p => Warm(p) && p[0] > 0.45 && p[0] < 0.68)
                && At(c, 400, 420, p => Warm(p) && p[0] > 0.28 && p[0] < 0.45) && At(c, 400, 560, p => Warm(p) && p[0] > 0.1 && p[0] < 0.22) && At(c, 400, 100, Black),
            // The specular term: a whitish reflection between the light and the camera.
            ["specular"] = c => c.Drew && At(c, 400, 263, BurlyWood) && At(c, 400, 380, p => Warm(p) && p[0] > 0.45 && p[0] < 0.68)
                && At(c, 400, 420, p => p[0] > 0.58 && p[0] < 0.75 && p[1] > p[0] * 0.75 && p[2] > p[0] * 0.6) && At(c, 400, 560, p => p[0] > 0.25 && p[0] < 0.4 && p[1] > p[0] * 0.75)
                && At(c, 400, 100, Black),
            // The ring of eight coloured lights seen from above.
            ["multiple-lights"] = c => c.Drew && At(c, 400, 90, p => p[1] > 0.95 && p[0] > 0.45 && p[0] < 0.65 && p[2] < 0.45)
                && At(c, 395, 360, p => p[2] > 0.95 && p[0] > 0.7 && p[0] < 0.9 && p[1] < 0.5) && At(c, 680, 190, p => p[0] > 0.95 && p[1] > 0.45 && p[1] < 0.65 && p[2] < 0.35)
                && At(c, 118, 190, p => p[2] > 0.95 && p[1] > 0.65 && p[1] < 0.85 && p[0] < 0.4) && At(c, 400, 550, Black) && At(c, 400, 20, Black)
                && At(c, 470, 260, p => Warm(p) && p[0] < 0.3) && At(c, 400, 450, p => p[0] > 0.35 && p[0] < 0.6 && p[2] > p[1]),
        }),
    ];
}
