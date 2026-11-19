import { type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";

// PBR: learnopengl's 7 × 7 spheres (rows metallic, columns roughness) lit by four lights, then by the environment
// (diffuse irradiance, specular IBL), and the course's riveted steel material – at named points of the 800×600 window,
// the same pixels in every API (see projects/opengl/<chapter>/tasks.md for the values measured there).

/** A grey, unlit-by-colour pixel of the steel: bright, red ≈ blue. */

export function steel(p: Rgba): boolean {
  return p[0] > 0.65 && Math.abs(p[0] - p[2]) < 0.07;
}

/** Rust: orange-brown, red well above blue. */

export function rust(p: Rgba, min: number, max: number): boolean {
  return p[0] > min && p[0] < max && p[0] > p[2] + 0.15;
}

/** The environment's sky: blue above red. */

export function sky(p: Rgba): boolean {
  return p[2] > 0.65 && p[2] > p[0] + 0.03;
}

export function pbr(): ChapterChecks {
  return [
    ["pbr-lighting", {
        // Lambert only: matt red spheres, all alike, brighter towards the grid's corners.
        "lambert": c => c.drew && at(c, 400, 300, p => p[0] > 0.3 && p[0] < 0.46 && p[1] < 0.05) && at(c, 153, 547, p => p[0] > 0.47 && p[0] < 0.63 && p[1] < 0.05),
        // The NDF alone as the specular term: the roughest spheres turn white, the smooth ones keep their red centre.
        "ndf": c => c.drew && at(c, 647, 547, p => p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95) && at(c, 153, 547, p => p[0] > 0.47 && p[1] < 0.05),
        // NDF · G / (4 NdotV NdotL): the rough spheres pink instead of white.
        "geometry": c => c.drew && at(c, 647, 547, p => p[0] > 0.95 && p[1] > 0.3 && p[1] < 0.63),
        // The whole reflectance equation: the metal rows lose their diffuse light (the top left sphere dark).
        "fresnel": c => c.drew && at(c, 153, 53, p => p[0] < 0.12) && at(c, 153, 547, p => p[0] > 0.45 && p[1] < 0.05),
        // Reinhard and gamma: brighter, softer spheres.
        "tone-map": c => c.drew && at(c, 153, 53, p => p[0] > 0.2 && p[0] < 0.34) && at(c, 153, 547, p => p[0] > 0.55 && p[0] < 0.7),
        // The material from the maps: grey steel and orange rust on the centre sphere, the clear colour around.
        "textured": c => c.drew && c.hasInShaders("albedoMap") && at(c, 377, 327, steel) && at(c, 450, 330, p => rust(p, 0.33, 0.56)) && at(c, 20, 20, p => p[0] < 0.15),
    }],
    ["diffuse-irradiance", {
        // The environment cube map as the background: sky above, ground below; the spheres unchanged.
        "environment-map": c => c.drew && at(c, 60, 60, sky) && at(c, 60, 500, p => p[0] > 0.33 && p[0] < 0.5 && p[0] > p[2]) && at(c, 400, 300, p => p[0] > 0.4 && p[0] < 0.5),
        // The irradiance map as the background: a soft pale blur, the dark hills gone.
        "irradiance-map": c => c.drew && at(c, 60, 270, p => p[0] > 0.55 && p[1] > 0.55) && at(c, 60, 500, p => p[0] > 0.52),
        // The ambient light from the irradiance map: the non-metal spheres brighter; the sharp environment behind.
        "ambient": c => c.drew && at(c, 60, 270, p => p[0] < 0.32 && p[1] > p[0]) && at(c, 153, 547, p => p[0] > 0.69 && p[1] < 0.05),
    }],
    ["specular-ibl", {
        // The pre-filtered map at mip level 1.2 as the background: blurred, the orange lamp's glow at the bottom left.
        "prefilter-map": c => c.drew && at(c, 20, 560, p => p[0] > 0.72 && p[0] > p[2] + 0.1) && at(c, 60, 270, p => p[0] > 0.55),
        // The BRDF look-up texture on the screen: red at the bottom right, green at the bottom left, no blue.
        "brdf-lut": c => c.drew && at(c, 760, 570, p => p[0] > 0.93 && p[1] < 0.05 && p[2] < 0.05) && at(c, 30, 580, p => p[1] > 0.7 && p[2] < 0.05) && at(c, 760, 30, p => p[0] > 0.28 && p[0] < 0.46),
        // The split sum: the spheres reflect the environment (green and blue on the smooth ones), the sky behind them.
        "specular": c => c.drew && at(c, 153, 547, p => p[1] > 0.15 && p[2] > 0.15) && at(c, 60, 60, sky),
        // The material from the maps, lit by the environment: steel and rust in front of the sky.
        "textured": c => c.drew && c.hasInShaders("albedoMap") && at(c, 377, 327, steel) && at(c, 450, 330, p => rust(p, 0.46, 0.7)) && at(c, 20, 20, sky),
    }],
  ];
}
