import { type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";
import { sky } from "./TaskChecks.Pbr.js";

// The optional project after PBR: the material showroom (projects/<api>/pbr-project: the specular IBL chapter's program,
// camera at (0, 0, 22)). The hero sphere – the riveted steel with its maps – hangs large in the middle, (0, 2, 0) scaled
// 3.6; three samples sit on a row below it at (−6, −6, 0), (0, −6, 0) and (6, −6, 0), scaled 2.4: on the screen around
// (202, 497), (400, 497) and (597, 497) of the 800×600 window. A sample's material is judged by the share of its pixels
// of a kind in a 100 × 100 box round its centre, so other values of the same kind of material pass as well.

/** The share (0–1) of the pixels in a box of the 800×600 window (inclusive, from the top left) that pass a test. */
function share(c: CheckContext, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  const f = c.frame;
  if (f === null) return 0;
  let n = 0;
  let all = 0;
  for (let y = Math.floor((y0 * f.height) / 600); y <= Math.floor((y1 * f.height) / 600); y++)
    for (let x = Math.floor((x0 * f.width) / 800); x <= Math.floor((x1 * f.width) / 800); x++) {
      all++;
      if (test(f.at(x, y) as Rgba)) n++;
    }
  return n / all;
}

/** The box round a sample on the bottom row (−1 left, 0 middle, 1 right). */
const sample = (c: CheckContext, column: number, test: (p: Rgba) => boolean): number => share(c, 352 + column * 197, 447, 452 + column * 197, 547, test);

/** Gold: red and green well above blue, green not far below red (rust's green is). */
const gold = (p: Rgba): boolean => p[0] > p[2] + 0.1 && p[1] > p[2] + 0.05 && p[1] > p[0] - 0.12;

/** A strong colour: the channels far apart. */
const coloured = (p: Rgba): boolean => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 0.2;

/** The rust of the material's maps: orange-brown. */
const rust = (p: Rgba): boolean => p[0] > p[2] + 0.15 && p[0] > p[1] + 0.1;

/** The grid is gone: sky where its top spheres were; the hero is large (its right edge reaches x ≈ 518 at y 234). */
const showroom = (c: CheckContext): boolean =>
  c.drew && at(c, 202, 102, sky) && at(c, 597, 102, sky) && at(c, 400, 60, sky) && at(c, 500, 234, (p) => !sky(p));

export function pbrProject(): Record<string, Checks> {
  return {
    "pbr-project": {
      "showroom": (c) => showroom(c),
      // Most of the left sample gold.
      "gold": (c) => showroom(c) && sample(c, -1, gold) > 0.5,
      // The middle sample one strong colour (plastic: the diffuse colour shows; metal or the maps would not).
      "plastic": (c) => showroom(c) && sample(c, 0, coloured) > 0.6,
      // The right sample a mirror: no rust and no colour (not the maps), the sky above and the dark ground below
      // reflected sharply – many dark pixels.
      "polished-metal": (c) =>
        showroom(c) && sample(c, 1, rust) < 0.01 && sample(c, 1, coloured) < 0.08 && sample(c, 1, (p) => p[0] + p[1] + p[2] < 1.05) > 0.1,
      // The hero turns: the picture changes over time.
      "turntable": (c) => showroom(c) && c.changesOverTime,
    },
  };
}
