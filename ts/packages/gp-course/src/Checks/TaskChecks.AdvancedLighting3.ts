import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";

// Advanced Lighting, round 3: learnopengl's HDR tunnel and its bloom scene – at named points of the 800×600 window, the
// same pixels in every API.

export function advancedLighting3(): ChapterChecks {
  return [
    ["hdr", {
        // The scene in a floating-point target, shown without tone mapping: no visible change, the end still white.
        "float-buffer": c => c.drew && at(c, 400, 300, p => p[2] > 0.97) && (c.api === "opengl" ? c.has("GL_RGBA16F") : c.api === "vulkan" ? c.has("VK_FORMAT_R16G16B16A16_SFLOAT") : c.has("DXGI_FORMAT_R16G16B16A16_FLOAT")),
        // Reinhard: the bright end of the tunnel shows its boards (no longer white).
        "reinhard": c => c.drew && at(c, 400, 300, p => p[2] > 0.7 && p[2] < 0.82),
        // Exposure tone mapping (exposure 1.0): brighter than Reinhard, still not white.
        "exposure": c => c.drew && c.hasInShaders("\\bexp \\(") && at(c, 400, 300, p => p[2] > 0.82 && p[2] < 0.95),
    }],
    ["bloom", {
        // The second render target: only what is brighter than 1.0 – the white light cube; the box above it black.
        "bright-pass": c => c.drew && at(c, 400, 200, p => p[0] > 0.9) && at(c, 400, 60, p => p[0] < 0.05),
        // The bright parts blurred: a glow beside the white cube, the rest still black.
        "blur": c => c.drew && at(c, 465, 200, p => p[0] > 0.12) && at(c, 400, 60, p => p[0] < 0.05),
        // The scene and the blurred bright parts together: the boxes back, the lights glowing into the dark.
        "combine": c => c.drew && at(c, 400, 60, p => p[0] > 0.5) && at(c, 480, 130, p => p[0] > 0.35),
    }],
  ];
}
