import { type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";
import { background } from "./TaskChecks.AdvancedOpenGL3.js";

// Advanced Lighting, round 2: learnopengl's room with point shadows, the normal-mapped brick wall and the
// parallax-mapped bricks – at named points of the 800×600 window, the same pixels in every API.

/** The wood of the room's walls in the light: red well above blue. */

export function litWood(p: Rgba): boolean {
  return p[0] > 0.35 && p[0] > p[2] + 0.1;
}

export function advancedLighting2(): ChapterChecks {
  return [
    ["point-shadows", {
        // The depth cube map shown in grey (distance / far plane), looked up along each fragment's direction.
        "depth-cubemap": c => c.drew && at(c, 400, 300, p => grey(p) && p[0] > 0.1 && p[0] < 0.35) && at(c, 700, 450, p => grey(p) && p[0] > 0.1),
        // The rotated cube's shadow on the wall at the top left; the wall in the middle still lit.
        "shadows": c => c.drew && at(c, 350, 300, litWood) && at(c, 60, 40, p => p[0] < 0.12) && c.hasInShaders("ShadowCalculation"),
        "pcf": c => c.drew && at(c, 350, 300, litWood) && at(c, 60, 40, p => p[0] < 0.15) && c.hasInShaders("gridSamplingDisk"),
    }],
    ["normal-mapping", {
        // The normal map's normals taken as they are: wrong on the rotated wall, the bevels facing up go dark.
        "normal-map": c => c.drew && c.hasInShaders("normalMap") && at(c, 544, 476, p => p[0] < 0.17),
        // Tangents and bitangents from the triangles' edges and UVs: no visible change yet.
        "tangents": c => c.drew && c.has("\\bedge1\\b") && c.has("deltaUV1") && at(c, 544, 476, p => p[0] < 0.17),
        "tbn": c => c.drew && c.hasInShaders("TBN") && at(c, 544, 476, p => p[0] > 0.33),
        // Gram-Schmidt: T made perpendicular to N again – no visible change.
        "gram-schmidt": c => c.drew && c.hasInShaders("dot \\( T , N \\) \\* N") && at(c, 544, 476, p => p[0] > 0.33),
    }],
    ["parallax-mapping", {
        "parallax": c => c.drew && c.hasInShaders("ParallaxMapping") && at(c, 400, 300, p => p[0] > 0.6),
        // Texture coordinates pushed past the quad's edges are thrown away: ragged edges, background there.
        "discard-edges": c => c.drew && c.hasInShaders("\\bdiscard\\b|\\bclip \\(") && at(c, 400, 165, background) && at(c, 400, 300, p => p[0] > 0.4),
        "steep": c => c.drew && c.hasInShaders("numLayers") && at(c, 400, 300, p => p[0] > 0.4),
        // Parallax occlusion mapping: the depths before and after the last layer interpolated.
        "occlusion": c => c.drew && c.hasInShaders("afterDepth|beforeDepth") && at(c, 400, 300, p => p[0] > 0.4),
    }],
  ];
}
