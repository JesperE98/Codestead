// OIT: Weighted Blended, learnopengl's weight function over the window depth z, on a logarithmic scale: before the clamp
// (dashed) for alpha 0.5 and for a faint alpha of 0.01, and the clamp to 0.01 … 3000. With alpha 0.5 the function never
// falls below 3000 – every layer, near or far, gets the same weight; the chapter's quads lie at z ≈ 0.97–0.98.
import { C, PAD, W, arrow, line, perLanguage, svg, t, text } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("wb-weight");
export const height = 420;
const X0 = PAD + 70, X1 = W - PAD - 20, Y0 = PAD + 20, Y1 = height - PAD - 56;
const LMIN = -3, LMAX = 9; // log10 range
const px = (z) => X0 + z * (X1 - X0), py = (w) => Y1 - ((Math.log10(w) - LMIN) / (LMAX - LMIN)) * (Y1 - Y0);
const raw = (a, z) => Math.pow(Math.min(1, a * 10) + 0.01, 3) * 1e8 * Math.pow(1 - z * 0.9, 3);

export function draw(v) {
  let s = "";
  for (let e = LMIN; e <= LMAX; e += 3) {
    s += line(X0, py(10 ** e), X1, py(10 ** e), { color: C.grid, width: 1 });
    s += text(X0 - 10, py(10 ** e), `10^{${e}}`, { size: 19, anchor: "end", color: C.muted });
  }
  // the clamp band
  s += `<rect x="${X0}" y="${py(3000)}" width="${X1 - X0}" height="${py(0.01) - py(3000)}" fill="${C.accentSoft}" opacity="0.6"/>`;
  s += code(X0 + 8, py(3000) - 14, "3000", { color: C.accent, weight: 600 });
  s += code(X0 + 8, py(0.01) - 14, t(v, "0.01", "0,01"), { color: C.accent, weight: 600 });
  for (const [a, color] of [[0.5, C.accent2], [0.01, C.z]]) {
    let d = "", dc = "";
    for (let i = 0; i <= 100; i++) {
      const z = i / 100, w = raw(a, z), c = Math.min(3000, Math.max(0.01, w));
      d += `${i ? "L" : "M"}${px(z)},${py(w)}`; dc += `${i ? "L" : "M"}${px(z)},${py(c)}`;
    }
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/><path d="${dc}" fill="none" stroke="${color}" stroke-width="3.5"/>`;
    s += label(px(0.18), py(raw(a, 0.18)) - 18, `*α* = ${a}`.replace(".", t(v, ".", ",")), { color });
  }
  // the quads' depths
  s += `<rect x="${px(0.97)}" y="${Y0}" width="${px(0.98) - px(0.97) + 2}" height="${Y1 - Y0}" fill="${C.ink}" opacity="0.5"/>`;
  s += label(px(0.97) - 8, Y0 + 14, t(v, "the quads", "fyrhörningarna"), { anchor: "end", color: C.ink });
  s += arrow(X0, Y1, X1 + 8, Y1, { color: C.ink, width: 1.5 });
  for (const z of [0, 0.5, 1]) s += code(px(z), Y1 + 20, String(z).replace(".", t(v, ".", ",")), { anchor: "middle", color: C.muted });
  s += label((X0 + X1) / 2, Y1 + 46, t(v, "window depth *z*", "fönsterdjup *z*"), { anchor: "middle", color: C.muted });
  return svg(height, s);
}
