import { given, type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at, grey, marble, metal, outline, scene } from "./TaskChecks.AdvancedOpenGL.js";
import { background, red, rock, yellow } from "./TaskChecks.AdvancedOpenGL3.js";
import { white } from "./TaskChecks.Lighting.js";

// The exercises' checks of model-loading and advanced-opengl, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner.

/** The 16-bit index type of an API, with the vector of indices to match (and its size per index). */

export function shortIndices(c: CheckContext): boolean {
  return (c.api === "opengl" ? c.has("std::vector < (?:unsigned short|uint16_t|GLushort) > indices") && c.has("GL_UNSIGNED_SHORT") && c.has("sizeof \\( (?:unsigned short|uint16_t|GLushort|indices \\[ 0 \\]) \\)") : c.api === "vulkan" ? c.has("std::vector < (?:uint16_t|unsigned short) > indices") && c.has("VK_INDEX_TYPE_UINT16") : c.has("std::vector < (?:UINT16|uint16_t|unsigned short|WORD) > indices") && c.has("DXGI_FORMAT_R16_UINT") && c.has("sizeof \\( (?:UINT16|uint16_t|unsigned short|WORD|indices \\[ 0 \\]) \\)"));
}

/** The lit planet's north pole (light grey ice, ≈ 120,123,125) at the top of the model, at a time. */

export function litPole(c: CheckContext, time = 1): boolean {
  return given(c.pixelAt(time, 0.5, 0.31), (p) => p[0] > 0.4 && p[1] > 0.4 && p[2] > 0.4);
}

/** How many points of a box of the window (relative, 0.01 apart) pass a test. */
export function countInBox(c: CheckContext, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  let n = 0;
  for (let y = y0; y <= y1; y += 0.01) for (let x = x0; x <= x1; x += 0.01) if (given(c.pixel(x, y), (p) => test(p))) n++;
  return n;
}

/** A pixel lit at all (any channel above 0.05): the edge-detection picture is black where nothing changes. */

export function litAboveBlack(p: Rgba): boolean {
  return Math.max(p[0], Math.max(p[1], p[2])) > 0.05;
}

export function orangeOutline(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] > 0.5 && p[1] < 0.7 && p[2] < 0.1;
}

