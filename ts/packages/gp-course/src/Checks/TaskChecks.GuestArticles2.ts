import { Apis } from "@codestead/gp-gpu";
import { between, type CheckContext, type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";
import { planet, space } from "./TaskChecks.GuestArticles.js";
import { black } from "./TaskChecks.InPractice.js";

// Guest Articles, round 2: skeletal animation (the tentacle at 1.25 s and 0.25 s), the height map on the CPU and with
// tessellation (the terrain; the wireframes by how dense their lines are in two boxes of the full-size frame), compute
// shaders (the gradient texture) and area lights (the floor lit by LTC) – at the named points of the 800×600 window each
// tasks.md lists, the same in every API. Tasks that change nothing visible are checked by what the program prints, or in
// the code, every API's spelling.
// ---- Skeletal animation: the tentacle on the clear colour 13,13,13 (the same as the planets' space).

/** The tentacle's texture (whatever the colour): not the clear colour. */

export function tentacle(p: Rgba): boolean {
  return planet(p);
}

/** A sucker or the light stripes near the foot (204,176,179 before the base turns). */

export function paleFoot(p: Rgba): boolean {
  return p[0] > 0.6 && p[1] > 0.5 && p[2] > 0.5;
}

/** The rest pose (the bones not used yet): a straight tentacle in the middle, the same at both times. */

export function restPose(c: CheckContext): boolean {
  return c.drew && at(c, 1.25, 400, 200, tentacle) && at(c, 1.25, 280, 100, space) && at(c, 1.25, 230, 100, space) && at(c, 1.25, 568, 100, space)
    && at(c, 1.25, 460, 300, space) && at(c, 1.25, 400, 520, paleFoot) && at(c, 1.25, 100, 300, space);
}

/** The animation's first pose (time 0): bent, the orange tip at the top left – at 1.25 s and 0.25 s alike. */

export function firstPose(c: CheckContext): boolean {
  return c.drew && [1.25, 0.25].every((t) => at(c, t, 280, 100, p => p[0] > 0.6 && p[0] > p[2] + 0.2) && at(c, t, 400, 200, space)
        && at(c, t, 230, 100, space) && at(c, t, 568, 100, space) && at(c, t, 460, 300, space) && at(c, t, 400, 520, paleFoot));
}
// ---- The height map: the terrain on the clear colour 26,26,26.

/** A grey of about `value` / 255 (±`tolerance` / 255). */

export function greyOf(p: Rgba, value: number, tolerance = 10): boolean {
  return grey(p) && Math.abs(p[0] * 255 - value) <= tolerance;
}

export function ground(p: Rgba): boolean {
  return greyOf(p, 26, 4);
}

/** Nothing drawn: the window only cleared. */

export function onlyClear(c: CheckContext): boolean {
  return c.shows && !c.drew && at(c, 420, 110, ground) && at(c, 400, 300, ground) && at(c, 600, 470, ground);
}

/** The cloud of white points: the peaks crowded, a quarter of the middle covered, nothing above or below. */

export function pointCloud(c: CheckContext): boolean {
  return c.drew && at(c, 420, 110, p => p[0] > 0.97) && at(c, 400, 40, ground) && at(c, 400, 560, ground)
    && between(c.coveredIn(150, 250, 650, 350), 0.15, 0.6);
}

/** The terrain in grey (the CPU strips, or 8 × 8 tessellated patches): the valley at its real depth. */

export function greyTerrain(c: CheckContext): boolean {
  return c.drew && at(c, 420, 110, p => greyOf(p, 212, 12)) && at(c, 230, 150, p => greyOf(p, 142)) && at(c, 400, 300, p => greyOf(p, 90))
    && at(c, 150, 380, p => greyOf(p, 102)) && at(c, 380, 440, p => greyOf(p, 88, 6)) && at(c, 580, 390, p => greyOf(p, 28, 6))
    && at(c, 600, 470, p => greyOf(p, 66)) && at(c, 400, 40, ground) && at(c, 400, 560, ground);
}

/** The wireframe of the tessellated terrain: lines in the front and back boxes of the full-size frame. */

export function wireframe(c: CheckContext, backMin: number, backMax: number): boolean {
  return c.drew && at(c, 400, 40, ground) && at(c, 400, 560, ground)
    && between(c.coveredIn(300, 400, 499, 449, /* fullSize: */ true), 0.6, 0.9)
    && ((back) => back > backMin && back < backMax)(c.coveredIn(250, 150, 449, 199, /* fullSize: */ true));
}
// ---- Compute shaders: the 800 × 600 texture over the whole window (red across, green up, blue 0).

export function rg(p: Rgba, r: number, g: number): boolean {
  return Math.abs(p[0] - r) < 0.03 && Math.abs(p[1] - g) < 0.03 && p[2] < 0.03;
}

export function darkBlue(c: CheckContext): boolean {
  return c.drew && [[0, 0], [400, 300], [799, 599]].every(([x, y]) => at(c, x!, y!, p => p[0] < 0.03 && p[1] < 0.03 && Math.abs(p[2] - 0.5) < 0.03));
}

export function limits(c: CheckContext): boolean {
  return c.printed("maximum number of (work|thread) groups in X\\b.*\\b65535\\b") && c.printed("maximum size of a (work|thread) group in X dimension 1024\\b")
    && c.printed("Number of (invocations|threads) in a single .*\\b1024\\b");
}
// ---- Area lights: the floor (wood) and the light's BurlyWood rectangle on black.

export function burlyWood(p: Rgba): boolean {
  return Math.abs(p[0] - 0.871) < 0.03 && Math.abs(p[1] - 0.722) < 0.03 && Math.abs(p[2] - 0.529) < 0.03;
}

/** One light over the black floor (its shader writes black until the diffuse term). */

export function darkFloor(c: CheckContext): boolean {
  return c.drew && at(c, 400, 263, burlyWood) && at(c, 400, 380, black) && at(c, 400, 420, black) && at(c, 400, 560, black) && at(c, 400, 100, black);
}

/** Warm wood: red over green over blue. */

export function warm(p: Rgba): boolean {
  return p[0] > p[1] + 0.03 && p[1] > p[2] + 0.02;
}

export function guestArticles2(): ChapterChecks {
  return [
    ["skeletal-animation", {
        // The bone ids and weights in the vertices: no visible change.
        "bone-weights": c => restPose(c) && c.has("\\bm_BoneIDs \\[") && c.has("\\bm_Weights \\[") && c.has("\\bExtractBoneWeightForVertices \\(") && c.has("\\bSetVertexBoneData \\("),
        // The keyframes and their interpolation, not called yet.
        "bone": c => restPose(c) && c.has("\\bCreateBone \\(") && c.has("\\bUpdateBone \\(") && c.has("\\bInterpolateRotation \\(") && c.has("glm :: slerp \\(|XMQuaternionSlerp \\("),
        // The animation loaded (node tree, bones), not played.
        "animation": c => restPose(c) && c.has("\\bReadHierarchyData \\(") && c.has("\\bReadMissingBones \\(") && c.has("\\bFindBone \\(") && c.has("\\bLoadAnimation \\( \\w*[sS]wayAnimation ,"),
        // The animator's 100 matrices at time 0, not used by the shader yet.
        "animator": c => restPose(c) && c.has("\\bInitAnimator \\( \\w*animator ,") && c.has("\\bCalculateBoneTransform \\(") && c.has("\\bUpdateAnimation \\( \\w*animator , 0\\.0f? \\)"),
        // Skinned: the animation's first pose, standing still.
        "skinning": firstPose,
        // Played: leaning right at 1.25 s, left at 0.25 s.
        "play": c => c.drew && at(c, 1.25, 568, 100, tentacle) && at(c, 1.25, 460, 300, tentacle) && at(c, 1.25, 400, 520, tentacle)
            && at(c, 1.25, 280, 100, space) && at(c, 1.25, 230, 100, space) && at(c, 1.25, 400, 200, space)
            && at(c, 0.25, 230, 100, tentacle) && at(c, 0.25, 568, 100, space) && at(c, 0.25, 280, 100, space) && at(c, 0.25, 460, 300, space) && at(c, 0.25, 400, 200, space),
    }],
    ["tessellation-height-map", {
        // Loaded, nothing drawn yet. (Vulkan and Direct3D 12 programs that draw nothing are not run by the simulator,
        // so there their print is found in the code.)
        "load-heightmap": c => onlyClear(c) && c.has("\\bstbi_load \\(")
            && (c.printed("Loaded heightmap of size 256 x 256") || c.api !== Apis.OpenGL && c.has("Loaded heightmap of size")),
        "vertices": pointCloud,
        // The strips' indices made and counted; still points.
        "indices": c => pointCloud(c) && c.printed("Created lattice of 255 strips with 510 triangles each"),
        // Solid white strips.
        "strips": c => c.drew && [[420, 110], [230, 150], [400, 300], [150, 380], [380, 440], [580, 390], [600, 470]].every(([x, y]) => at(c, x!, y!, p => greyOf(p, 255, 6)))
            && at(c, 400, 40, ground) && at(c, 400, 560, ground),
        "height-colour": greyTerrain,
    }],
    ["tessellation", {
        // The highest tessellation level printed; the CPU terrain as before.
        "opengl-4-1": c => greyTerrain(c) && c.printed("Max available tess level: 64") && c.has("GLFW_CONTEXT_VERSION_MAJOR , 4 \\)") && c.has("GLFW_CONTEXT_VERSION_MINOR , 1 \\)"),
        "tessellation-feature": c => greyTerrain(c) && c.printed("Max available tess level: 64") && c.has("tessellationShader = VK_TRUE"),
        "max-tess-level": c => greyTerrain(c) && c.printed("Max available tess level: 64"),
        // The height map as a texture; the CPU terrain gone: only the clear colour.
        "height-texture": c => onlyClear(c) && (c.api === Apis.OpenGL ? c.has("glTexImage2D \\([^;]*\\bGL_R8\\b") : c.api === Apis.Vulkan ? c.has("\\bheightMapImage\\b") && c.has("VK_FORMAT_R8_UNORM") : c.has("\\bm_heightMap\\b") && c.has("DXGI_FORMAT_R8_UNORM")),
        // The 20 × 20 patches of 4 control points; still nothing drawn. (As in the height map chapter: Vulkan and
        // Direct3D 12 programs that draw nothing are not run, so there the grid is found in the code.)
        "patch-grid": c => onlyClear(c) && c.has("\\bNUM_PATCH_PTS = 4\\b") && c.has("\\brez = 20\\b")
            && (c.printed("Loaded 400 patches of 4 control points each") || c.api !== Apis.OpenGL),
        // Every patch one flat quad (levels 1): the valley shallow.
        "tess-evaluation": c => c.drew && at(c, 420, 110, p => greyOf(p, 212, 12)) && at(c, 230, 150, p => greyOf(p, 142)) && at(c, 400, 300, p => greyOf(p, 87, 8))
            && at(c, 380, 440, p => greyOf(p, 75, 6)) && at(c, 580, 390, p => greyOf(p, 28, 6)) && at(c, 400, 40, ground) && at(c, 400, 560, ground),
        // Levels 8: the full terrain again.
        "tess-control": greyTerrain,
        // Lines: dense everywhere, densest at the back.
        "wireframe": c => wireframe(c, 0.75, 0.96),
        // Distance-based levels: the back opens up.
        "distance-levels": c => wireframe(c, 0.3, 0.65),
    }],
    ["compute-shaders", {
        // The limits printed (llvmpipe's / lavapipe's numbers, Direct3D 12's constants): no visible change.
        "limits": c => darkBlue(c) && limits(c),
        "image-unit": c => darkBlue(c) && limits(c) && (c.api === Apis.D3D12 ? c.has("D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS") && c.has("CreateUnorderedAccessView \\(") : c.has("glBindImageTexture \\( 0 , texture , 0 , GL_FALSE , 0 , GL_READ_WRITE , GL_RGBA32F \\)")),
        "storage-image": c => darkBlue(c) && limits(c) && c.has("VK_DESCRIPTOR_TYPE_STORAGE_IMAGE") && c.has("VK_IMAGE_USAGE_STORAGE_BIT") && c.has("\\bcreateComputeDescriptorSet \\( \\)"),
        // The gradient: red across, green up.
        "compute-shader": c => c.drew && at(c, 0, 0, p => rg(p, 0, 1)) && at(c, 100, 300, p => rg(p, 0.13, 0.5)) && at(c, 400, 300, p => rg(p, 0.5, 0.5))
            && at(c, 699, 300, p => rg(p, 0.87, 0.5)) && at(c, 799, 599, p => rg(p, 1, 0)) && at(c, 400, 0, p => rg(p, 0.5, 1)) && at(c, 400, 599, p => rg(p, 0.5, 0)),
        // At 1.0 s moved right by 100 texels: the brightest red at x = 699, from 0 again at x = 700.
        "time": c => c.drew && at(c, 0, 0, p => rg(p, 0.13, 1)) && at(c, 100, 300, p => rg(p, 0.25, 0.5)) && at(c, 400, 300, p => rg(p, 0.625, 0.5))
            && at(c, 699, 300, p => rg(p, 1, 0.5)) && at(c, 700, 300, p => rg(p, 0, 0.5)) && at(c, 799, 599, p => rg(p, 0.125, 0)),
    }],
    ["area-lights", {
        // The LTC tables as float textures: no visible change.
        "ltc-textures": c => darkFloor(c) && c.has("#include \"ltc_matrix\\.hpp\"") && (c.api === Apis.OpenGL ? c.has("\\bloadMTexture \\( \\)") && c.has("\\bloadLUTTexture \\( \\)") && c.has("GL_RGBA32F") : c.api === Apis.Vulkan ? c.has("\\bloadMTexture \\(") && c.has("\\bloadLUTTexture \\(") && c.has("\\bcreateLTCSampler \\(") : c.has("\\bLoadLTCTexture \\( LTC1 ,") && c.has("\\bLoadLTCTexture \\( LTC2 ,")),
        // The diffuse term: the floor warm, brightest in front of the light, dark near the camera.
        "diffuse": c => c.drew && at(c, 400, 263, burlyWood) && at(c, 400, 380, p => warm(p) && p[0] > 0.45 && p[0] < 0.68)
            && at(c, 400, 420, p => warm(p) && p[0] > 0.28 && p[0] < 0.45) && at(c, 400, 560, p => warm(p) && p[0] > 0.1 && p[0] < 0.22) && at(c, 400, 100, black),
        // The specular term: a whitish reflection between the light and the camera.
        "specular": c => c.drew && at(c, 400, 263, burlyWood) && at(c, 400, 380, p => warm(p) && p[0] > 0.45 && p[0] < 0.68)
            && at(c, 400, 420, p => p[0] > 0.58 && p[0] < 0.75 && p[1] > p[0] * 0.75 && p[2] > p[0] * 0.6) && at(c, 400, 560, p => p[0] > 0.25 && p[0] < 0.4 && p[1] > p[0] * 0.75)
            && at(c, 400, 100, black),
        // The ring of eight coloured lights seen from above.
        "multiple-lights": c => c.drew && at(c, 400, 90, p => p[1] > 0.95 && p[0] > 0.45 && p[0] < 0.65 && p[2] < 0.45)
            && at(c, 395, 360, p => p[2] > 0.95 && p[0] > 0.7 && p[0] < 0.9 && p[1] < 0.5) && at(c, 680, 190, p => p[0] > 0.95 && p[1] > 0.45 && p[1] < 0.65 && p[2] < 0.35)
            && at(c, 118, 190, p => p[2] > 0.95 && p[1] > 0.65 && p[1] < 0.85 && p[0] < 0.4) && at(c, 400, 550, black) && at(c, 400, 20, black)
            && at(c, 470, 260, p => warm(p) && p[0] < 0.3) && at(c, 400, 450, p => p[0] > 0.35 && p[0] < 0.6 && p[2] > p[1]),
    }],
  ];
}
