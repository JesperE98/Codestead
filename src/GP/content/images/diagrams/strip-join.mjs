// Tessellation: Height Map – the strips of a grid: each pair of rows is one strip that zigzags between them (every new
// index makes a triangle with the two before it). Drawn as one long strip, the end of one pair and the start of the
// next would be joined by triangles across the whole terrain (red). Language-free.
import { C, PAD, W, dot, line, svg } from "./style.mjs";
import { code } from "./_practice.mjs";

export const variants = [{ out: "strip-join.webp", lang: "en" }];
const COLS = 6, ROWS = 3, DX = 110, DY = 110;
const X0 = (W - (COLS - 1) * DX) / 2, Y0 = PAD + 30;
export const height = Y0 + (ROWS - 1) * DY + 50 + PAD;

export function draw() {
  const p = (c, r) => [X0 + c * DX, Y0 + r * DY];
  let s = "";
  const colours = [C.accent, C.accent2];
  for (let r = 0; r < ROWS - 1; r++) {
    const seq = [];
    for (let c = 0; c < COLS; c++) seq.push(p(c, r), p(c, r + 1));
    for (let k = 2; k < seq.length; k++) {
      const [a, b, d] = [seq[k - 2], seq[k - 1], seq[k]];
      s += `<path d="M${a[0]},${a[1]} L${b[0]},${b[1]} L${d[0]},${d[1]} Z" fill="${colours[r]}" fill-opacity="0.1" stroke="${colours[r]}" stroke-width="1.5"/>`;
    }
    for (let k = 1; k < seq.length; k++) s += line(seq[k - 1][0], seq[k - 1][1], seq[k][0], seq[k][1], { color: colours[r], width: 2.5 });
  }
  // the bad triangles if both strips were one: …, (5, 0), (5, 1), (0, 1), (0, 2), …
  const a = p(COLS - 1, 0), b = p(COLS - 1, 1), c = p(0, 1), d = p(0, 2);
  s += `<path d="M${a[0]},${a[1]} L${b[0]},${b[1]} L${c[0]},${c[1]} Z M${b[0]},${b[1]} L${c[0]},${c[1]} L${d[0]},${d[1]} Z" fill="${C.bad}" fill-opacity="0.08" stroke="${C.bad}" stroke-width="2.5" stroke-dasharray="7 5"/>`;
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = p(c, r);
    s += dot(x, y, { r: 6 }) + code(x + 8, y - 16, String(n++), { weight: 600, color: C.muted });
  }
  return svg(height, s);
}
