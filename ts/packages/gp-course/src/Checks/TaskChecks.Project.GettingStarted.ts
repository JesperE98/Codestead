import type { Frame } from "@codestead/gp-gpu";
import { given, type CheckContext } from "../CheckContext.js";
import { perApi, type Checks } from "./TaskChecks.PerApi.js";

// The project after Getting started, "The planetarium sign": a night-blue backdrop, a wide sign, the wood repeating
// across it, the corners' colours, a glow that pulses and then runs across the sign (projects/<api>/getting-started-project).
// The checks look at the picture – where the sign is drawn, how it repeats, its colours and how its brightness changes
// over time – measured from the sign's own bounding box, so the learner's sizes, coordinates and speeds are fine. Only
// the wrap mode is read from the code as well: the faces repeat already, and the picture of a stretched crate edge mixed
// with them is too close to that of a repeating crate to tell apart under the later tint and glow.

/** The sign: the box of pixels (in the check frame) that are not the clear colour; null when nothing is drawn. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function differs(p: number[], clear: readonly number[]): boolean {
  return Math.abs(p[0]! - clear[0]!) > 0.02 || Math.abs(p[1]! - clear[1]!) > 0.02 || Math.abs(p[2]! - clear[2]!) > 0.02;
}

function signBox(c: CheckContext): Box | null {
  const f = c.frame;
  if (f === null || !c.drew) return null;
  const clear = c.scene!.clearColor ?? [0, 0, 0, 1];
  let x0 = f.width, y0 = f.height, x1 = -1, y1 = -1;
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++)
      if (differs(f.at(x, y), clear)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** The mean colour of a box of frame pixels (inclusive). */
function meanColour(f: Frame, x0: number, y0: number, x1: number, y1: number): number[] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(f.height - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(f.width - 1, x1); x++) {
      const p = f.at(x, y);
      for (let k = 0; k < 3; k++) sum[k]! += p[k]!;
      n++;
    }
  return sum.map((s) => (n > 0 ? s / n : 0));
}

/**
 * The picture repeats across the sign: for some number of copies from 3 to 8, every pixel looks like the one a copy's
 * width to its right. Each pixel is compared relative to the mean of its neighbourhood, so a colour or brightness that
 * changes smoothly across the sign (the tint, the glow) does not hide the repetition.
 */
function repeatsAcross(c: CheckContext, box: Box): boolean {
  const f = c.frame!;
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const lum = (x: number, y: number): number => {
    const p = f.at(x, y);
    return p[0]! + p[1]! + p[2]! + 0.06;
  };
  const r = 3;
  const relative: number[] = new Array<number>(w * h);
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++) {
      let s = 0;
      let n = 0;
      for (let j = Math.max(box.y0, y - r); j <= Math.min(box.y1, y + r); j++)
        for (let i = Math.max(box.x0, x - r); i <= Math.min(box.x1, x + r); i++) {
          s += lum(i, j);
          n++;
        }
      relative[(y - box.y0) * w + (x - box.x0)] = lum(x, y) / (s / n);
    }
  for (let copies = 3; copies <= 8; copies++) {
    const shift = w / copies;
    let total = 0;
    let n = 0;
    for (let x = 2; x < w - 2; x++) {
      const xs = Math.round(x + shift);
      if (xs > w - 3) continue;
      for (let y = 2; y < h - 2; y++) {
        total += Math.abs(relative[y * w + x]! - relative[y * w + xs]!);
        n++;
      }
    }
    if (n > 0 && total / n < 0.05) return true;
  }
  return false;
}

/** The times the glow is looked at (seconds). */
const times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

/** The brightness (r + g + b) of five upright strips of the sign, left to right, at each of the times. */
function stripBrightness(c: CheckContext, box: Box): number[][] {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const half = Math.max(1, Math.round(w / 20));
  const top = box.y0 + Math.round(h * 0.1);
  const bottom = box.y1 - Math.round(h * 0.1);
  return times.map((t) => {
    const f = c.frameAt(t);
    if (f === null) return [0, 0, 0, 0, 0];
    return [0.1, 0.3, 0.5, 0.7, 0.9].map((at) => {
      const x = box.x0 + Math.round(w * at);
      const m = meanColour(f, x - half, top, x + half, bottom);
      return m[0]! + m[1]! + m[2]!;
    });
  });
}

