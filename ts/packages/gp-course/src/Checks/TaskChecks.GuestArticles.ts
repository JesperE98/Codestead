import { Apis } from "@codestead/gp-gpu";
import { type CheckContext, type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";
import { black, teal } from "./TaskChecks.InPractice.js";

// Guest Articles, round 1: weighted blended OIT (the three quads), the scene graph and frustum culling (the ringed
// planets, at 2.0 s), cascaded shadow maps, OpenGL's DSA rectangle and the physically based bloom – at the named points
// of the 800×600 window each tasks.md lists, the same in every API. Tasks that change nothing visible are checked in the
// code, every API's spelling. (OIT Introduction has no tasks; DSA has tasks only in OpenGL.)
// ---- Weighted blended OIT: red (opaque), green (near, half transparent) and blue (far, half transparent) quads.

export function oitRed(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] < 0.1 && p[2] < 0.1;
}

/** A half transparent quad over black: one channel at about 128. */

export function half(p: Rgba, channel: number): boolean {
  return p[channel]! > 0.4 && p[channel]! < 0.6 && [0, 1, 2].filter((i) => i !== channel).every((i) => p[i]! < 0.05);
}

/** The ordinary blending of the start: red alone, green over the background, green over red. */

export function oitScene(c: CheckContext): boolean {
  return c.drew && at(c, 620, 300, oitRed) && at(c, 200, 450, p => half(p, 1)) && at(c, 450, 400, p => p[0] > 0.4 && p[0] < 0.6 && p[1] > 0.4 && p[1] < 0.6 && p[2] < 0.05);
}
// ---- Scene graph and frustum culling: the course's planet on the clear colour 13,13,13.

/** A planet (its texture, whatever the colour): not the clear colour (0.05, 0.05, 0.05). */

export function planet(p: Rgba): boolean {
  return Math.abs(p[0] - 0.051) > 0.04 || Math.abs(p[1] - 0.051) > 0.04 || Math.abs(p[2] - 0.051) > 0.04;
}

export function space(p: Rgba): boolean {
  return !planet(p);
}

/** The 10 × 10 grid around the root at 2.0 s (turned 40°), also its far back (far42). */

export function planetGrid(c: CheckContext): boolean {
  return at(c, 2.0, 680, 459, planet) && at(c, 2.0, 429, 327, planet) && at(c, 2.0, 396, 76, planet) && at(c, 2.0, 600, 560, space);
}

/** The frustum culling demo's title: "… drawn: 37 / 101". */

export function drawnInTitle(c: CheckContext, drawn: number): boolean {
  return new RegExp(`\\b${drawn}\\s*/\\s*101\\b`).test(c.windowTitleAt(2.0));
}
// ---- Cascaded shadow maps: the wooden floor and the ten cubes, the light from above right in front.

/** The lit wood (60,41,25 here): brown, red over green over blue. */

export function csmWood(p: Rgba): boolean {
  return p[0] > 0.17 && p[0] < 0.35 && p[0] > p[1] + 0.04 && p[1] > p[2] + 0.03;
}

/** The wood in shadow: only the ambient term (15,10,6), still brown. */

export function csmShadow(p: Rgba): boolean {
  return p[0] < 0.1 && p[0] > p[1] && p[1] >= p[2];
}

/** The shadows of the cubes in cascades 1 and 2, the floor lit beside them. */

export function csmShadows(c: CheckContext): boolean {
  return c.drew && at(c, 490, 475, csmShadow) && at(c, 290, 273, csmShadow) && at(c, 405, 221, csmShadow) && at(c, 155, 335, csmShadow)
    && at(c, 650, 470, csmWood) && at(c, 200, 280, csmWood) && at(c, 480, 230, csmWood) && at(c, 400, 40, p => grey(p) && p[0] > 0.07 && p[0] < 0.14);
}
// ---- DSA (OpenGL): Hello Triangle's orange rectangle on teal.

export function dsaRectangle(c: CheckContext): boolean {
  return c.drew && at(c, 400, 300, p => p[0] > 0.95 && Math.abs(p[1] - 0.5) < 0.04 && Math.abs(p[2] - 0.2) < 0.04) && at(c, 100, 100, teal);
}
// ---- Physically based bloom: the bloom chapter's scene (the light cubes, the boxes, the floor).

export function bloomWhite(p: Rgba): boolean {
  return p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95;
}

/** The scene with hard edges: the light cubes, the black background right beside them. */

export function bloomStart(c: CheckContext): boolean {
  return c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, black) && at(c, 400, 262, black) && at(c, 600, 100, black) && at(c, 400, 60, p => p[0] > 0.55 && p[0] > p[2] + 0.15);
}

/** The scene with the bloom mixed in at 0.04: a soft grey glow beside the light cubes, the boxes as before. */

