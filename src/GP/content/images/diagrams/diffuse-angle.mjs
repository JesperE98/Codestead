// Basic Lighting, "Diffuse lighting": the angle θ between a fragment's normal n and the direction L towards the light,
// and what the diffuse term makes of it – cos θ (the dot product of the two unit vectors), clamped at 0 when the
// light is behind the surface (θ > 90°). The marked point is the drawing's θ = 40°. Language-free (maths only).
import { BOLD, C, PAD, W, arcArrow, arrow, dot, line, svg, text } from "./style.mjs";
import { L, LS, lamp, surface } from "./_lighting.mjs";

export const variants = [{ out: "diffuse-angle.webp", lang: "en" }];
export const height = 300;

const THETA = 40;

export function draw() {
  let s = "";
  const rad = (d) => (d * Math.PI) / 180;
  // Left: the fragment, its normal and the direction to the lamp.
  s += `<rect x="${PAD}" y="${PAD}" width="300" height="${height - 2 * PAD}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const px = 150, py = 222, len = 118;
  s += surface(PAD + 22, py, PAD + 278, py);
  const lx = px + 170 * Math.sin(rad(THETA)), ly = py - 170 * Math.cos(rad(THETA));
  s += line(lx, ly, px, py, { color: "#c98a12", dash: "5 4", width: 1.5 });
  s += arcArrow(px, py, 52, 90, 90 - THETA, { noHead: true, color: C.muted, width: 1.5 });
  s += text(px + 52 * Math.cos(rad(90 - THETA / 2)) + 4, py - 52 * Math.sin(rad(90 - THETA / 2)) - 12, "θ", { size: L, italic: true, weight: 600, anchor: "middle" });
  s += arrow(px, py, px, py - len, { color: C.y, width: BOLD });
  s += arrow(px, py, px + len * Math.sin(rad(THETA)), py - len * Math.cos(rad(THETA)), { color: C.accent, width: BOLD });
  s += lamp(lx, ly);
  s += dot(px, py, { r: 5 });
  s += text(px - 12, py - len + 6, "*n*", { size: L, weight: 650, color: C.y, anchor: "end" });
  s += text(px + len * Math.sin(rad(THETA)) + 6, py - len * Math.cos(rad(THETA)) + 20, "*L*", { size: L, weight: 650, color: C.accent });
  // Right: max(cos θ, 0) from 0° to 180°.
  const x0 = 380, y0 = 222, pw = 300, ph = 150;
  const X = (deg) => x0 + (deg / 180) * pw, Y = (v) => y0 - v * ph;
  s += text(x0 + pw / 2, PAD + 16, "max(cos *θ*, 0)", { size: L, weight: 650, anchor: "middle", color: C.accent });
  s += line(x0, y0 - ph - 8, x0, y0 + 30, { color: C.line });
  s += line(x0, y0, x0 + pw + 6, y0, { color: C.line });
  s += line(x0 - 5, Y(1), x0 + pw, Y(1), { color: C.grid, width: 1 });
  let pos = "";
  for (let d = 0; d <= 180; d += 2) {
    const c = Math.cos(rad(d));
    if (d <= 90) pos += `${d === 0 ? "M" : "L"}${X(d)},${Y(c)}`;
  }
  s += `<path d="${pos}" fill="none" stroke="${C.accent}" stroke-width="${BOLD + 0.5}" stroke-linecap="round"/>`;
  s += line(X(90), y0, X(180), y0, { color: C.accent, width: BOLD + 0.5 });
  const c = Math.cos(rad(THETA));
  s += line(X(THETA), Y(c), X(THETA), y0, { color: C.muted, dash: "4 3" });
  s += dot(X(THETA), Y(c), { r: 5.5, color: C.accent });
  s += text(X(THETA) + 10, Y(c) - 14, c.toFixed(2), { size: LS, weight: 600, mono: true });
  for (const [d, lbl] of [[0, "0°"], [THETA, "40°"], [90, "90°"], [180, "180°"]])
    s += text(X(d), y0 + 22, lbl, { size: LS, anchor: "middle", color: d === THETA ? C.ink : C.muted, weight: 600 });
  s += text(x0 - 14, Y(1), "1", { size: LS, anchor: "end", color: C.muted, weight: 600 });
  s += text(x0 - 14, y0, "0", { size: LS, anchor: "end", color: C.muted, weight: 600 });
  s += text(X(135), y0 - 20, "cos *θ* < 0", { size: LS, anchor: "middle", color: C.muted, weight: 600 });
  return svg(height, s);
}
