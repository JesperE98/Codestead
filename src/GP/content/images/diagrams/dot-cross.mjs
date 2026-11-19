// Transformations, "Dot product" and "Cross product": for two unit vectors the dot product is cos θ – 1 when they
// point the same way, 0 at a right angle, −1 when opposite; and x × y = z (y × x = −z) on the course's right-handed
// axes. Language-free (maths only).
import { BOLD, C, PAD, W, arcArrow, arrow, line, svg, text } from "./style.mjs";

export const variants = [{ out: "dot-cross.webp", lang: "en" }];
export const height = 250;

/** Two unit vectors at an angle, and their dot product. */
function dotCase(cx, cy, angle, label) {
  const r = 62;
  const rad = (angle * Math.PI) / 180;
  // At 0° the two arrows would cover each other: k is drawn a little above v.
  const lift = angle === 0 ? 8 : 0;
  let s = arrow(cx, cy, cx + r, cy, { color: C.ink, width: BOLD });
  const kx = cx + r * Math.cos(rad), ky = cy - lift - r * Math.sin(rad);
  s += arrow(cx, cy - lift, kx, ky, { color: C.accent, width: BOLD });
  s += text(cx + r + 6, cy + 2, "*v*", { size: 14, weight: 600, anchor: "start" });
  s += text(kx + (angle === 180 ? -6 : angle === 90 ? 8 : 6), ky - (angle === 0 ? 6 : 0) + (angle === 90 ? 6 : 0), "*k*", { size: 14, weight: 600, color: C.accent, anchor: angle === 180 ? "end" : "start" });
  if (angle > 0) s += arcArrow(cx, cy, 22, 0, angle, { noHead: true, color: C.muted });
  if (angle > 0 && angle < 180) s += text(cx + 30 * Math.cos(rad / 2), cy - 30 * Math.sin(rad / 2) - 4, `${angle}°`, { size: 12, color: C.muted, anchor: "start" });
  if (angle === 180) s += text(cx, cy - 32, "180°", { size: 12, color: C.muted, anchor: "middle" });
  s += text(cx, cy + 34, label, { size: 15, weight: 600, anchor: "middle" });
  return s;
}

export function draw() {
  let s = "";
  // Left: the dot product of unit vectors.
  const left = PAD, top = PAD;
  const lw = 420;
  s += `<rect x="${left}" y="${top}" width="${lw}" height="${height - 2 * PAD}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  s += text(left + lw / 2, top + 24, "*v* · *k* = ‖*v*‖ ‖*k*‖ cos *θ* = cos *θ*", { size: 15, weight: 600, anchor: "middle" });
  s += dotCase(left + 50, top + 128, 0, "1");
  s += dotCase(left + 160, top + 128, 90, "0");
  s += dotCase(left + 350, top + 128, 180, "−1");
  s += text(left + lw / 2, top + 192, "‖*v*‖ = ‖*k*‖ = 1", { size: 13, color: C.muted, anchor: "middle" });
  // Right: x × y = z, drawn in an oblique 3D view (z towards the viewer, down and to the left).
  const rx = left + lw + 16, rw = W - PAD - rx;
  s += `<rect x="${rx}" y="${top}" width="${rw}" height="${height - 2 * PAD}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const ox = rx + rw / 2 + 10, oy = top + 132, L = 78;
  s += arrow(ox, oy, ox + L, oy, { color: C.x, width: BOLD });
  s += arrow(ox, oy, ox, oy - L, { color: C.y, width: BOLD });
  s += arrow(ox, oy, ox - L * 0.55, oy + L * 0.42, { color: C.z, width: BOLD });
  s += line(ox, oy, ox + L * 0.55, oy - L * 0.42, { color: C.line, dash: "4 3" }); // −z, away from the viewer
  s += text(ox + L + 8, oy, "*x*", { size: 16, weight: 650, color: C.x });
  s += text(ox + 10, oy - L, "*y*", { size: 16, weight: 650, color: C.y });
  s += text(ox - L * 0.55 - 10, oy + L * 0.42 + 6, "*z*", { size: 16, weight: 650, color: C.z, anchor: "end" });
  s += text(ox + L * 0.55 + 6, oy - L * 0.42 - 8, "−*z*", { size: 13, color: C.muted });
  s += text(rx + rw / 2, top + 24, "*x* × *y* = *z*", { size: 15, weight: 600, anchor: "middle" });
  s += text(rx + rw / 2, top + 192, "*y* × *x* = −*z*", { size: 13, color: C.muted, anchor: "middle" });
  return svg(height, s);
}
