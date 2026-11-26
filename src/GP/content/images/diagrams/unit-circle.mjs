// The maths of 3D, "Sine and cosine": the point at angle θ = 60° on the unit circle is (cos θ, sin θ) – cos along x
// (red), sin along y (green) – with the four quarter turns in degrees and radians; next to it sin t and cos t over one
// full turn, 0 … 2π, with the same θ marked. Language-free (maths only).
import { BOLD, C, LINE, PAD, W, arcArrow, dot, line, svg, text } from "./style.mjs";

export const variants = [{ out: "unit-circle.webp", lang: "en" }];
export const height = 292;

const theta = 60;

export function draw() {
  let s = "";
  const top = PAD, h = height - 2 * PAD;
  const rad = (theta * Math.PI) / 180;
  // Left: the unit circle.
  const lw = 320;
  s += `<rect x="${PAD}" y="${top}" width="${lw}" height="${h}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const cx = PAD + lw / 2, cy = top + h / 2 + 2, R = 92;
  s += line(cx - R - 22, cy, cx + R + 22, cy, { color: C.line });
  s += line(cx, cy + R + 18, cx, cy - R - 18, { color: C.line });
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.ink}" stroke-width="${LINE}"/>`;
  const px = cx + R * Math.cos(rad), py = cy - R * Math.sin(rad);
  s += line(cx, cy, px, py, { color: C.ink, width: BOLD });
  s += line(cx, cy, px, cy, { color: C.x, width: BOLD + 1 });
  s += line(px, cy, px, py, { color: C.y, width: BOLD + 1 });
  s += arcArrow(cx, cy, 24, 0, theta, { color: C.accent, width: LINE });
  s += text(cx + 30, cy - 12, "*θ*", { size: 14, weight: 600, color: C.accent });
  s += text((cx + px) / 2 - 10, (cy + py) / 2 - 8, "1", { size: 13, weight: 600, anchor: "end" });
  s += text((cx + px) / 2, cy + 14, "cos *θ*", { size: 13, weight: 600, color: C.x, anchor: "middle" });
  s += text(px + 6, (cy + py) / 2 + 6, "sin *θ*", { size: 13, weight: 600, color: C.y });
  s += dot(px, py, { r: 5, color: C.accent });
  s += text(px + 8, py - 12, "(cos *θ*, sin *θ*)", { size: 13, weight: 650, color: C.accent });
  // The quarter turns: degrees, and radians below them.
  const mark = (x, y, deg, radians, anchor) => {
    s += dot(x, y, { r: 3, color: C.ink });
    return [deg, radians, anchor];
  };
  const labels = [
    [cx + R + 10, cy - 18, ...mark(cx + R, cy, "0°", "0", "start")],
    [cx - 8, cy - R - 18, ...mark(cx, cy - R, "90°", "π/2", "end")],
    [cx - R - 10, cy - 18, ...mark(cx - R, cy, "180°", "π", "end")],
    [cx + 8, cy + R + 4, ...mark(cx, cy + R, "270°", "3π/2", "start")],
  ];
  for (const [x, y, deg, radians, anchor] of labels) {
    s += text(x, y, deg, { size: 12, weight: 600, anchor });
    s += text(x, y + 14, radians, { size: 12, color: C.muted, anchor });
  }
  // Right: sin t and cos t over one turn.
  const gx = PAD + lw + 16, gw = W - PAD - gx;
  s += `<rect x="${gx}" y="${top}" width="${gw}" height="${h}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const ox = gx + 34, oy = top + h / 2 + 2, pw = gw - 60, A = 82;
  const X = (tt) => ox + (tt / (2 * Math.PI)) * pw, Y = (val) => oy - val * A;
  for (const val of [1, -1]) {
    s += line(ox, Y(val), ox + pw, Y(val), { color: C.grid, width: 1 });
    s += text(ox - 8, Y(val), val === 1 ? "1" : "−1", { size: 12, color: C.muted, anchor: "end" });
  }
  s += line(ox, oy, ox + pw + 12, oy, { color: C.line });
  s += line(ox, Y(1) - 10, ox, Y(-1) + 10, { color: C.line });
  const ticks = [[Math.PI / 2, "π/2"], [Math.PI, "π"], [1.5 * Math.PI, "3π/2"], [2 * Math.PI, "2π"]];
  for (const [tt, label] of ticks) {
    s += line(X(tt), oy - 4, X(tt), oy + 4, { color: C.line });
    s += text(X(tt), Y(-1) + 22, label, { size: 12, color: C.muted, anchor: "middle" });
    s += line(X(tt), Y(1), X(tt), Y(-1), { color: C.grid, width: 1 });
  }
  const curve = (f) => {
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const tt = (i / 120) * 2 * Math.PI;
      d += `${i === 0 ? "M" : "L"}${X(tt).toFixed(2)},${Y(f(tt)).toFixed(2)} `;
    }
    return d;
  };
  s += `<path d="${curve(Math.cos)}" fill="none" stroke="${C.x}" stroke-width="${BOLD}"/>`;
  s += `<path d="${curve(Math.sin)}" fill="none" stroke="${C.y}" stroke-width="${BOLD}"/>`;
  s += text(X(Math.PI * 0.62), Y(Math.sin(Math.PI * 0.62)) - 14, "sin *t*", { size: 13, weight: 650, color: C.y, anchor: "start" });
  s += text(X(Math.PI * 1.75) - 10, Y(Math.cos(Math.PI * 1.75)) - 6, "cos *t*", { size: 13, weight: 650, color: C.x, anchor: "end" });
  // The same θ: a dashed line, and the two values on it.
  s += line(X(rad), Y(1) - 4, X(rad), Y(-1), { color: C.accent, dash: "4 3" });
  s += text(X(rad), Y(1) - 14, "*θ*", { size: 14, weight: 600, color: C.accent, anchor: "middle" });
  s += dot(X(rad), Y(Math.cos(rad)), { r: 4.5, color: C.x });
  s += dot(X(rad), Y(Math.sin(rad)), { r: 4.5, color: C.y });
  s += text(ox + pw + 14, oy, "*t*", { size: 14, weight: 600, color: C.muted });
  return svg(height, s);
}
