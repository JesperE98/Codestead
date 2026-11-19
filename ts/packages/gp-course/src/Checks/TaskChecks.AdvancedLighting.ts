import { type CheckContext } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";

// Advanced Lighting: learnopengl's wooden floor (Blinn-Phong, gamma correction) and its shadow mapping scene, at named
// points of the 800×600 window – the same pixels in every API.

/** The shadow under the floating cube (650, 450): the wood almost black. */

export function inShadow(c: CheckContext): boolean {
  return at(c, 650, 450, p => p[0] < 0.12 && p[0] > p[2]);
}

/** The lit floor at the left (200, 450): the wood in the light. */

export function litFloor(c: CheckContext): boolean {
  return at(c, 200, 450, p => p[0] > 0.18 && p[0] > p[2] + 0.05);
}

export function advancedLighting(): ChapterChecks {
  return [
    ["advanced-lighting", {
        // Blinn-Phong with Phong's exponent: a wider, brighter highlight.
        "halfway": c => c.drew && c.hasInShaders("halfwayDir") && at(c, 450, 440, p => p[0] > 0.63),
        // Exponent 32: the highlight shrinks again, the floor beside it darkens.
        "shininess": c => c.drew && c.hasInShaders("halfwayDir") && at(c, 300, 540, p => p[0] < 0.33),
    }],
    ["gamma-correction", {
        // The output corrected while the texture is still read as linear: everything washed out.
        "gamma-shader": c => c.drew && c.hasInShaders("1\\.0f? / (?:2\\.2|gamma)") && at(c, 450, 560, p => p[2] > 0.2),
        "srgb-texture": c => c.drew && at(c, 450, 560, p => p[0] > 0.25 && p[0] < 0.37) && (c.api === "opengl" ? c.has("GL_SRGB") : c.api === "vulkan" ? c.has("VK_FORMAT_R8G8B8A8_SRGB") : c.has("DXGI_FORMAT_R8G8B8A8_UNORM_SRGB")),
        // 1 / d²: the light falls off faster – darker between the lights, brighter close to them.
        "quadratic": c => c.drew && at(c, 450, 560, p => p[0] > 0.15 && p[0] < 0.26) && at(c, 150, 430, p => p[0] > 0.7),
    }],
    ["shadow-mapping", {
        // The window shows the depth map: grey, white far away.
        "depth-map": c => c.drew && at(c, 200, 300, p => grey(p) && p[0] > 0.5 && p[0] < 0.8) && at(c, 400, 100, p => grey(p) && p[0] > 0.95),
        "shadows": c => c.drew && inShadow(c) && c.hasInShaders("ShadowCalculation"),
        "bias": c => c.drew && inShadow(c) && litFloor(c) && c.hasInShaders("0\\.005"),
        "over-sampling": c => c.drew && inShadow(c) && litFloor(c) && c.hasInShaders("\\.z > 1\\.0") && (c.api === "opengl" ? c.has("GL_CLAMP_TO_BORDER") : c.api === "vulkan" ? c.has("VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER") : c.has("D3D12_TEXTURE_ADDRESS_MODE_BORDER")),
        "pcf": c => c.drew && inShadow(c) && litFloor(c) && c.hasInShaders("textureSize \\(|GetDimensions \\("),
    }],
  ];
}
