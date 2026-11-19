// HDR, "Exposure": what the tone mapping curves make of HDR values from 0 to 6 – the 8-bit window's clamp, Reinhard
// x / (x + 1), and the exposure curve 1 − e^(−x · exposure) with the chapter's exposures 0.1, 1.0 and 5.0.
import { BOLD, C, PAD, W, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, plot } from "./_advlight.mjs";

export const variants = perLanguage("tone-curves");

const PWID = 400, PHGT = 290;
export const height = PAD + PHGT + 70;

export function draw(v) {
  const px = PAD + 50, py = PAD + 12;
  const p = plot(px, py, PWID, PHGT, [0, 6], [0, 1.05]);
  let s = p.axes({ xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 0.5, 1], yfmt: (y) => y.toFixed(1), ygrid: [0.25, 0.5, 0.75, 1], xgrid: [1, 2, 3, 4, 5, 6] });
  s += label(px + PWID / 2, py + PHGT + 44, t(v, "HDR value", "HDR-värde"), { anchor: "middle", color: C.muted });
  const curves = [
    [(x) => Math.min(x, 1), C.line, "6 5", t(v, "clamped (8 bits)", "klippt (8 bitar)"), 1.5],
    [(x) => x / (x + 1), C.accent, undefined, "Reinhard", BOLD],
    [(x) => 1 - Math.exp(-x * 0.1), C.z, undefined, t(v, "exposure 0.1", "exponering 0.1"), 2],
    [(x) => 1 - Math.exp(-x * 1.0), C.accent2, undefined, t(v, "exposure 1.0", "exponering 1.0"), BOLD],
    [(x) => 1 - Math.exp(-x * 5.0), C.y, undefined, t(v, "exposure 5.0", "exponering 5.0"), 2],
  ];
  for (const [f, color, dash, , width] of curves) s += p.curve(f, { color, dash, width });
  // The legend.
  const lx = px + PWID + 30, fit = W - PAD - lx - 40;
  curves.forEach(([, color, dash, name, width], i) => {
    const y = py + 16 + i * 40;
    s += line(lx, y, lx + 30, y, { color, dash, width: Math.max(width, 2.5) }) + label(lx + 40, y, name, { color: color === C.line ? C.muted : color, fit });
  });
  void text;
  return svg(height, s);
}
