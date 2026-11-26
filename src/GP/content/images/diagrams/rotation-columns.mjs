// The maths of 3D, "A matrix's columns": a 2D rotation by θ sends the x axis (1, 0) to (cos θ, sin θ) and the y axis
// (0, 1) to (−sin θ, cos θ) – the matrix's two columns; and the chapter's example, the quarter turn that takes
// v = (2, 1) to (−1, 2). Language-free (maths only).
import { BOLD, C, LINE, PAD, W, arcArrow, arrow, grid, line, svg, text } from "./style.mjs";

export const variants = [{ out: "rotation-columns.webp", lang: "en" }];
export const height = 244;

/** A 2×2 matrix with its left edge at x and its middle at y; each column in its own colour. */
function matrix(x, y, cols, colors, colW = 52) {
  const h = 46, w = colW * 2 + 10;
  let s = `<path d="M${x + 6},${y - h / 2} L${x},${y - h / 2} L${x},${y + h / 2} L${x + 6},${y + h / 2}" fill="none" stroke="${C.ink}" stroke-width="${LINE}"/>`;
  s += `<path d="M${x + w - 6},${y - h / 2} L${x + w},${y - h / 2} L${x + w},${y + h / 2} L${x + w - 6},${y + h / 2}" fill="none" stroke="${C.ink}" stroke-width="${LINE}"/>`;
  cols.forEach((col, i) => {
    const cx = x + 5 + colW * i + colW / 2;
    s += text(cx, y - 11, col[0], { size: 13, weight: 600, color: colors[i], anchor: "middle" });
    s += text(cx, y + 11, col[1], { size: 13, weight: 600, color: colors[i], anchor: "middle" });
  });
  return { s, w };
}

export function draw() {
  let s = "";
  const top = PAD, h = height - 2 * PAD;
  // Left: where a rotation by θ sends the axes.
  const lw = 380;
  s += `<rect x="${PAD}" y="${top}" width="${lw}" height="${h}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  {
    const U = 96, ox = PAD + 130, oy = top + 136;
    const th = (30 * Math.PI) / 180;
    s += grid(ox - U - 8, oy - U - 8, 2 * U + 16, U + 48, 24);
    s += line(ox - U - 8, oy, ox + U + 8, oy, { color: C.line });
    s += line(ox, oy + 40, ox, oy - U - 8, { color: C.line });
    // The axes before the rotation, dashed.
    s += arrow(ox, oy, ox + U, oy, { color: C.x, width: LINE, dash: "5 4", opacity: 0.55 });
    s += arrow(ox, oy, ox, oy - U, { color: C.y, width: LINE, dash: "5 4", opacity: 0.55 });
    s += text(ox + U + 2, oy + 14, "(1, 0)", { size: 12, color: C.muted, anchor: "middle" });
    s += text(ox + 8, oy - U - 2, "(0, 1)", { size: 12, color: C.muted });
    // ... and after.
    const ax = ox + U * Math.cos(th), ay = oy - U * Math.sin(th), bx = ox - U * Math.sin(th), by = oy - U * Math.cos(th);
    s += arrow(ox, oy, ax, ay, { color: C.x, width: BOLD });
    s += arrow(ox, oy, bx, by, { color: C.y, width: BOLD });
    s += arcArrow(ox, oy, 40, 0, 30, { color: C.accent });
    s += arcArrow(ox, oy, 40, 90, 120, { color: C.accent });
    s += text(ox + 46, oy - 12, "*θ*", { size: 13, weight: 600, color: C.accent });
    s += text(ox - 30, oy - 50, "*θ*", { size: 13, weight: 600, color: C.accent, anchor: "end" });
    s += text(ax + 6, ay - 12, "(cos *θ*, sin *θ*)", { size: 13, weight: 650, color: C.x });
    s += text(bx - 6, by - 12, "(−sin *θ*, cos *θ*)", { size: 13, weight: 650, color: C.y, anchor: "middle" });
    const m = matrix(PAD + 252, top + 112, [["cos *θ*", "sin *θ*"], ["−sin *θ*", "cos *θ*"]], [C.x, C.y], 54);
    s += m.s;
  }
  // Right: the quarter turn of v = (2, 1).
  const rx = PAD + lw + 16, rw = W - PAD - rx;
  s += `<rect x="${rx}" y="${top}" width="${rw}" height="${h}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  {
    const U = 30, ox = rx + rw / 2 + 12, oy = top + 112;
    s += grid(ox - 3 * U, oy - 3 * U, 6 * U, 4 * U, U);
    s += line(ox - 3 * U, oy, ox + 3 * U, oy, { color: C.line });
    s += line(ox, oy + U, ox, oy - 3 * U, { color: C.line });
    s += arrow(ox, oy, ox + 2 * U, oy - U, { color: C.ink, width: BOLD });
    s += arrow(ox, oy, ox - U, oy - 2 * U, { color: C.accent, width: BOLD });
    s += arcArrow(ox, oy, 26, 27, 117, { color: C.muted });
    s += text(ox + 2 * U + 6, oy - U + 2, "(2, 1)", { size: 13, weight: 600 });
    s += text(ox - U - 6, oy - 2 * U - 8, "(−1, 2)", { size: 13, weight: 600, color: C.accent, anchor: "end" });
    const m = matrix(rx + 40, top + 172, [["0", "1"], ["−1", "0"]], [C.x, C.y], 30);
    s += m.s;
    s += text(rx + 40 + m.w + 8, top + 172, "· (2, 1) = (−1, 2)", { size: 13, weight: 600, fit: rw - m.w - 40 });
  }
  return svg(height, s);
}