/** Some strip of the sign gets clearly brighter and darker over time (by a fifth of its brightest). */
function pulses(strips: number[][]): boolean {
  for (let i = 0; i < 5; i++) {
    const values = strips.map((s) => s[i]!);
    const max = Math.max(...values);
    if (max > 0.05 && max - Math.min(...values) >= 0.2 * max) return true;
  }
  return false;
}

/** The strips are not bright at the same time: relative to their own mean, two of them differ at some time. */
function travels(strips: number[][]): boolean {
  const means = [0, 1, 2, 3, 4].map((i) => strips.reduce((s, row) => s + row[i]!, 0) / strips.length);
  if (means.some((m) => m < 0.05)) return false;
  return strips.some((row) => {
    const relative = row.map((v, i) => v / means[i]!);
    return Math.max(...relative) - Math.min(...relative) > 0.2;
  });
}

export function gettingStartedProject(): Record<string, Checks> {
  return {
    "getting-started-project": {
      // A deep night blue: dark, with blue clearly the strongest channel (the start's teal is 0.2, 0.3, 0.3).
      "night-blue": (c) => {
        const clear = c.shows ? c.scene!.clearColor : null;
        if (clear === null) return false;
        const [r, g, b] = [clear[0]!, clear[1]!, clear[2]!];
        return r <= 0.15 && g <= 0.15 && b <= 0.45 && b >= r + 0.04 && b >= g + 0.04;
      },
      // A wide sign: at least 1.8 times as wide as it is tall (in pixels) and over 60 % of the window's width (the start's
      // rectangle is 400 × 300 pixels).
      "wide-sign": (c) => {
        const box = signBox(c);
        if (box === null) return false;
        const w = box.x1 - box.x0 + 1;
        const h = box.y1 - box.y0 + 1;
        return w >= 0.6 * c.frame!.width && w >= 1.8 * h;
      },
      // The wood repeats: the picture repeats at least three times across the sign, and the crate is no longer read
      // with a clamping wrap mode (the course's start has one for it; the faces repeat already).
      "repeat-wood": perApi({
        opengl: (c) => !c.has("GL_CLAMP_TO_(?:EDGE|BORDER)") && given(signBox(c), (box) => repeatsAcross(c, box)),
        vulkan: (c) => (!c.has("VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_(?:EDGE|BORDER)") || !c.has("\\. sampler = clampSampler")) && given(signBox(c), (box) => repeatsAcross(c, box)),
        d3d12: (c) => (!c.has("D3D12_TEXTURE_ADDRESS_MODE_(?:CLAMP|BORDER)") || !c.hasInShaders("\\. Sample \\( clampSampler")) && given(signBox(c), (box) => repeatsAcross(c, box)),
      }),
      // The corners' colours: red towards the top right corner, green towards the bottom right (the colours of the
      // vertex data), each at least twice the other two channels.
      "tint": (c) => {
        const box = signBox(c);
        if (box === null) return false;
        const f = c.frame!;
        const w = box.x1 - box.x0 + 1;
        const h = box.y1 - box.y0 + 1;
        const dx = Math.max(1, Math.round(w * 0.04));
        const dy = Math.max(1, Math.round(h * 0.06));
        const right = box.x1 - Math.round(w * 0.08);
        const red = meanColour(f, right - dx, box.y0 + Math.round(h * 0.12) - dy, right + dx, box.y0 + Math.round(h * 0.12) + dy);
        const green = meanColour(f, right - dx, box.y1 - Math.round(h * 0.12) - dy, right + dx, box.y1 - Math.round(h * 0.12) + dy);
        return red[0]! > 0.06 && red[0]! > 2 * red[1]! && red[0]! > 2 * red[2]! && green[1]! > 0.06 && green[1]! > 2 * green[0]! && green[1]! > 2 * green[2]!;
      },
      // A glow: the sign's brightness goes up and down over time (somewhere on it, so a glow that runs across it counts).
      "glow": (c) => given(signBox(c), (box) => c.scene!.animated && pulses(stripBrightness(c, box))),
      // The glow runs across the sign: it still pulses, but the strips from left to right are not bright at the same time.
      "wave": (c) =>
        given(signBox(c), (box) => {
          if (!c.scene!.animated) return false;
          const strips = stripBrightness(c, box);
          return pulses(strips) && travels(strips);
        }),
    },
  };
}

