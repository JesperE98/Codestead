// Specular IBL, "A low-discrepancy sequence": 64 points from the C library's random numbers and the 64 points of the
// Hammersley sequence (i / 64, RadicalInverse_VdC(i)). The random points clump and leave gaps; the Hammersley points
// cover the square evenly – each new one falls into the largest gap the earlier ones left.
import { C, PAD, W, dot, perLanguage, svg, t } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";

export const variants = perLanguage("hammersley");

const N = 64, GAP = 16, PW = (W - 2 * PAD - GAP) / 2, SQ = 250;
export const height = PAD + 40 + SQ + 20 + PAD;

const radicalInverse = (i) => {
  let b = i >>> 0;
  b = ((b << 16) | (b >>> 16)) >>> 0;
  b = (((b & 0x55555555) << 1) | ((b & 0xaaaaaaaa) >>> 1)) >>> 0;
  b = (((b & 0x33333333) << 2) | ((b & 0xcccccccc) >>> 2)) >>> 0;
  b = (((b & 0x0f0f0f0f) << 4) | ((b & 0xf0f0f0f0) >>> 4)) >>> 0;
  b = (((b & 0x00ff00ff) << 8) | ((b & 0xff00ff00) >>> 8)) >>> 0;
  return b * 2.3283064365386963e-10;
};

// A small linear congruential generator (the classic C library constants), seeded so the picture never changes.
function randoms(n, seed) {
  let x = seed >>> 0;
  const next = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0), ((x >>> 16) & 0x7fff) / 32767);
  return Array.from({ length: n }, () => [next(), next()]);
}

function square(x, name, points, color) {
  const y = PAD;
  let s = panel(x, y, PW, SQ + 60);
  s += label(x + PW / 2, y + 22, name, { anchor: "middle", size: 21, weight: 650 });
  const sx = x + (PW - SQ) / 2, sy = y + 44;
  s += `<rect x="${sx}" y="${sy}" width="${SQ}" height="${SQ}" fill="#fff" stroke="${C.boxStroke}"/>`;
  for (const [u, w] of points) s += dot(sx + u * SQ, sy + (1 - w) * SQ, { r: 4.5, color });
  return s;
}

export function draw(v) {
  const ham = Array.from({ length: N }, (_, i) => [i / N, radicalInverse(i)]);
  return svg(height, square(PAD, t(v, "Random", "Slumptal"), randoms(N, 7), C.muted) + square(PAD + PW + GAP, "Hammersley", ham, C.accent));
}
