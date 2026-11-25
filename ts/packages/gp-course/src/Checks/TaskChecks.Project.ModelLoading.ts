import type { CheckContext, Rgba } from "../CheckContext.js";
import type { Checks } from "./TaskChecks.PerApi.js";

// The optional project after Model Loading, "The hall of worlds": the planet model drawn several times with its own
// transforms. Every milestone is checked in the picture (the 800×600 window, the same in every API): the exhibits are
// found by where something is drawn, not by exact pixels, so other sizes, tilts and positions near the described ones
// pass too. The finished scene (camera at (0, 0, 6)): the turning planet in the middle (x ≈ 280..520), the bronze
// exhibit on the left (x ≈ 35..230) and the leaning one on the right (x ≈ 575..765), all around y ≈ 300, and the shelf
// of five small planets higher up at the back (y ≈ 150..210).

/** Window pixels (800×600) per pixel of the 160 px wide check frame. */
const Step = 5;

/** Something other than the clear colour at a window pixel (at 1 s, or at another time). */
function drawn(c: CheckContext, x: number, y: number, time = 1.0): boolean {
  if (time === 1.0) return c.drawnAt(x / 800, y / 600);
  const p = c.pixelAt(time, x / 800, y / 600);
  const clear = c.scene?.clearColor ?? [0, 0, 0, 1];
  return p !== null && [0, 1, 2].some((i) => Math.abs(p[i]! - clear[i]!) > 0.02);
}

/** The drawn run through a window pixel along a column: how many window pixels high it is (0 if nothing is drawn there). */
function columnRun(c: CheckContext, x: number, y: number): number {
  if (!drawn(c, x, y)) return 0;
  let top = y;
  while (top - Step >= 0 && drawn(c, x, top - Step)) top -= Step;
  let bottom = y;
  while (bottom + Step < 600 && drawn(c, x, bottom + Step)) bottom += Step;
  return bottom - top + Step;
}

/** The most separate drawn pieces on any row between two heights (window pixels). */
function mostPiecesInARow(c: CheckContext, y0: number, y1: number): number {
  let most = 0;
  for (let y = y0; y <= y1; y += Step) {
    let pieces = 0;
    let inside = false;
    for (let x = 0; x < 800; x += Step) {
      const d = drawn(c, x, y);
      if (d && !inside) pieces++;
      inside = d;
    }
    most = Math.max(most, pieces);
  }
  return most;
}

/** The pixels of a box (window pixels) that satisfy a test. */
function countIn(c: CheckContext, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  let n = 0;
  for (let y = y0; y <= y1; y += Step)
    for (let x = x0; x <= x1; x += Step) {
      const p = c.pixel(x / 800, y / 600);
      if (p !== null && test(p)) n++;
    }
  return n;
}

/** The pixels of a box that differ between the frames at two times (more than a little in some channel). */
function changedIn(c: CheckContext, x0: number, y0: number, x1: number, y1: number, t0: number, t1: number): number {
  let n = 0;
  for (let y = y0; y <= y1; y += Step)
    for (let x = x0; x <= x1; x += Step) {
      const a = c.pixelAt(t0, x / 800, y / 600);
      const b = c.pixelAt(t1, x / 800, y / 600);
      if (a !== null && b !== null && [0, 1, 2].some((i) => Math.abs(a[i]! - b[i]!) > 0.05)) n++;
    }
  return n;
}

/** The planet's oceans: clearly blue (lit or in the shade). */
const ocean = (p: Rgba): boolean => p[2] > p[0] + 0.08 && p[2] > p[1] + 0.04;

/**
 * Bronze: red well over green and blue. The model's own warmest colour, the beige ring (178, 153, 119), has green at
 * 0.86 of red; tinted bronze (1.0, 0.6, 0.25) it is 0.51 of red, the ice cap's even less.
 */
const bronze = (p: Rgba): boolean => p[0] > 0.1 && p[1] < 0.75 * p[0] && p[2] < 0.5 * p[0];

// The boxes of the exhibits (window pixels): the middle one, the left one and the right one.
const Middle = [270, 215, 530, 385] as const;
const Left = [30, 230, 250, 375] as const;
const Right = [550, 230, 770, 375] as const;

/** The camera stands further back: the planet in the middle is drawn, but less than 200 px high. */
const madeRoom = (c: CheckContext): boolean => c.drew && drawn(c, 400, 300) && columnRun(c, 400, 300) < 200;

/** Exhibits on both sides of the middle one, at its height (the start's planet, close up, fills those boxes too). */
const exhibits = (c: CheckContext): boolean => madeRoom(c) && c.coveredIn(...Left) > 0.08 && c.coveredIn(...Right) > 0.08;

export function modelLoadingProject(): Record<string, Checks> {
  return {
    "model-loading-project": {
      // From the start's camera at (0, 0, 3) the planet is about 270 px high, pole to ring; from (0, 0, 6) about 130.
      "make-room": madeRoom,
      "exhibits": exhibits,
      // The middle exhibit changes over time (its sides need not).
      "turntable": c => c.drew && c.changesOverTime && changedIn(c, ...Middle, 1.0, 2.3) > 15,
      // A row of at least four separate planets above the exhibits.
      "shelf": c => c.drew && mostPiecesInARow(c, 0, 215) >= 4,
      // The left exhibit is bronze – no blue oceans left, warm colours – while the middle one keeps its oceans.
      "bronze": c => exhibits(c)
        && countIn(c, ...Left, ocean) === 0 && countIn(c, ...Left, bronze) >= 15
        && countIn(c, ...Middle, ocean) > 0,
    },
  };
}
