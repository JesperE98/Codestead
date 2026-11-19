import { between } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { inShadow } from "./TaskChecks.AdvancedLighting.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";

// The exercises' checks of advanced-lighting and pbr, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are pixels of the 800×600 window (At), the same place in every API.

export function exercisesAdvancedLightingAndPbr(): Record<string, Checks> {
  return {
    "advanced-lighting": {
        // Only the highlight: a grey spot in front of the camera, the rest of the floor black.
        "ex-specular-only": c => at(c, 400, 530, p => grey(p) && p[0] > 0.2) && at(c, 300, 500, p => p[0] < 0.05) && at(c, 100, 500, p => p[0] < 0.02),
        // A blue light: blue and green above red in the light and in the highlight.
        "ex-blue-light": c => at(c, 450, 440, p => p[2] > p[0] + 0.03 && p[1] > p[0] + 0.03) && at(c, 420, 500, p => p[2] > p[0] + 0.03),
        // The light at (−2, 0, 0): the left of the floor clearly brighter than the right.
        "ex-move-light": c => c.drew && at(c, 130, 390, p => p[0] > 0.25) && at(c, 650, 450, p => p[0] < 0.2),
        // A second light at (−1.5, 0, −1): a bright pool at the back left, and the first light's still there.
        "ex-two-lights": c => at(c, 130, 390, p => p[0] > 0.7) && at(c, 450, 440, p => p[0] > 0.6) && at(c, 700, 550, p => p[0] < 0.45),
    },
    "gamma-correction": {
        // Only the light, grey: white under the lights, grey between them and in front.
        "ex-lighting-only": c => at(c, 450, 430, p => grey(p) && p[0] > 0.6) && at(c, 450, 560, p => grey(p) && p[0] > 0.2) && at(c, 150, 430, p => p[2] > 0.9),
        // Four white lights: the left of the floor as bright as the right (it was dimmer).
        "ex-equal-lights": c => at(c, 150, 430, p => p[0] > 0.9 && p[0] > p[2] + 0.3) && at(c, 30, 470, p => p[0] > 0.5),
        // Encoded by the hardware: the floor as before (not encoded twice), the clear colour 0.1 encoded too (≈ 0.35).
        "ex-hardware-srgb": c => at(c, 400, 100, p => grey(p) && p[0] > 0.3 && p[0] < 0.4) && at(c, 150, 430, p => p[0] > 0.6 && p[0] < 0.8 && p[2] < 0.4),
    },
    "shadow-mapping": {
        // The shadow test as grey: black in the cube's shadow, white on the lit floor.
        "ex-shadow-only": c => at(c, 650, 450, p => p[0] < 0.05) && at(c, 330, 520, p => grey(p) && p[0] > 0.95) && at(c, 750, 560, p => grey(p) && p[0] > 0.95),
        // Half a shadow: between the solution's shadow (≈ 0.06) and the lit floor (≈ 0.23).
        "ex-lighter-shadow": c => at(c, 650, 450, p => p[0] > 0.11 && p[0] < 0.19) && at(c, 560, 440, p => p[0] > 0.11 && p[0] < 0.19) && at(c, 750, 560, p => p[0] > 0.2),
        // The light at (2, 4, −1): the shadow on the left of the floor, the right lit.
        "ex-move-light": c => at(c, 150, 450, p => p[0] < 0.1) && at(c, 200, 450, p => p[0] < 0.1) && at(c, 650, 450, p => p[0] > 0.15) && at(c, 560, 440, p => p[0] > 0.15),
        // A perspective light: the shadow grows, out to the floor's front right corner of the view.
        "ex-perspective-light": c => inShadow(c) && at(c, 700, 480, p => p[0] < 0.08) && at(c, 750, 560, p => p[0] < 0.15) && at(c, 200, 450, p => p[0] > 0.2),
    },
    "point-shadows": {
        // The light moves: the picture at 2.3 s differs from the one at 1 s.
        "ex-animate-light": c => c.drew && c.changesOverTime,
        // Far plane 6: beyond 6 units from the light everything is in shadow (the corners), the middle is lit.
        "ex-far-plane": c => at(c, 780, 580, p => p[0] < 0.08) && at(c, 750, 50, p => p[0] < 0.08) && at(c, 100, 500, p => p[0] < 0.08) && at(c, 350, 300, p => p[0] > 0.4),
        // A sixth cube at (1.5, −1, −2.5): its shadow on the wall at the lower right, the rest of the wall still lit.
        "ex-add-cube": c => at(c, 700, 520, p => p[0] < 0.08) && at(c, 780, 580, p => p[0] < 0.08) && at(c, 100, 500, p => p[0] > 0.18) && at(c, 350, 300, p => p[0] > 0.4),
        // The light near the ceiling: the rotated cube's shadow falls down the middle of the wall; the right is lit.
        "ex-move-light": c => at(c, 264, 300, p => p[0] < 0.1) && at(c, 350, 300, p => p[0] < 0.1) && at(c, 600, 300, p => p[0] > 0.12),
    },
    "normal-mapping": {
        // The normals as colours: the flat brick faces (0, 0, 1) light blue (0.5, 0.5, 1.0).
        "ex-show-normals": c => c.pixelIs(300 / 800.0, 250 / 600.0, 0.5, 0.5, 1.0) && c.pixelIs(480 / 800.0, 180 / 600.0, 0.5, 0.5, 1.0),
        // The surface's own normal: no brick edge turned away from the light, so (almost) no dark pixels; the highlight stays.
        "ex-flat": c => at(c, 480, 180, p => p[0] > 0.85) && c.countPixels(p => p[0] < 0.08) < 60,
        // Three times the tilt: about twice as many dark brick edges as the solution's ≈ 490; the brick faces unchanged.
        "ex-stronger-bumps": c => at(c, 480, 180, p => p[0] > 0.85) && c.countPixels(p => p[0] < 0.08) > 750,
        // The wall turns: the picture changes over time.
        "ex-turn": c => c.drew && c.changesOverTime,
    },
    "parallax-mapping": {
        // The depth map as grey: the mortar white, a brick surface black.
        "ex-show-depth": c => at(c, 400, 350, p => grey(p) && p[0] > 0.7) && at(c, 500, 450, p => grey(p) && p[0] < 0.1),
        // heightScale 0.25: the bricks shifted further (where the solution has a brick, mortar now and the other way round).
        "ex-height-scale": c => at(c, 207, 467, p => p[0] < 0.2) && at(c, 302, 387, p => p[0] < 0.3) && at(c, 237, 372, p => p[0] > 0.5),
        // No discard: bricks where the solution shows the background at the quad's edges.
        "ex-no-discard": c => c.drawnAt(642 / 800.0, 307 / 600.0) && c.drawnAt(142 / 800.0, 392 / 600.0) && c.drawnAt(467 / 800.0, 177 / 600.0),
        // −70°: a flatter, lower quad – the middle drawn, the solution's lower and upper parts now background.
        "ex-steeper": c => c.drawnAt(0.5, 350 / 600.0) && c.isClear(500 / 800.0, 450 / 600.0) && c.isClear(0.5, 170 / 600.0),
    },
    "hdr": {
        // Exposure 0.1: the far end no longer white (the wood's colour), the walls next to it dark.
        "ex-low-exposure": c => at(c, 400, 300, p => p[0] > 0.7 && p[0] < 0.9 && p[2] < 0.5) && at(c, 350, 300, p => p[0] < 0.4),
        // A red light of 5: the walls near the camera clearly red at the bottom right.
        "ex-red-light": c => at(c, 700, 550, p => p[0] > 0.35 && p[1] < 0.1) && at(c, 400, 300, p => p[0] > 0.95),
        // ACES: more contrast – the glow round the far end brighter, the dim walls darker than with the exposure curve.
        "ex-aces": c => at(c, 350, 300, p => p[0] > 0.8) && at(c, 250, 300, p => p[0] < 0.09) && at(c, 400, 300, p => p[0] > 0.95),
    },
    "bloom": {
        // Twice the bloom: a brighter halo under the white light cube and beside it (but not the 30-pass spread).
        "ex-bloom-strength": c => at(c, 400, 280, p => p[0] > 0.6) && at(c, 500, 190, p => p[0] > 0.22 && p[0] < 0.4),
        // Threshold 3: the lit box edges and floor stop glowing – more black pixels; the white light cube still glows.
        "ex-threshold": c => at(c, 400, 190, p => p[0] > 0.95) && at(c, 400, 280, p => grey(p) && p[0] > 0.4) && c.countPixels(p => p[0] + p[1] + p[2] < 0.03) > 5900,
        // 30 blur passes: the glow reaches much further from the white light cube.
        "ex-wider-blur": c => at(c, 500, 190, p => p[0] > 0.45) && at(c, 300, 190, p => p[0] > 0.6),
        // An orange light: the halo under it and the floor in its light orange instead of white.
        "ex-orange-light": c => at(c, 400, 280, p => p[0] > p[2] + 0.25) && at(c, 400, 100, p => p[0] > p[2] + 0.3) && at(c, 400, 190, p => p[0] > 0.95),
    },
    "deferred-shading": {
        // The normals as colours: a box's top (0, 1, 0) green, a front (0, 0, 1) blue.
        "ex-show-normals": c => c.pixelIs(0.5, 0.5, 0.5, 1.0, 0.5) && c.pixelIs(700 / 800.0, 420 / 600.0, 0.5, 0.5, 1.0),
        // The specular map as grey: the steel frame light, the wood dark.
        "ex-show-specular": c => at(c, 400, 300, p => grey(p) && p[0] > 0.7) && at(c, 700, 420, p => grey(p) && p[0] < 0.12) && at(c, 400, 160, p => grey(p) && p[0] < 0.12),
        // Lights that reach further: the lit box tops close to white.
        "ex-reach": c => at(c, 400, 300, p => p[0] > 0.9) && at(c, 400, 160, p => p[0] > 0.9),
        // Warm lights: the steel frame and the wood lit orange, not white.
        "ex-warm-lights": c => at(c, 400, 300, p => p[0] > p[2] + 0.1 && p[0] > 0.18) && at(c, 400, 160, p => p[0] > p[2] + 0.2),
    },
    "ssao": {
        // A warm light: the wall near the light orange instead of blue.
        "ex-warm-light": c => at(c, 520, 40, p => p[0] > p[2] + 0.3) && at(c, 400, 500, p => p[0] > p[2] + 0.1),
        // Only ambient × AO: grey everywhere, darker under the planet than on the open floor.
        "ex-ambient-only": c => at(c, 520, 40, p => grey(p) && p[0] < 0.32) && at(c, 470, 110, p => grey(p)) && at(c, 400, 376, p => grey(p) && p[0] < 0.23) && at(c, 400, 500, p => grey(p) && p[0] > 0.26),
        // Radius 1.5: darker floor under the planet, the ring in front of it lighter than in the solution.
        "ex-radius": c => at(c, 400, 376, p => p[0] < 0.25) && at(c, 400, 190, p => p[0] > 0.25 && p[2] > p[0]),
        // AO to the power 3: the ring in front of the planet and the floor under it much darker.
        "ex-ao-power": c => at(c, 400, 190, p => p[0] < 0.18) && at(c, 400, 376, p => p[0] < 0.25) && at(c, 520, 40, p => p[2] > 0.7),
    },
    "pbr-theory": {
        // metallic as red (rows, growing upwards), roughness as green (columns, growing to the right).
        "ex-parameters": c => at(c, 153, 53, p => p[0] > 0.8 && p[1] < 0.1 && p[2] < 0.02) && at(c, 647, 547, p => p[0] < 0.02 && p[1] > 0.8) && at(c, 400, 300, p => Math.abs(p[0] - 0.43) < 0.03 && Math.abs(p[1] - 0.43) < 0.03),
        // N · V as grey: white in a sphere's middle, black at its rim.
        "ex-n-dot-v": c => at(c, 400, 300, p => grey(p) && p[0] > 0.95) && at(c, 425, 300, p => grey(p) && p[0] > 0.4 && p[0] < 0.65) && at(c, 430, 300, p => grey(p) && p[0] < 0.1),
        // Fresnel: a dielectric 0.04 where it faces the camera, a metal its red albedo; every rim near white.
        "ex-fresnel": c => c.pixelIs(153 / 800.0, 547 / 600.0, 0.04, 0.04, 0.04) && at(c, 153, 53, p => p[0] > 0.4 && p[1] < 0.02) && at(c, 430, 300, p => p[0] > 0.7 && p[1] > 0.7),
    },
    "pbr-lighting": {
        // A red light top left and a blue one top right: the middle sphere's left highlight red, its right one blue.
        "ex-light-colours": c => at(c, 370, 270, p => p[0] > p[2] + 0.2) && at(c, 430, 270, p => p[2] > p[0] + 0.2),
        // Only the specular term: the rust (not metal) loses its colour, the metal's highlights stay.
        "ex-specular-only": c => at(c, 370, 270, p => p[0] > 0.85) && c.countPixels(p => p[0] > p[1] + 0.08) < 60 && at(c, 652, 552, p => p[0] < 0.3),
        // Gold: every sphere yellow, the highlights too.
        "ex-gold": c => at(c, 150, 100, p => p[0] > p[2] + 0.15 && p[1] > p[2] + 0.1) && at(c, 400, 500, p => p[0] > p[2] + 0.15 && p[1] > p[2] + 0.1) && at(c, 370, 270, p => p[0] > 0.9 && p[2] < p[0] - 0.05),
        // Roughness × 0.4: the highlight brighter, the metal away from it darker.
        "ex-polished": c => at(c, 370, 270, p => p[0] > 0.9) && at(c, 150, 100, p => p[0] < 0.3) && at(c, 400, 500, p => p[0] < 0.3),
    },
    "diffuse-irradiance": {
        // Light grey spheres: no longer red, bright where the non-metals catch the environment's light.
        "ex-white-spheres": c => at(c, 153, 547, p => p[0] > 0.75 && Math.abs(p[0] - p[1]) < 0.03) && at(c, 400, 300, p => p[0] > 0.55 && Math.abs(p[0] - p[2]) < 0.04),
        // No point lights: the white highlights gone (no green or blue left), the environment still lights the spheres.
        "ex-no-lights": c => at(c, 411, 288, p => p[1] < 0.02 && p[0] > 0.4) && at(c, 153, 547, p => p[0] > 0.55) && at(c, 400, 300, p => p[1] < 0.02),
        // sampleDelta 0.6: blotchy irradiance – some sphere points darker, others brighter than with 0.1.
        "ex-coarse-convolution": c => at(c, 153, 530, p => p[0] < 0.71) && at(c, 400, 300, p => p[0] < 0.53 && p[1] > 0.05) && at(c, 312, 187, p => p[0] > 0.6),
    },
    "specular-ibl": {
        // Chrome: no rust left, the spheres mirror the blue-grey sky (more sky-coloured pixels), nothing dark.
        "ex-chrome": c => c.drew && c.countPixels(p => p[0] > p[1] + 0.08) < 400 && c.countPixels(p => p[2] > p[0] + 0.12 && p[2] > 0.55) > 2100 && c.countPixels(p => p[0] + p[1] + p[2] < 0.6) < 50,
        // Only the IBL reflection: the rust's diffuse colour gone, many dark parts – but not as dark as the bare environment BRDF.
        "ex-reflections-only": c => c.drew && c.countPixels(p => p[0] > p[1] + 0.08) < 800 && between(c.countPixels(p => p[0] + p[1] + p[2] < 0.6), 1000, 2500) && c.countPixels(p => p[2] > p[0] + 0.12 && p[2] > 0.55) > 1200,
        // The environment BRDF without tone mapping: dark spheres, brighter only towards the rims, nothing near white.
        "ex-env-brdf": c => c.drew && c.countPixels(p => p[0] + p[1] + p[2] < 0.6) > 2600 && c.countPixels(p => p[0] > 0.8) < 5,
        // Mip level 0 everywhere: sharp bright and dark reflections where the solution has soft rust.
        "ex-sharp-lod": c => at(c, 132, 342, p => p[0] > 0.85) && at(c, 162, 167, p => p[0] > 0.85) && at(c, 322, 292, p => p[0] < 0.3) && c.countPixels(p => p[0] > p[1] + 0.08) > 1500,
    },
  };
}
