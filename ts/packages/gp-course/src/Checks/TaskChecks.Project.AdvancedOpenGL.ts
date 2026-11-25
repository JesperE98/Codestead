import { CompareFunc, type DrawCall } from "@codestead/gp-gpu";
import { given, type CheckContext, type Rgba } from "../CheckContext.js";
import type { Checks } from "./TaskChecks.PerApi.js";

// The optional project after Advanced OpenGL, "The glass pavilion": it starts from the Framebuffers chapter's program
// (two marble sculptures on a metal floor, drawn into an off-screen target and shown through a screen quad with the
// edge-detection kernel) and adds a vignette, the cube map sky, a colonnade, a stencil outline and a glass pane.
// Window pixels of the 800×600 picture, the same in every API: the selected sculpture (cube 0) covers x ≈ 90..320,
// y ≈ 196..403; its outline is about 10 px wide around it; the glass pane covers x ≈ 468..694, y ≈ 187..413; the
// columns stand behind, at x ≈ 165..220, 375..425, 580..635 (and cut off at the edges), from y ≈ 32 down.
// What the picture cannot show (that the sky is drawn last, one instanced draw, the stencil test, blending) is read
// from the draws the program makes.

/** The window pixel (800×600) at 1 s. */
const at = (c: CheckContext, x: number, y: number, test: (p: Rgba) => boolean): boolean => given(c.pixel(x / 800, y / 600), test);

/** Some pixel of a window row (x0…x1, every 5 px: one pixel of the check frame) satisfies a test. */
function anyInRow(c: CheckContext, y: number, x0: number, x1: number, test: (p: Rgba) => boolean): boolean {
  for (let x = x0; x <= x1; x += 5) if (at(c, x, y, test)) return true;
  return false;
}

/** Some pixel of a window column (y0…y1) satisfies a test. */
function anyInColumn(c: CheckContext, x: number, y0: number, y1: number, test: (p: Rgba) => boolean): boolean {
  for (let y = y0; y <= y1; y += 5) if (at(c, x, y, test)) return true;
  return false;
}

/** The sky: clearly blue (clouds too are bluer than red by 0.2 or more). */
const sky = (p: Rgba): boolean => p[2] > p[0] + 0.15 && p[2] > 0.5;

/** Marble: light and grey (red and blue within 0.08 – the sky and its clouds are much bluer). */
const marble = (p: Rgba): boolean => Math.abs(p[0] - p[2]) < 0.08 && p[0] > 0.55;

/** Gold (1.0, 0.8, 0.2) or a colour close to it: bright red, little blue. */
const gold = (p: Rgba): boolean => p[0] > 0.75 && p[1] > 0.45 && p[2] < 0.45 && p[0] - p[2] > 0.4;

/** Red-tinted glass over the mountains and the sky: red well above green and blue. */
const redGlass = (p: Rgba): boolean => p[0] > p[1] + 0.2 && p[0] > p[2] + 0.15;

/** The draws of a frame that sample a cube map: the sky. */
const isSky = (d: DrawCall): boolean => d.fragmentShader.globals.some((g) => /samplerCube|TextureCube/.test(g.type));

/** The most separate marble pieces on a row of the upper picture (y0…y1), where only the columns can be. */
function mostMarblePieces(c: CheckContext, y0: number, y1: number): number {
  let most = 0;
  for (let y = y0; y <= y1; y += 5) {
    let pieces = 0;
    let inside = false;
    for (let x = 0; x < 800; x += 5) {
      const m = at(c, x, y, marble);
      if (m && !inside) pieces++;
      inside = m;
    }
    most = Math.max(most, pieces);
  }
  return most;
}

/** How many pixels of a window box (every 5 px) satisfy a test. */
function countIn(c: CheckContext, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  let n = 0;
  for (let y = y0; y <= y1; y += 5) for (let x = x0; x <= x1; x += 5) if (at(c, x, y, test)) n++;
  return n;
}

/** The selected sculpture is still marble in its middle (an outline, a glass or an effect must not paint over it). */
const sculptureShows = (c: CheckContext): boolean => at(c, 200, 300, marble);

export function advancedOpenGLProject(): Record<string, Checks> {
  return {
    "advanced-opengl-project": {
      // The corners fade to black; the middle keeps its colours (the start's edge detection does not).
      "vignette": c => c.drew && sculptureShows(c)
        && [[5, 5], [795, 5], [5, 595], [795, 595]].every(([x, y]) => at(c, x!, y!, (p) => p[0] + p[1] + p[2] < 0.45)),
      // The sky is drawn after something else in its target, and shows – behind the sculpture, which it does not
      // cover (drawn last as a cube around the camera it would; drawn last at depth 1.0 with the depth test LESS it
      // would not show at all).
      "sky": c => {
        const draws = c.scene?.draws ?? [];
        const i = draws.findIndex(isSky);
        return c.drew && i > 0 && draws.slice(0, i).some((d) => d.target === draws[i]!.target && !isSky(d))
          && c.countPixels(sky) > 200 && sculptureShows(c);
      },
      // One draw call with several instances, and at least three marble columns side by side above the sculptures.
      "columns": c => c.drew && (c.scene?.draws.some((d) => d.instances >= 4) ?? false) && mostMarblePieces(c, 40, 180) >= 3,
      // Gold left of and above the selected sculpture, marble inside it, and a draw with a stencil test that keeps
      // only some fragments (NOTEQUAL, or another function than ALWAYS).
      "outline": c => c.drew && sculptureShows(c)
        && anyInRow(c, 300, 40, 110, gold) && anyInColumn(c, 205, 150, 200, gold)
        && (c.scene?.draws.some((d) => d.stencil !== null && d.stencil.func !== CompareFunc.Always && d.stencil.func !== CompareFunc.Never) ?? false),
      // A blended draw, and the red glass over a good part of the pane's place between the sculptures.
      "glass": c => c.drew && (c.scene?.draws.some((d) => d.blend !== null) ?? false) && countIn(c, 470, 190, 690, 410, redGlass) >= 300,
    },
  };
}
