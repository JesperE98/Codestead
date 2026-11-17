import { Apis } from "@codestead/gp-gpu";
import { between, type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at, grey } from "./TaskChecks.AdvancedOpenGL.js";
import { bloomWhite, csmShadow, csmWood, half, oitRed, planet, planetGrid, space } from "./TaskChecks.GuestArticles.js";
import { greyOf, ground, rg, tentacle } from "./TaskChecks.GuestArticles2.js";
import { black, teal } from "./TaskChecks.InPractice.js";

// The exercises' checks of guest-articles, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are pixels of the 800×600 window from the top left (the same
// place in every API), as in the chapters' own checks (TaskChecks.GuestArticles*.cs).

/** A colour within ±0.04 per channel. */

export function guestRgb(p: Rgba, r: number, g: number, b: number, tolerance = 0.04): boolean {
  return Math.abs(p[0] - r) <= tolerance && Math.abs(p[1] - g) <= tolerance && Math.abs(p[2] - b) <= tolerance;
}

/** The frustum culling demo's counts in the window title at 2.0 s ("… drawn: 37 / 101"); (-1, -1) when missing. */
export function guestDrawn(c: CheckContext): { drawn: number; total: number } {
  const m = /drawn:\s*(\d+)\s*\/\s*(\d+)/.exec(c.windowTitleAt(2.0));
  return m !== null ? { drawn: parseInt(m[1]!, 10), total: parseInt(m[2]!, 10) } : { drawn: -1, total: -1 };
}

/** GuestWater: clearly blue, more green than red. */

export function guestWater(p: Rgba): boolean {
  return p[2] > p[1] + 0.15 && p[1] > p[0];
}

