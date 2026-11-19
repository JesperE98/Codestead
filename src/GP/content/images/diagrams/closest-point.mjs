// Collision detection, the circle test: the brick's centre B, the ball's centre C down and to the right of it, the
// difference D = C − B, clamped to the brick's half extents into R, the closest point P = B + R – here the brick's
// corner – and the distance from P to C compared with the ball's radius. Language-free.
import { C, PAD, W, arrow, dot, line, svg, text } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = [{ out: "closest-point.webp", lang: "en" }];
export const height = 440;

export function draw() {
  const bx = 230, by = 150, hw = 140, hh = 70; // the brick: centre and half extents
  const cx = 500, cy = 340, r = 70; // the ball
  const px = bx + hw, py = by + hh; // P: both components clamped
  let s = `<rect x="${bx - hw}" y="${by - hh}" width="${2 * hw}" height="${2 * hh}" rx="4" fill="${C.zSoft}" stroke="${C.z}" stroke-width="2"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.ySoft}" stroke="${C.y}" stroke-width="2"/>`;
  // D, from B to C
  s += arrow(bx, by, cx, cy, { color: C.line, width: 2, dash: "6 4" });
  s += label((bx + cx) / 2 - 14, (by + cy) / 2 + 24, "*D* = *C* − *B*", { color: C.muted, anchor: "end" });
  // R, D clamped to the half extents
  s += arrow(bx, by, px, py, { color: C.accent, width: 3 });
  s += label(bx + 34, by + 58, "*R*", { color: C.accent, size: 22 });
  // the half extents
  s += arrow(bx, by - hh - 18, bx + hw, by - hh - 18, { color: C.z, width: 1.5, both: true });
  s += label(bx + hw / 2, by - hh - 36, "*w*/2", { anchor: "middle", color: C.z });
  s += arrow(bx - hw - 18, by, bx - hw - 18, by + hh, { color: C.z, width: 1.5, both: true });
  s += label(bx - hw - 26, by + hh / 2 + 2, "*h*/2", { anchor: "end", color: C.z });
  // P − C, compared with the radius
  s += line(px, py, cx, cy, { color: C.accent2, width: 3 });
  s += arrow(cx, cy, cx + r * 0.94, cy + r * 0.34, { color: C.y, width: 1.5 });
  s += label(cx + r + 8, cy + 26, "*radius*", { color: C.y });
  s += dot(bx, by, { r: 5 }) + label(bx - 12, by - 14, "*B*", { anchor: "end", size: 22 });
  s += dot(cx, cy, { r: 5 }) + label(cx + 10, cy - 18, "*C*", { size: 22 });
  s += dot(px, py, { r: 6, color: C.accent }) + label(px + 16, py - 34, "*P* = *B* + *R*", { color: C.accent });
  s += text(PAD + 10, height - PAD - 10, "‖*P* − *C*‖ < *radius*", { size: 22, weight: 600, color: C.accent2 });
  return svg(height, s);
}
