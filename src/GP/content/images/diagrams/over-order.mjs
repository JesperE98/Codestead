// OIT: Introduction, the over operator is not commutative: a green and a blue layer, both with alpha 0.5, blended over
// black in the two orders – the layer blended last dominates. Language-free.
import { C, PAD, W, arrow, svg } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = [{ out: "over-order.webp", lang: "en" }];
const S = 74, ROW = 140;
export const height = PAD + 2 * ROW + PAD - 30;

const css = ([r, g, b]) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
const over = (src, dst) => src.map((c, i) => c * 0.5 + dst[i] * 0.5);

export function draw() {
  let s = "";
  const G = [0, 1, 0], B = [0, 0, 1];
  [[G, B], [B, G]].forEach(([a, b], r) => {
    const y = PAD + r * ROW;
    const c1 = over(a, [0, 0, 0]), c2 = over(b, c1);
    const xs = [PAD + 10, PAD + 250, PAD + 500];
    [[0, 0, 0], c1, c2].forEach((c, i) => {
      s += `<rect x="${xs[i]}" y="${y}" width="${S}" height="${S}" rx="6" fill="${css(c)}" stroke="${C.boxStroke}"/>`;
      s += code(xs[i] + S / 2, y + S + 22, `(${c.map((k) => +k.toFixed(2)).join(", ")})`, { anchor: "middle", weight: 600 });
    });
    [a, b].forEach((layer, i) => {
      const x0 = xs[i] + S + 14, x1 = xs[i + 1] - 14;
      s += arrow(x0, y + S / 2, x1, y + S / 2, { color: C.line, width: 2.5 });
      s += `<rect x="${(x0 + x1) / 2 - 22}" y="${y + S / 2 - 46}" width="44" height="28" rx="4" fill="${css(layer)}" fill-opacity="0.5" stroke="${css(layer)}"/>`;
      s += label((x0 + x1) / 2, y + S / 2 + 22, "*over*", { anchor: "middle", color: C.muted, weight: 500 });
    });
  });
  return svg(height, s);
}