export function exercisesGuestArticles(): Record<string, Checks> {
  return {
    "oit-introduction": {
        // The green quad at 0.8: brighter over black, and the red mostly hidden under it.
        "ex-opacity": c => c.drew && at(c, 200, 450, p => guestRgb(p, 0, 0.8, 0)) && at(c, 450, 400, p => guestRgb(p, 0.2, 0.8, 0)) && at(c, 620, 300, oitRed),
        // Back to front: the blue corner shows through the green quad (green over blue over black).
        "ex-sorted": c => c.drew && at(c, 230, 300, p => guestRgb(p, 0, 0.5, 0.25)) && at(c, 200, 450, p => half(p, 1)) && at(c, 400, 180, oitRed),
        // No depth writes, the wrong order kept: the blue quad blended over the green one, as if it were in front.
        "ex-depth-mask": c => c.drew && at(c, 230, 300, p => guestRgb(p, 0, 0.25, 0.5)) && at(c, 200, 450, p => half(p, 1)) && at(c, 400, 180, oitRed),
    },
    "weighted-blended": {
        // The green quad at 0.8: 0,204,0 over black, and it outweighs the blue one where they overlap (0,141,88).
        "ex-opacity": c => c.drew && at(c, 200, 450, p => guestRgb(p, 0, 0.8, 0)) && at(c, 230, 300, p => guestRgb(p, 0, 0.55, 0.35)) && at(c, 620, 300, oitRed),
        // Blue drawn before green: the same picture as the chapter's (overlap 0,96,96) – order independent.
        "ex-order": c => c.drew && at(c, 230, 300, p => guestRgb(p, 0, 0.376, 0.376)) && at(c, 200, 450, p => half(p, 1)) && at(c, 250, 120, p => half(p, 2)) && (c.api === Apis.OpenGL ? c.has("vp \\* blueModelMat \\)[\\s\\S]*vp \\* greenModelMat \\)") : c.api === Apis.Vulkan ? c.has("vp \\* blueModelMat ;[\\s\\S]*vp \\* greenModelMat ;") : c.has("XMLoadFloat4x4 \\( & m_blueModelMat \\)[\\s\\S]*XMLoadFloat4x4 \\( & m_greenModelMat \\)")),
        // The red quad half transparent with the others: 128,0,0 alone, and the blue quad shows behind it (96,0,96).
        "ex-red-transparent": c => c.drew && at(c, 620, 300, p => half(p, 0)) && at(c, 400, 180, p => guestRgb(p, 0.376, 0, 0.376)) && at(c, 450, 400, p => guestRgb(p, 0.376, 0.376, 0)),
        // A weight that is larger near the camera: the green quad (nearer) counts more than the blue one where they overlap.
        "ex-weight": c => c.drew && at(c, 230, 300, p => p[0] < 0.03 && p[1] > p[2] + 0.06 && p[1] + p[2] > 0.6) && at(c, 200, 450, p => half(p, 1)) && at(c, 250, 120, p => half(p, 2)),
    },
    "skeletal-animation": {
        // Half speed: at 2.5 s the animation is at 1.25 s (leaning right; the chapter's is at 0.5 s, leaning left), at 0.5 s at 0.25 s.
        "ex-slow-motion": c => c.drew && at(c, 2.5, 568, 100, tentacle) && at(c, 2.5, 460, 300, tentacle) && at(c, 2.5, 230, 100, space) && at(c, 2.5, 400, 200, space)
            && at(c, 0.5, 230, 100, tentacle) && at(c, 0.5, 568, 100, space),
        // The pose of 1.25 s, standing still: leaning right at 0.25 s too.
        "ex-freeze-pose": c => c.drew && [0.25, 1.25].every((t) => at(c, t, 568, 100, tentacle) && at(c, t, 460, 300, tentacle) && at(c, t, 230, 100, space) && at(c, t, 400, 200, space)),
        // The base bone kept in its rest pose: the tentacle sways less far (the tip at x 490..530 at 1.25 s, 265..305 at 0.25 s).
        "ex-still-base": c => c.drew && at(c, 1.25, 510, 100, tentacle) && at(c, 1.25, 568, 100, space) && at(c, 1.25, 400, 200, space)
            && at(c, 0.25, 285, 100, tentacle) && at(c, 0.25, 230, 100, space),
        // The Upper bone's weight as red: bright in the middle of the tube, black at the foot and the tip.
        "ex-bone-weight": c => c.drew && at(c, 1.25, 460, 300, p => p[0] > 0.85 && p[1] < 0.03 && p[2] < 0.03) && at(c, 1.25, 460, 250, p => p[0] > 0.4 && p[0] < 0.8 && p[1] < 0.03)
            && at(c, 1.25, 400, 520, black) && at(c, 1.25, 568, 100, black) && at(c, 1.25, 100, 300, space),
    },
    "scene-graph": {
        // Turned the other way: at 2.0 s the chain comes out of the screen, down to the right.
        "ex-reverse": c => c.shows && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 380, 380, planet) && at(c, 2.0, 490, 435, planet) && at(c, 2.0, 575, 465, planet)
            && at(c, 2.0, 385, 273, space) && at(c, 2.0, 456, 250, space),
        // Children 0.8 times their parent: larger and farther apart (the positions are scaled too), the chain reaching x ≈ 690.
        "ex-child-scale": c => c.shows && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 475, 240, planet) && at(c, 2.0, 650, 180, planet) && at(c, 2.0, 600, 500, space),
        // A second child of the root, high above it; the chain as before.
        "ex-moon": c => c.shows && at(c, 2.0, 222, 185, planet) && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 385, 273, planet) && at(c, 2.0, 456, 250, planet) && at(c, 2.0, 222, 230, space),
        // Every child tilted 30° about z on top of its parent: the chain curls upwards.
        "ex-spiral": c => c.shows && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 450, 207, planet) && at(c, 2.0, 468, 152, planet)
            && at(c, 2.0, 456, 250, space) && at(c, 2.0, 494, 238, space),
    },
    "frustum-culling": {
        // A 30° culling frustum inside the camera's 45°: the top of the grid (far42) culled, fewer than 38 drawn (26).
        "ex-narrow-fov": c => c.shows && ((d) => between(d.drawn, 10, 38) && d.total === 101)(guestDrawn(c)) && at(c, 2.0, 396, 76, space)
            && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 429, 327, planet) && at(c, 2.0, 680, 459, planet),
        // The near plane at 12: the planets close to the camera (near, and the one at the bottom left) culled (35 drawn).
        "ex-near-plane": c => c.shows && ((d) => between(d.drawn, 10, 38) && d.total === 101)(guestDrawn(c)) && at(c, 2.0, 680, 459, space) && at(c, 2.0, 165, 430, space)
            && at(c, 2.0, 238, 320, planet) && at(c, 2.0, 429, 327, planet) && at(c, 2.0, 396, 76, planet),
        // 12 × 12 children around the root: 145 entities, more of them drawn (49), the old grid still there.
        "ex-bigger-grid": c => c.shows && ((d) => d.drawn > 38 && d.total === 145)(guestDrawn(c)) && planetGrid(c) && at(c, 2.0, 238, 320, planet),
    },
    "csm": {
        // Half the direct light in shadow: the shadows (17,11,7 before) about 41,28,17, the lit floor as before.
        "ex-half-shadow": c => c.drew && [[490, 475], [290, 273], [155, 335]].every(([x, y]) => at(c, x!, y!, p => p[0] > 0.11 && p[0] < 0.2 && p[0] > p[1] && p[1] > p[2]))
            && at(c, 650, 470, csmWood) && at(c, 480, 230, csmWood),
        // The light from the left: the shadows fall to the right – the old shadow spots lit, the floor at (650,470) in shadow.
        "ex-sun-left": c => c.drew && at(c, 650, 470, csmShadow) && at(c, 640, 460, csmShadow) && at(c, 490, 475, csmWood) && at(c, 155, 335, csmWood) && at(c, 480, 230, csmWood),
        // Layer 0 of the shadow maps: light grey everywhere (nothing white as in layer 2), the cubes a little darker.
        "ex-debug-layer": c => c.drew && at(c, 400, 40, p => grey(p) && p[0] > 0.88 && p[0] < 0.95) && at(c, 650, 470, p => grey(p) && p[0] > 0.84 && p[0] < 0.9)
            && at(c, 520, 400, p => grey(p) && p[0] < 0.86),
    },
    "tessellation-height-map": {
        // Half the height: the peaks no longer reach y = 110, and the greys (from the height) darker – the centre 37 instead of 90.
        "ex-flatter": c => c.drew && at(c, 420, 110, ground) && at(c, 420, 160, p => greyOf(p, 93, 15)) && at(c, 400, 300, p => greyOf(p, 37, 10))
            && at(c, 230, 150, p => greyOf(p, 99, 15)) && at(c, 400, 560, ground),
        // Blue below a water level: the lake and the river blue, the hills and the peaks grey as before.
        "ex-water": c => c.drew && at(c, 580, 390, guestWater) && at(c, 420, 410, guestWater) && at(c, 420, 110, p => greyOf(p, 212, 12))
            && at(c, 400, 300, p => greyOf(p, 90)) && at(c, 150, 380, p => greyOf(p, 102)),
        // Only the first half of the strips (the back half of the terrain): the peaks there, the front gone.
        "ex-back-half": c => c.drew && at(c, 420, 110, p => greyOf(p, 212, 12)) && at(c, 230, 150, p => greyOf(p, 142)) && at(c, 420, 160, p => greyOf(p, 128))
            && at(c, 400, 300, ground) && at(c, 580, 390, ground) && at(c, 150, 380, ground),
    },
    "tessellation": {
        // Filled again: no gaps between the lines in either box of the full-size frame, the terrain's greys.
        "ex-solid": c => c.drew && c.coveredIn(300, 400, 499, 449, /* fullSize: */ true) > 0.99 && c.coveredIn(250, 150, 449, 199, /* fullSize: */ true) > 0.99
            && at(c, 420, 110, p => greyOf(p, 212, 12)) && at(c, 400, 300, p => greyOf(p, 90)) && at(c, 400, 40, ground),
        // Level 16 near the camera: the front box almost solid with lines (96 %, was 73 %), the back still open.
        "ex-max-level": c => c.drew && c.coveredIn(300, 400, 499, 449, /* fullSize: */ true) > 0.88 && between(c.coveredIn(250, 150, 449, 199, /* fullSize: */ true), 0.3, 0.8)
            && at(c, 400, 40, ground) && at(c, 400, 560, ground),
        // Displaced twice as far: the peaks reach up to y ≈ 40 (the greys from the height unchanged).
        "ex-taller": c => c.drew && at(c, 420, 75, p => !ground(p)) && at(c, 262, 60, p => !ground(p)) && at(c, 580, 390, p => greyOf(p, 28, 6)) && at(c, 400, 560, ground),
    },
    "dsa": {
        // The second triangle overwritten in the index buffer: the lower left half of the rectangle gone (every API).
        "ex-one-triangle": c => c.drew && at(c, 250, 400, teal) && at(c, 230, 180, teal) && at(c, 550, 200, p => !teal(p)) && at(c, 570, 420, p => !teal(p)),
        // Texture coordinates 0..2 with GL_REPEAT: four containers, a bolt at the top left of each.
        "ex-tile": c => c.drew && [[209, 157], [409, 157], [209, 307], [409, 307]].every(([x, y]) => at(c, x!, y!, p => p[0] > 0.65 && Math.abs(p[0] - p[1]) < 0.05))
            && at(c, 218, 163, p => p[0] > p[2] + 0.15) && at(c, 100, 100, teal),
        // Colours from a second buffer on binding point 1: the corners red, green and blue over the wood.
        "ex-colour-buffer": c => c.drew && at(c, 570, 175, p => p[0] > p[1] + 0.2 && p[0] > p[2] + 0.2) && at(c, 570, 425, p => p[1] > p[0] + 0.1 && p[1] > p[2] + 0.1)
            && at(c, 230, 425, p => p[2] > p[0] + 0.05 && p[2] > p[1] + 0.03) && at(c, 100, 100, teal),
    },
    "physically-based-bloom": {
        // Bloom mixed in at 0.15: the glow beside the light cubes much brighter (186 instead of 113), the background lit.
        "ex-strength": c => c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => grey(p) && p[0] > 0.65 && p[0] < 0.85)
            && at(c, 520, 200, p => p[0] > 0.33) && at(c, 600, 100, p => p[0] > 0.12),
        // A filter radius of 0.05: the same strength near the cube, but the glow reaches farther out.
        "ex-radius": c => c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => grey(p) && p[0] > 0.38 && p[0] < 0.55)
            && at(c, 490, 200, p => p[0] > 0.35 && p[0] < 0.5) && at(c, 520, 200, p => p[0] > 0.25 && p[0] < 0.33) && at(c, 600, 100, p => p[0] > 0.1 && p[0] < 0.14),
        // Only two levels: the glow stays close to the cubes, the background black.
        "ex-short-chain": c => c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => grey(p) && p[0] > 0.1 && p[0] < 0.3)
            && at(c, 520, 200, black) && at(c, 600, 100, black),
        // The bloom tinted orange before it is mixed in: a warm glow beside the white light cube.
        "ex-warm-glow": c => c.drew && at(c, 400, 200, bloomWhite) && at(c, 465, 200, p => p[0] > p[1] + 0.05 && p[1] > p[2] + 0.05 && p[0] > 0.35)
            && at(c, 400, 262, p => p[0] > p[2] + 0.12),
    },
    "compute-shaders": {
        // 200 texels per second: at 1.0 s moved by 200 – the brightest red at x = 599, from 0 again at x = 600.
        "ex-speed": c => c.drew && at(c, 599, 300, p => rg(p, 1, 0.5)) && at(c, 600, 300, p => rg(p, 0, 0.5)) && at(c, 0, 0, p => rg(p, 0.25, 1)),
        // A white disc of radius 100 around the texture's centre, the gradient around it.
        "ex-disc": c => c.drew && [[400, 299], [330, 299], [405, 305], [400, 220]].every(([x, y]) => at(c, x!, y!, p => p[0] > 0.97 && p[1] > 0.97 && p[2] > 0.97))
            && at(c, 400, 150, p => p[2] < 0.03) && at(c, 600, 300, p => p[2] < 0.03),
        // Blue in every other work group: a checkerboard of 10 × 10 squares over the gradient.
        "ex-work-groups": c => c.drew && at(c, 5, 594, p => p[2] < 0.03) && at(c, 15, 594, p => p[2] > 0.97) && at(c, 5, 584, p => p[2] > 0.97) && at(c, 15, 584, p => p[2] < 0.03)
            && at(c, 400, 299, p => rg(p, 0.625, 0.5)) && at(c, 0, 0, p => p[1] > 0.97),
    },
    "area-lights": {
        // Intensity 4 for every light: the whole floor brighter (the lit floor in front about 1.4 times), the rectangles as before.
        "ex-intensity": c => c.drew && at(c, 400, 450, p => p[0] > 0.54) && at(c, 240, 170, p => p[1] > 0.48) && at(c, 700, 250, p => p[0] > 0.4)
            && at(c, 680, 190, p => p[0] > 0.95 && p[1] > 0.45 && p[1] < 0.65),
        // Roughness 0.15: sharper, brighter reflections of the lights in the floor beyond the ring's middle; the rest as before.
        "ex-roughness": c => c.drew && at(c, 400, 140, p => p[1] > 0.47 && p[1] > p[0]) && at(c, 240, 170, p => p[1] > 0.47 && p[2] > 0.4)
            && at(c, 700, 250, p => p[0] > 0.25 && p[0] < 0.38) && at(c, 400, 90, p => p[1] > 0.95),
        // Light 0 red: its rectangle pure red and the floor in front of it lit red.
        "ex-red-light": c => c.drew && at(c, 680, 190, p => p[0] > 0.95 && p[1] < 0.05 && p[2] < 0.05) && at(c, 700, 250, p => p[0] > p[1] + 0.2 && p[1] < 0.1)
            && at(c, 400, 90, p => p[1] > 0.95 && p[0] > 0.45 && p[0] < 0.65),
        // One-sided lights, all facing the middle: the floor outside the ring dark, inside lit as before.
        "ex-one-sided": c => c.drew && at(c, 400, 450, p => p[0] < 0.12) && at(c, 50, 330, p => p[0] < 0.08) && at(c, 700, 250, p => p[0] < 0.12)
            && at(c, 240, 170, p => p[1] > 0.35) && at(c, 680, 190, p => p[0] > 0.95 && p[1] > 0.45 && p[1] < 0.65),
    },
  };
}
