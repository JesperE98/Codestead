import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";

// Advanced Lighting, round 4: deferred shading of the nine boxes with 32 lights, and SSAO around the planet in a room –
// at named points of the 800×600 window, the same pixels in every API.

export function advancedLighting4(): ChapterChecks {
  return [
    ["deferred-shading", {
        // The G-buffer's albedo on the screen quad: every face equally bright, unlit (the dark front face too).
        "g-buffer": c => c.drew && at(c, 400, 440, p => p[0] > 0.45) && at(c, 400, 50, p => p[0] < 0.05),
        // The lighting pass from the G-buffer: the same picture as forward rendering (the front face dark again).
        "lighting-pass": c => c.drew && at(c, 400, 440, p => p[0] < 0.12) && at(c, 400, 280, p => p[0] > 0.2) && c.hasInShaders("gAlbedoSpec"),
        // The light cubes, forward-rendered in their colours over the deferred picture.
        "light-cubes": c => c.drew && at(c, 609, 233, p => p[0] > 0.8 && p[2] > 0.45),
        "light-volumes": c => c.drew && at(c, 609, 233, p => p[0] > 0.8 && p[2] > 0.45) && c.hasInShaders("\\bRadius\\b|\\bradius\\b") && c.has("maxBrightness"),
    }],
    ["ssao", {
        // The raw occlusion shown in grey: the contact shadow under the planet grey, the open floor white.
        "kernel": c => c.drew && at(c, 400, 376, p => grey(p) && p[0] < 0.85) && at(c, 400, 500, p => p[0] > 0.9),
        // Blurred: still grey, the 4 × 4 noise pattern smoothed away.
        "blur": c => c.drew && at(c, 400, 376, p => grey(p) && p[0] < 0.85) && at(c, 400, 500, p => p[0] > 0.9) && c.has("(?i)ssao_?blur"),
        // The lit scene with the ambient light darkened by the occlusion: the floor under the planet darker (start 93,93,144).
        "apply": c => c.drew && at(c, 400, 376, p => p[2] > p[0] + 0.1 && p[0] < 0.32) && at(c, 400, 500, p => p[2] > p[0] + 0.1),
    }],
  ];
}
