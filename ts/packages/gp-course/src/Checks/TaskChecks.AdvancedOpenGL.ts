import { given, type CheckContext, type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { white } from "./TaskChecks.Lighting.js";

// Advanced OpenGL: learnopengl's scene (two marble cubes on a metal floor, camera at (0, 0, 3)) at named points of the
// 800×600 window – the same pixels in every API – and the state calls where a step changes nothing visible.

/** The metal floor: a cool grey, a little bluer than red (marble is warmer: red above blue). */

export function metal(p: Rgba): boolean {
  return p[2] > p[0] + 0.02 && p[0] > 0.3;
}

export function marble(p: Rgba): boolean {
  return p[0] >= p[2] && p[0] > 0.4;
}

export function grey(p: Rgba): boolean {
  return Math.abs(p[0] - p[1]) < 0.02 && Math.abs(p[1] - p[2]) < 0.02;
}

/**
 * The pixel at window coordinates (800×600) of the frame at 1 s – or, with a time first, of the frame at time t
 * (C#: two overloads, At(c, x, y, test) here and At(c, t, x, y, test) in TaskChecks.InPractice2).
 */

export function at(c: CheckContext, x: number, y: number, test: (p: Rgba) => boolean): boolean;

export function at(c: CheckContext, t: number, x: number, y: number, test: (p: Rgba) => boolean): boolean;

export function at(c: CheckContext, a: number, b: number, d: number | ((p: Rgba) => boolean), e?: (p: Rgba) => boolean): boolean {
  if (typeof d === "function") return given(c.pixel(a / 800.0, b / 600.0), d);
  return given(c.pixelAt(a, b / 800.0, d / 600.0), e!);
}

/** The teal of learnopengl's outline, (0.04, 0.28, 0.26). */

export function outline(p: Rgba): boolean {
  return Math.abs(p[0] - 0.04) < 0.03 && Math.abs(p[1] - 0.28) < 0.03 && Math.abs(p[2] - 0.26) < 0.03;
}

/** The cube's back face counter-clockwise: (-0.5, -0.5, -0.5) followed by (0.5, 0.5, -0.5), whatever the syntax. */
export const CcwBackFace = "-0\\.5f?[^\\w.-]+-0\\.5f?[^\\w.-]+-0\\.5f?[^\\w.-]+[01]\\.0f?[^\\w.-]+[01]\\.0f?[^\\w.-]+0\\.5f?[^\\w.-]+0\\.5f?[^\\w.-]+-0\\.5f?";

export function advancedOpenGL(): ChapterChecks {
  return [
    ["depth-testing", {
        // The floor, drawn last, covers the bottom of cube 0 (193, 390).
        "depth-always": c => c.drew && at(c, 193, 390, metal),
        "depth-less": c => c.drew && at(c, 193, 390, marble) && at(c, 100, 500, metal),
        "visualize-depth": c => c.drew && at(c, 193, 300, p => grey(p) && p[0] > 0.9),
        "linear-depth": c => c.drew && at(c, 193, 300, p => grey(p) && p[0] < 0.08) && c.hasInShaders("(?i)linearizeDepth|near \\* far"),
    }],
    ["stencil-testing", {
        "stencil-buffer": c => c.drew && ((c.api === "opengl" ? c.has("glEnable \\( GL_STENCIL_TEST \\)") : c.api === "vulkan" ? c.has("stencilTestEnable = VK_TRUE") : c.has("StencilEnable = TRUE"))),
        "single-color": c => c.built && c.hasInShaders("0\\.04f? , 0\\.28f? , 0\\.26f?"),
        "write-stencil": c => c.drew && at(c, 193, 300, marble) && ((c.api === "opengl" ? c.has("glStencilMask \\( 0x00 \\)") && c.has("glStencilFunc \\( GL_ALWAYS , 1 , 0xFF \\)") : c.api === "vulkan" ? c.has("floorPipeline") : c.has("m_floorPipelineState"))),
        "outline": c => c.drew && at(c, 82, 300, outline) && at(c, 702, 300, outline) && at(c, 193, 300, marble),
    }],
    ["blending", {
        "grass": c => c.drew && c.has("grass\\.png") && c.has("vegetation"),
        "discard": c => c.drew && c.hasInShaders("\\bdiscard\\b|\\bclip \\("),
        // A window over the background (470, 230): the red glass blended with the dark grey.
        "blend": c => c.drew && c.has("window\\.png") && at(c, 470, 230, p => p[0] > 0.4 && p[0] < 0.7 && p[1] < 0.2),
        "sort": c => c.drew && c.has("reverse_iterator") && c.has("rbegin \\( \\)") && at(c, 470, 230, p => p[0] > 0.4 && p[1] < 0.2),
    }],
    ["face-culling", {
        "ccw-cube": c => c.drew && c.has(CcwBackFace),
        "cull-back": c => c.drew && at(c, 100, 500, metal) && at(c, 193, 300, marble) && ((c.api === "opengl" ? c.has("glEnable \\( GL_CULL_FACE \\)") : c.api === "vulkan" ? c.has("cullMode = VK_CULL_MODE_BACK_BIT") : c.has("CullMode = D3D12_CULL_MODE_BACK"))),
        // Front faces culled: the floor (facing up at the camera) disappears, the cubes show their inside.
        "cull-front": c => c.drew && c.isClear(100 / 800.0, 500 / 600.0) && at(c, 193, 300, marble),
    }],
    ["framebuffers", {
        // The scene goes into the off-screen target: the window shows only its (white) clear colour.
        "offscreen-target": c => c.shows && at(c, 193, 300, white) && at(c, 400, 300, white),
        "screen-quad": c => c.drew && at(c, 193, 300, marble) && at(c, 100, 500, metal),
        "inversion": c => c.drew && at(c, 400, 100, p => grey(p) && p[0] > 0.8),
        "grayscale": c => c.drew && at(c, 100, 500, grey) && at(c, 400, 100, p => p[0] < 0.15),
        "sharpen": c => c.drew && c.hasInShaders("-1\\.0f? , 9\\.0f? , -1\\.0f?"),
        "blur": c => c.drew && c.hasInShaders("/ 16"),
        "edge-detection": c => c.drew && c.hasInShaders("-8\\.0f?") && at(c, 400, 100, p => p[0] < 0.03 && p[1] < 0.03 && p[2] < 0.03),
    }],
    ["cubemaps", {
        "load-cubemap": c => c.drew && c.has("GL_TEXTURE_CUBE_MAP_POSITIVE_X \\+ i|VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT|D3D12_SRV_DIMENSION_TEXTURECUBE"),
        // The sky behind the cubes: blue at the top of the window.
        "skybox": c => c.drew && at(c, 400, 100, p => p[2] > p[0] + 0.1),
        "skybox-last": c => c.drew && at(c, 400, 100, p => p[2] > p[0] + 0.1) && c.hasInShaders("\\.xyww") && c.has("GL_LEQUAL|VK_COMPARE_OP_LESS_OR_EQUAL|D3D12_COMPARISON_FUNC_LESS_EQUAL"),
        "reflection": c => c.drew && c.hasInShaders("reflect \\(") && at(c, 193, 300, p => p[2] > p[0]),
        "refraction": c => c.drew && c.hasInShaders("refract \\("),
    }],
    ["advanced-data", {
        // No step changes the picture: the scene stays, the code changes.
        "buffer-sub-data": c => scene(c) && c.has("glBufferSubData \\( GL_ARRAY_BUFFER"),
        "map-buffer": c => scene(c) && (c.api === "opengl" ? c.has("glMapBuffer \\(") : c.has("m_floorVertexBufferView")),
        "batched-attributes": c => scene(c) && (c.api === "opengl" ? c.has("sizeof \\( cubePositions \\)") : c.api === "vulkan" ? c.has("getBindingDescriptions \\( \\)") : c.has("m_vertexBufferViews \\[ 2 \\]")),
        "copy-buffer": c => scene(c) && (c.api === "opengl" ? c.has("glCopyBufferSubData \\(") : c.api === "vulkan" ? c.has("vkCmdCopyBuffer \\(") && c.has("VK_BUFFER_USAGE_TRANSFER_DST_BIT \\| VK_BUFFER_USAGE_VERTEX_BUFFER_BIT") : c.has("m_floorCopyBuffer")),
        "map-memory": c => scene(c) && c.has("vertices \\. data \\( \\) \\+ 36"),
        "update-buffer": c => scene(c) && c.has("vkCmdUpdateBuffer \\("),
        "default-heap": c => scene(c) && c.has("CopyBufferRegion \\( m_vertexBuffer"),
    }],
    ["advanced-glsl", {
        // Left of x = 400 red, right of it green.
        "frag-coord": c => c.drew && at(c, 193, 300, p => p[0] > 0.5 && p[1] < 0.2) && at(c, 600, 450, p => p[1] > 0.5 && p[0] < 0.2),
        // Front faces culled: the cubes' insides (back faces) show the metal texture.
        "front-facing": c => c.drew && at(c, 193, 300, metal) && c.hasInShaders("gl_FrontFacing|SV_IsFrontFace"),
        "interface-block": c => c.drew && at(c, 193, 300, metal) && c.hasInShaders("VS_OUT"),
        // learnopengl's four cubes: yellow bottom-right … green top-right.
        "uniform-buffer": c => c.drew && at(c, 100, 500, p => p[0] > 0.9 && p[1] > 0.9 && p[2] < 0.1) && at(c, 470, 230, p => p[1] > 0.9 && p[0] < 0.1),
    }],
  ];
}

/** The depth-testing scene, unchanged: marble cube 0 and the metal floor. */

export function scene(c: CheckContext): boolean {
  return c.drew && at(c, 193, 300, marble) && at(c, 100, 500, metal);
}