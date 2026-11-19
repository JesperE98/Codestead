// Transformations, "Vectors": the chapter's own examples on a grid – v + k with v = (4, 2) and k = (1, 2), the vector
// q − p from p to q, and the length of v = (4, 2). Language-free (maths only).
import { BOLD, C, LINE, PAD, W, arrow, dot, grid, line, svg, text } from "./style.mjs";

export const variants = [{ out: "vectors.webp", lang: "en" }];
export const height = 236;

const U = 28; // one unit on the grid
const PW = (W - 2 * PAD - 2 * 16) / 3; // a panel's width

/** A panel with a grid and its origin at the bottom left; returns a function from grid units to the picture. */
function panel(i) {
  const x = PAD + i * (PW + 16), y = PAD;
  const ox = x + 22, oy = y + 6 * U + 4;
  const g = `<rect x="${x}" y="${y}" width="${PW}" height="${height - 2 * PAD}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>` +
    grid(ox, oy - 6 * U, 6 * U, 6 * U, U) + line(ox, oy, ox + 6 * U + 8, oy, { color: C.line }) + line(ox, oy, ox, oy - 6 * U - 8, { color: C.line });
  return { g, at: (gx, gy) => [ox + gx * U, oy - gy * U], x, y };
}

export function draw() {
  let s = "";
  // v + k: k drawn from the tip of v; the sum from the start of v to the tip of k.
  {
    const p = panel(0);
    s += p.g;
    const [ax, ay] = p.at(0, 0), [bx, by] = p.at(4, 2), [cx, cy] = p.at(5, 4);
    s += arrow(ax, ay, cx, cy, { color: C.accent, width: BOLD });
    s += arrow(ax, ay, bx, by, { color: C.ink, width: BOLD });
    s += arrow(bx, by, cx, cy, { color: C.accent2, width: BOLD });
    s += text((ax + bx) / 2 + 6, (ay + by) / 2 + 14, "*v*", { size: 16, weight: 600 });
    s += text(bx + 12, (by + cy) / 2 + 4, "*k*", { size: 16, weight: 600, color: C.accent2 });
    s += text((ax + cx) / 2 - 10, (ay + cy) / 2 - 12, "*v* + *k*", { size: 16, weight: 600, color: C.accent, anchor: "end" });
    s += text(cx + 8, cy - 10, "(5, 4)", { size: 12, color: C.muted, weight: 600 });
  }
  // q − p: the vector from the point p to the point q.
  {
    const p = panel(1);
    s += p.g;
    const [px, py] = p.at(1, 1), [qx, qy] = p.at(5, 4), [ox, oy] = p.at(0, 0);
    s += arrow(ox, oy, px, py, { color: C.line, width: LINE, dash: "4 3" });
    s += arrow(ox, oy, qx, qy, { color: C.line, width: LINE, dash: "4 3" });
    s += arrow(px, py, qx, qy, { color: C.accent, width: BOLD });
    s += dot(px, py, { r: 4.5 });
    s += dot(qx, qy, { r: 4.5 });
    s += text(px + 2, py + 16, "*p*", { size: 16, weight: 600 });
    s += text(qx + 10, qy, "*q*", { size: 16, weight: 600 });
    s += text((px + qx) / 2 - 8, (py + qy) / 2 - 12, "*q* − *p*", { size: 16, weight: 600, color: C.accent, anchor: "end" });
  }
  // The length of v = (4, 2): the hypotenuse of its components.
  {
    const p = panel(2);
    s += p.g;
    const [ax, ay] = p.at(0, 0), [bx, by] = p.at(4, 0), [cx, cy] = p.at(4, 2);
    s += line(ax, ay, bx, by, { color: C.x, width: BOLD });
    s += line(bx, by, cx, cy, { color: C.y, width: BOLD });
    s += `<path d="M${bx - 10},${by} L${bx - 10},${by - 10} L${bx},${by - 10}" fill="none" stroke="${C.line}"/>`;
    s += arrow(ax, ay, cx, cy, { color: C.ink, width: BOLD });
    s += text((ax + bx) / 2, ay + 14, "*x* = 4", { size: 13, color: C.x, anchor: "middle", weight: 600 });
    s += text(bx + 8, (by + cy) / 2, "*y* = 2", { size: 13, color: C.y, weight: 600 });
    s += text((ax + cx) / 2 - 6, (ay + cy) / 2 - 14, "*v*", { size: 16, weight: 600, anchor: "end" });
    s += text(p.x + PW / 2, p.y + 22, "‖*v*‖ = √(4² + 2²) ≈ 4.47", { size: 14, weight: 600, anchor: "middle" });
  }
  return svg(height, s);
}

