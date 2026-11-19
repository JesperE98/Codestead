// Collision resolution, the paddle: where the ball hits decides where it goes. For hits at −100 %, −50 %, 0, 50 % and
// 100 % of the half width from the paddle's centre, the new velocity – x = 100 · percentage · 2, y = −|y|, normalised
// and scaled back to the old speed (100, 350): every arrow has the same length. Language-free.
import { C, PAD, W, arrow, dot, svg } from "./style.mjs";
import { code, gameTexture } from "./_practice.mjs";

export const variants = [{ out: "paddle-bounce.webp", lang: "en" }];
export const height = 340;
export const lossy = true; // the paddle texture

export function draw() {
  const pw = 470, ph = 56, px = (W - pw) / 2, py = height - PAD - 50 - ph;
  let s = `<image href="${gameTexture("paddle")}" x="${px}" y="${py}" width="${pw}" height="${ph}" preserveAspectRatio="none"/>`;
  const speed = Math.hypot(100, 350), L = 165;
  for (const p of [-1, -0.5, 0, 0.5, 1]) {
    const hx = px + pw / 2 + (p * pw) / 2, hy = py;
    const vx = 100 * p * 2, vy = -350, n = Math.hypot(vx, vy);
    const ex = hx + (vx / n) * L, ey = hy + (vy / n) * L;
    s += arrow(hx, hy, ex, ey, { color: C.accent, width: 3 });
    s += dot(hx, hy, { r: 6, color: C.accent2 });
    const pct = p === 0 ? "0" : `${p > 0 ? "" : "−"}${Math.abs(p * 100)} %`;
    s += code(hx, py + ph + 24, pct, { anchor: "middle", weight: 600, color: C.accent2 });
  }
  s += code(W - PAD, PAD + 10, `|v| = ${speed.toFixed(0)}`, { anchor: "end", color: C.muted, weight: 600 });
  return svg(height, s);
}
