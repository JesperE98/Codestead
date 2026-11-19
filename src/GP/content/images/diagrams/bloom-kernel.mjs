// Bloom, "Gaussian blur": the chapter's nine-tap kernel – the weights 0.227 for the centre and 0.195, 0.122, 0.054,
// 0.016 for the neighbours 1 to 4 texels away – and why two passes are enough: a horizontal pass and then a vertical
// one give the same blur as the 9 × 9 kernel, with 18 samples instead of 81.
import { C, PAD, W, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";

export const variants = perLanguage("bloom-kernel");

const PH = 250;
export const height = PAD + PH + PAD;
const weights = [0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162];

export function draw(v) {
  let s = panel(PAD, PAD, 344, PH);
  // The weights as bars, from -4 to 4.
  const bx = PAD + 26, bw = 34, by = PAD + PH - 46, bh = 140 / 0.23;
  s += label(PAD + 16, PAD + 24, t(v, "The 9 weights", "De 9 vikterna"), { size: 21, weight: 650 });
  for (let i = -4; i <= 4; i++) {
    const w = weights[Math.abs(i)], x = bx + (i + 4) * (bw + 1.5);
    s += `<rect x="${x}" y="${by - w * bh}" width="${bw}" height="${w * bh}" rx="2" fill="${i === 0 ? C.accent : C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
    s += text(x + bw / 2, by + 16, String(i), { size: 19, anchor: "middle", color: C.muted });
  }
  s += line(bx - 4, by, bx + 9 * (bw + 1.5) + 2, by, { color: C.line });
  s += text(bx + 4 * (bw + 1.5) + bw / 2, by - weights[0] * bh - 14, "0.227", { size: 19, anchor: "middle", weight: 600, color: C.accent });
  // The two passes on a grid of texels.
  const gx = PAD + 344 + 16, gw = W - PAD - gx;
  s += panel(gx, PAD, gw, PH);
  s += label(gx + 16, PAD + 24, t(v, "Two passes", "Två pass"), { size: 21, weight: 650 });
  const cell = 15, n = 9;
  const grid = (ox, oy, horizontal) => {
    let g = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const on = horizontal ? r === 4 : c === 4;
        g += `<rect x="${ox + c * cell}" y="${oy + r * cell}" width="${cell}" height="${cell}" fill="${on ? (r === 4 && c === 4 ? C.accent : C.accentSoft) : "#fff"}" stroke="${C.grid}"/>`;
      }
    return g;
  };
  const oy = PAD + 54;
  s += grid(gx + 14, oy, true) + grid(gx + 14 + n * cell + 30, oy, false);
  s += text(gx + 14 + n * cell + 15, oy + (n * cell) / 2, "→", { size: 22, anchor: "middle", weight: 700, color: C.muted });
  s += label(gx + 14 + (n * cell) / 2, oy + n * cell + 20, t(v, "horizontal", "horisontellt"), { anchor: "middle", color: C.muted, fit: n * cell + 20 });
  s += label(gx + 14 + n * cell + 30 + (n * cell) / 2, oy + n * cell + 20, t(v, "vertical", "vertikalt"), { anchor: "middle", color: C.muted, fit: n * cell + 20 });
  return svg(height, s);
}