export function exercisesModelsAndAdvancedOpenGL(): Record<string, Checks> {
  return {
    "mesh": {
        // Vulkan: the test square (texture-coordinate colours) and a second one to its right, in the same buffers.
        "ex-second-square": c => c.pixelIs(0.5, 0.5, 0.51, 0.51, 0) && c.drawnAt(0.8, 0.5) && c.isClear(0.95, 0.5),
        // Nothing changes in the picture (Vulkan: still the square), only the index type.
        "ex-short-indices": c => (c.api === "vulkan" ? c.pixelIs(0.5, 0.5, 0.51, 0.51, 0) : c.shows) && shortIndices(c),
        // OpenGL: the naming convention for a fourth kind of texture.
        "ex-height-textures": c => c.built && c.has("\"texture_height\"") && c.has("heightNr \\+\\+"),
    },
    "model": {
        // The light up to the left: the left rim (an ocean) lit, the right side (land) in the shadow.
        "ex-light-left": c => given(c.pixel(0.365, 0.5), (l) => l[2] > 0.25 && given(c.pixel(0.635, 0.5), (r) => r[1] < 0.15)),
        // normal * 0.5 + 0.5: the left rim little red, the right rim much, the middle (facing the camera) blue, the pole green.
        "ex-normals": c => given(c.pixel(0.365, 0.5), (l) => l[0] < 0.25 && given(c.pixel(0.635, 0.5), (r) => r[0] > 0.75
            && given(c.pixel(0.5, 0.5), (m) => m[2] > 0.9 && given(c.pixel(0.5, 0.31), (n) => n[1] > 0.85)))),
        // It turns about its own axis: the picture changes, the north pole stays where it is.
        "ex-spin": c => c.changesOverTime && litPole(c) && litPole(c, 2.3),
        // A small second planet up to the right of the first: (1.2, 0.6, 0) is (690, 155) in the window.
        "ex-moon": c => litPole(c) && c.drawnAt(0.862, 0.258),
    },
    // Advanced OpenGL: learnopengl's scene at the same named points as the steps' checks (TaskChecks.AdvancedOpenGL.cs).
    "depth-testing": {
        // Linear depth over 10 units instead of 100: cube 0 (4 units away) a middle grey, the far floor lighter.
        "ex-depth-range": c => at(c, 193, 300, p => grey(p) && p[0] > 0.25 && p[0] < 0.45) && at(c, 600, 370, p => grey(p) && p[0] > 0.4),
        // The textures again, faded into the background grey with the distance: the near floor still metal, the far floor darker.
        "ex-fog": c => at(c, 100, 500, metal) && at(c, 600, 370, p => p[0] < 0.36 && p[0] > 0.15) && at(c, 193, 300, p => !grey(p) || p[0] > 0.3),
        // The near plane at 3.7: the near floor and cube 1's face are cut away, cube 0 shows its inside.
        "ex-near-clip": c => c.isClear(100 / 800.0, 500 / 600.0) && c.isClear(760 / 800.0, 250 / 600.0) && c.drawnAt(193 / 800.0, 300 / 600.0),
    },
    "stencil-testing": {
        "ex-orange-outline": c => at(c, 82, 300, orangeOutline) && at(c, 702, 300, orangeOutline) && at(c, 193, 300, marble),
        // Scaled by 1.2: the outline reaches further out (64, 300), where 1.1 left the background.
        "ex-thick-outline": c => at(c, 64, 300, outline) && at(c, 82, 300, outline) && at(c, 193, 300, marble),
        // Only cube 0 is outlined.
        "ex-left-only": c => at(c, 82, 300, outline) && at(c, 702, 300, background) && at(c, 193, 300, marble),
        // GL_EQUAL: the single colour covers the cubes (stencil 1) instead of the ring around them.
        "ex-silhouette": c => at(c, 193, 300, outline) && at(c, 82, 300, background) && at(c, 100, 500, metal),
    },
    "blending": {
        // Without blending the glass is its own red, not mixed with the background behind it (470, 230).
        "ex-opaque-glass": c => at(c, 470, 230, p => p[0] > 0.8 && p[1] < 0.2),
        // Alpha below 0.6 discarded: the glass is gone, the frame stays.
        "ex-threshold": c => at(c, 470, 240, background) && at(c, 450, 330, background) && c.anyDrawnPixel(p => p[0] > 0.35 && p[1] < 0.1 && p[2] < 0.1),
        // A sixth window at (-0.8, 0, 1.0): red glass over the background up to the left (130, 150).
        "ex-sixth-window": c => at(c, 130, 150, p => p[0] > 0.4 && p[0] < 0.7 && p[1] < 0.2) && at(c, 470, 230, p => p[0] > 0.4 && p[1] < 0.2),
    },
    "face-culling": {
        // Front faces clockwise while the front is culled: the outsides (counter-clockwise) count as back faces and stay.
        "ex-clockwise": c => at(c, 100, 500, metal) && at(c, 193, 300, marble)
            && c.has("glFrontFace \\( GL_CW \\)|frontFace = VK_FRONT_FACE_CLOCKWISE|FrontCounterClockwise = FALSE"),
        // Every face culled: nothing but the background.
        "ex-cull-all": c => c.shows && c.isClear(193 / 800.0, 300 / 600.0) && c.isClear(100 / 800.0, 500 / 600.0) && c.isClear(760 / 800.0, 250 / 600.0)
            && c.has("GL_FRONT_AND_BACK|VK_CULL_MODE_FRONT_AND_BACK"),
        // Under the floor, looking up at its back: the floor shows above the middle of the window although front faces are culled.
        "ex-under-floor": c => at(c, 400, 150, p => p[2] > p[0] + 0.02 && p[0] > 0.25) && at(c, 400, 200, p => p[2] > p[0] + 0.02 && p[0] > 0.25),
    },
    "framebuffers": {
        // Upside down: the floor's edges at the top of the window, the bottom black (the edge kernel stays).
        "ex-upside-down": c => countInBox(c, 0.02, 0.02, 0.98, 0.3, litAboveBlack) > 60 && countInBox(c, 0.02, 0.8, 0.98, 0.98, litAboveBlack) < 5,
        // The emboss kernel (its weights add up to 1): flat areas keep their colour – the background grey, the floor metal.
        "ex-emboss": c => c.pixelIs(0.5, 100 / 600.0, 0.1, 0.1, 0.1) && at(c, 100, 500, p => p[0] > 0.4 && p[2] > p[0]),
        // Sepia: every grey turns brown – red above green above blue, even the background.
        "ex-sepia": c => at(c, 400, 100, p => p[0] > p[1] + 0.01 && p[1] > p[2] + 0.02) && at(c, 100, 500, p => p[0] > 0.6 && p[0] > p[1] + 0.05 && p[1] > p[2] + 0.1),
        // The picture in the top right quarter only, the rest the window's white clear colour.
        "ex-quarter": c => at(c, 200, 450, white) && at(c, 100, 100, white) && at(c, 193, 300, white) && at(c, 600, 150, p => !white(p)),
    },
    "cubemaps": {
        // Diamond (2.42) bends the light more: other parts of the sky in the cubes.
        "ex-diamond": c => c.pixelIs(193 / 800.0, 0.5, 0.553, 0.643, 0.725) && c.pixelIs(0.95, 250 / 600.0, 0.663, 0.788, 0.918),
        // Green-tinted glass: green above blue in the cubes, the sky behind them still blue.
        "ex-tinted-glass": c => at(c, 193, 300, p => p[1] > p[2] && p[0] < p[2] - 0.15) && at(c, 400, 100, p => p[2] > p[0] + 0.1),
        // Half reflection, half refraction.
        "ex-half-mirror": c => c.pixelIs(150 / 800.0, 250 / 600.0, 0.514, 0.604, 0.729) && c.hasInShaders("reflect \\(") && c.hasInShaders("refract \\("),
    },
    "advanced-data": {
        // Only half the floor's bytes copied: its second triangle (the far right half) is gone, the near left half stays.
        "ex-half-floor": c => at(c, 100, 500, metal) && at(c, 600, 370, background) && at(c, 400, 370, background) && at(c, 193, 300, marble),
        // The texture coordinates block first, the positions after it: the same picture, other offsets.
        "ex-swap-blocks": c => scene(c) && (c.api === "opengl" ? c.has("glVertexAttribPointer \\( 0 , 3 ,[^;]*sizeof \\( cubeTexCoords \\)") && c.has("glVertexAttribPointer \\( 1 , 2 ,[^;]*\\( void \\* \\) 0 \\)") : c.api === "vulkan" ? c.has("VkDeviceSize offsets \\[ \\] = \\{ (?!0 ,)[^,}]+ , 0 \\}") : c.has("m_vertexBufferViews \\[ 0 \\] \\. BufferLocation = m_vertexBuffer -> GetGPUVirtualAddress \\( \\) \\+ sizeof \\( cubeTexCoords \\)")),
    },
    "advanced-glsl": {
        // A 60° field of view in the shared matrices: all four cubes smaller, the window's corners free.
        "ex-zoom-out": c => at(c, 60, 30, background) && at(c, 200, 588, background) && at(c, 200, 150, red) && at(c, 600, 450, p => p[2] > 0.9 && p[0] < 0.1),
        // The yellow cube darker towards the bottom of the window: 0.4 at y = 360, almost black at the bottom edge.
        "ex-gradient": c => at(c, 200, 360, p => p[0] > 0.3 && p[0] < 0.5 && Math.abs(p[0] - p[1]) < 0.03 && p[2] < 0.05) && at(c, 200, 588, p => p[0] < 0.1) && at(c, 200, 150, red),
        // The blue cube in 20-pixel squares, blue and white.
        "ex-checkerboard": c => countInBox(c, 0.6, 0.62, 0.92, 0.97, white) > 150 && countInBox(c, 0.6, 0.62, 0.92, 0.97, p => p[2] > 0.95 && p[0] < 0.05) > 150 && at(c, 200, 450, yellow),
    },
    "geometry-shader": {
        // Normals 0.5 long instead of 0.2: far more yellow, and it reaches well above the north pole.
        "ex-long-normals": c => c.countPixels(yellow) > 3000 && countInBox(c, 0.4, 0.18, 0.6, 0.28, yellow) > 150,
        // The triangles' edges instead of the normals: yellow lines all over the planet's face, none sticking out above the pole.
        "ex-wireframe": c => countInBox(c, 0.4, 0.4, 0.6, 0.6, yellow) > 100 && countInBox(c, 0.4, 0.18, 0.6, 0.28, yellow) === 0 && at(c, 400, 300, p => !background(p)),
        // One line per triangle from its centre, along the face's normal (a cross product in the normals' geometry shader).
        "ex-face-normals": c => c.countPixels(yellow) > 2100 && c.countPixels(yellow) < 3000 && countInBox(c, 0.4, 0.18, 0.6, 0.28, yellow) > 60
            && c.hasIn((c.api === "opengl" ? "normal_visualization.gs" : c.api === "vulkan" ? "shaders/normal_visualization.geom" : "normal_visualization.hlsl"), "cross \\("),
    },
    "instancing": {
        // The belt five times as high: rocks above the old band (whose top was at y ≈ 270).
        "ex-high-belt": c => countInBox(c, 0.15, 0.3, 0.85, 0.44, p => !background(p)) > 12,
        // Three times as many rocks, still one draw call.
        "ex-more-rocks": c => c.countPixels(rock) > 350,
        // Every third instance tinted red by its instance number.
        "ex-red-rocks": c => c.countPixels(p => p[0] > 0.2 && p[0] > p[1] + 0.12 && Math.abs(p[1] - p[2]) < 0.08) > 30 && c.countPixels(rock) > 60,
    },
    "anti-aliasing": {
        // Two samples per pixel: an edge pixel is either half covered or not mixed at all – one grey between background and cube.
        "ex-two-samples": c => c.countPixels(p => grey(p) && p[0] > 0.36 && p[0] < 0.46) > 50
            && c.countPixels(p => grey(p) && (p[0] > 0.15 && p[0] < 0.35 || p[0] > 0.48 && p[0] < 0.65)) === 0 && at(c, 400, 300, p => grey(p) && Math.abs(p[0] - 0.714) < 0.03),
        // The mixed (anti-aliased) pixels in red along the cube's edges, the rest grey.
        "ex-show-edges": c => c.countPixels(red) > 100 && at(c, 400, 300, p => grey(p) && Math.abs(p[0] - 0.714) < 0.03),
    },
  };
}