export function bloomCombined(c: CheckContext): boolean {
  return c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => grey(p) && p[0] > 0.3 && p[0] < 0.62) && at(c, 400, 262, p => p[0] > 0.3 && p[0] < 0.62)
    && at(c, 290, 55, p => p[1] > p[0] + 0.15 && p[1] > 0.3 && p[1] < 0.65) && at(c, 600, 100, p => p[0] < 0.15) && at(c, 400, 60, p => p[0] > 0.6 && p[0] < 0.8 && p[0] > p[2] + 0.15);
}

export function guestArticles(): ChapterChecks {
  return [
    ["weighted-blended", {
        // The scene drawn into an off-screen 16-bit float target and copied to the window: no visible change.
        "opaque-pass": c => oitScene(c) && at(c, 230, 300, p => half(p, 1)) && (c.api === Apis.OpenGL ? c.has("glBindFramebuffer \\( GL_FRAMEBUFFER , opaqueFBO \\)") && c.has("\\bscreenShader \\. use \\( \\)") : c.api === Apis.Vulkan ? c.has("\\bopaqueFramebuffer\\b") && c.has("vkCmdBindPipeline \\([^;]*\\bscreenPipeline\\b") : c.has("SetPipelineState \\( m_screenPipelineState") && c.has("CreateRenderTargetView \\( m_opaqueTexture")),
        // The transparent quads drawn into accumulation and revealage targets nobody shows yet: only the red quad.
        "transparent-pass": c => c.drew && at(c, 620, 300, oitRed) && at(c, 450, 400, oitRed) && at(c, 400, 180, oitRed)
            && at(c, 200, 450, black) && at(c, 250, 120, black) && at(c, 230, 300, black),
        // Composited: the quads back, and where green covers blue both count (0,96,96 – the blue corner shows through).
        "composite": c => oitScene(c) && at(c, 250, 120, p => half(p, 2)) && at(c, 400, 180, oitRed) && at(c, 700, 80, black)
            && at(c, 230, 300, p => p[0] < 0.05 && p[1] > 0.3 && p[1] < 0.45 && p[2] > 0.3 && p[2] < 0.45),
    }],
    ["scene-graph", {
        // Transform and its functions; the planet drawn with a Transform's (identity) matrix: no visible change.
        "transform": c => c.drew && c.has("struct Transform \\{") && c.has("\\bgetLocalModelMatrix \\(") && c.has("\\bcomputeModelMatrix \\(")
            && at(c, 238, 320, planet) && at(c, 427, 320, space),
        // The chain of ten ever smaller children to the right of the root.
        "entity": c => c.drew && c.has("\\bupdateSelfAndChild \\(") && at(c, 238, 320, planet) && at(c, 427, 320, planet) && at(c, 540, 320, planet) && at(c, 456, 250, space),
        // The dirty flag: the same picture.
        "dirty-flag": c => c.drew && c.has("\\bisDirty\\b") && c.has("\\bforceUpdateSelfAndChild \\(") && at(c, 427, 320, planet) && at(c, 540, 320, planet),
        // The root turned 20°/s, the graph updated every frame: at 2.0 s the chain points into the screen.
        "animate": c => c.shows && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 385, 273, planet) && at(c, 2.0, 456, 250, planet) && at(c, 2.0, 494, 238, planet)
            && at(c, 2.0, 427, 320, space) && at(c, 2.0, 540, 320, space),
    }],
    ["frustum-culling", {
        // The grid of 10 × 10 planets around the root.
        "grid": c => c.shows && at(c, 2.0, 238, 320, planet) && planetGrid(c),
        // Plane, Frustum and createFrustumFromCamera, not used yet.
        "frustum": c => c.shows && c.has("struct Plane \\{") && c.has("struct Frustum \\{") && c.has("\\bFrustum createFrustumFromCamera \\(") && c.has("\\bgetSignedDistanceToPlane \\(") && planetGrid(c),
        // Every entity's bounding sphere, not used yet.
        "bounding-sphere": c => c.shows && c.has("struct Sphere \\{") && c.has("\\bgenerateSphereBV \\(") && c.has("\\bisOnFrustum \\(") && planetGrid(c),
        // Culled against a frustum whose far plane is 15: the back of the grid gone, 8 of 101 drawn.
        "cull": c => c.shows && drawnInTitle(c, 8) && at(c, 2.0, 680, 459, planet) && at(c, 2.0, 429, 327, planet)
            && at(c, 2.0, 283, 251, space) && at(c, 2.0, 442, 208, space) && at(c, 2.0, 396, 76, space),
        // The projection's own frustum: the whole grid again, but only 37 of 101 drawn.
        "camera-frustum": c => c.shows && drawnInTitle(c, 37) && planetGrid(c) && at(c, 2.0, 283, 251, planet),
        // Axis-aligned boxes: the same picture, 38 of 101 drawn (the turned box is a little larger than the sphere).
        "aabb": c => c.shows && c.has("struct AABB \\{") && c.has("\\bgenerateAABB \\(") && drawnInTitle(c, 38) && planetGrid(c),
    }],
    ["csm", {
        // The five light-space matrices, computed every frame into the uniform buffer: no visible change yet.
        "light-matrices": c => c.drew && c.has("\\bshadowCascadeLevels\\b") && c.has("\\bgetLightSpaceMatrix \\(") && c.has("\\bgetFrustumCornersWorldSpace \\(")
            && at(c, 490, 475, csmWood) && at(c, 290, 273, csmWood),
        // Layer 2 of the shadow maps on the screen: white where nothing is, the floor's corner grey.
        "depth-maps": c => c.drew && at(c, 490, 475, p => grey(p) && p[0] > 0.55 && p[0] < 0.75) && at(c, 100, 560, p => grey(p) && p[0] > 0.55 && p[0] < 0.75)
            && at(c, 650, 470, p => p[0] > 0.97 && grey(p)) && at(c, 400, 40, p => p[0] > 0.97 && grey(p)),
        // The scene tinted by cascade: red near the camera, green in the middle, blue at the back.
        "cascade-layer": c => c.drew && c.hasInShaders("\\bCascadeLayer \\(")
            && at(c, 100, 560, p => p[0] > p[1] + 0.03 && p[0] > p[2] + 0.03) && at(c, 490, 475, p => p[1] > p[0] + 0.05 && p[1] > p[2] + 0.05)
            && at(c, 290, 273, p => p[2] > p[1] + 0.02 && p[0] > p[1]) && at(c, 405, 221, p => p[2] > p[1] + 0.02),
        // One sample of the cascade's layer: the cubes' shadows on the floor in cascades 1 and 2.
        "shadows": c => csmShadows(c),
        // 3 × 3 PCF: soft edges, the named points as before.
        "pcf": c => csmShadows(c) && c.hasInShaders("textureSize \\(|GetDimensions \\(") && c.hasInShaders("/= 9\\.0"),
    }],
    ["dsa", {
        // OpenGL 4.5 core: no visible change.
        "context": c => dsaRectangle(c) && c.has("GLFW_CONTEXT_VERSION_MAJOR , 4 \\)") && c.has("GLFW_CONTEXT_VERSION_MINOR , 5 \\)"),
        "vertex-buffer": c => dsaRectangle(c) && c.has("glCreateBuffers \\( 1 , & VBO \\)") && c.has("glNamedBufferStorage \\( VBO ,"),
        "element-buffer": c => dsaRectangle(c) && c.has("glCreateBuffers \\( 1 , & EBO \\)") && c.has("glNamedBufferSubData \\( EBO ,"),
        "vertex-array": c => dsaRectangle(c) && c.has("glCreateVertexArrays \\(") && c.has("glVertexArrayAttribFormat \\(") && c.has("glVertexArrayVertexBuffer \\(") && c.has("glVertexArrayElementBuffer \\("),
        // The container through DSA: wood in the middle, the light grey bolt at the top left, teal around it.
        "texture": c => c.drew && c.has("glTextureStorage2D \\(") && c.has("glBindTextureUnit \\(")
            && at(c, 400, 300, p => p[0] > 0.28 && p[0] < 0.45 && p[0] > p[1] + 0.08 && p[1] > p[2] + 0.08)
            && at(c, 300, 220, p => p[0] > 0.45 && p[0] < 0.65 && p[0] > p[2] + 0.2) && at(c, 218, 163, p => p[0] > 0.65 && Math.abs(p[0] - p[1]) < 0.05)
            && at(c, 100, 100, teal),
    }],
    ["physically-based-bloom", {
        // The bloom framebuffer and its six levels: not used yet.
        "mip-chain": c => bloomStart(c) && c.has("struct BloomMip \\{") && c.has("\\bInitBloomFBO \\([^;)]*\\b6\\b"),
        // The 100 × 75 level on the screen: the scene blurred, the light cubes smeared into their surroundings.
        "downsample": c => c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => grey(p) && p[0] > 0.6 && p[0] < 0.97) && at(c, 400, 262, p => p[0] > 0.5 && p[0] < 0.97)
            && at(c, 290, 55, p => p[1] > 0.75 && p[0] < 0.15) && at(c, 600, 100, black),
        // The bloom texture (level 0): everything soft and bright, the background lit too.
        "upsample": c => c.drew && at(c, 465, 200, p => p[0] > 0.95) && at(c, 400, 262, p => p[0] > 0.95) && at(c, 290, 55, p => p[1] > 0.95 && p[0] > 0.4)
            && at(c, 600, 100, p => p[0] > 0.1) && at(c, 200, 450, p => p[0] > 0.6),
        "combine": c => bloomCombined(c) && c.hasInShaders("\\bbloomStrength\\b"),
        // The Karis average on the first downsample: the glow a little weaker (checked in the code).
        "karis-average": c => bloomCombined(c) && c.hasInShaders("\\bKarisAverage \\(") && c.hasInShaders("\\bmipLevel\\b"),
    }],
  ];
}
