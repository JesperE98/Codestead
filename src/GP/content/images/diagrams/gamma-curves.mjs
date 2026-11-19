// Gamma Correction, "Gamma correction": the monitor's curve (value^2.2), the correction (value^(1/2.2)) and what
// reaches the eye when both are applied (the straight line) – with the chapter's examples: 0.5 is shown as 0.218, and
// 0.5 corrected to 0.73 is shown as 0.5.
import { BOLD, C, PAD, W, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, plot } from "./_advlight.mjs";

export const variants = perLanguage("gamma-curves");

const SIZE = 300;
export const height = PAD + SIZE + 98;

export function draw(v) {
  const px = PAD + 82, py = PAD + 34;
  const p = plot(px, py, SIZE, SIZE, [0, 1], [0, 1]);
  let s = p.axes({ xticks: [0, 0.5, 1], yticks: [0, 1], xfmt: (x) => x.toFixed(1), yfmt: (x) => x.toFixed(1), xgrid: [0.25, 0.5, 0.75], ygrid: [0.25, 0.5, 0.75] });
  s += label(px + SIZE / 2, py + SIZE + 40, t(v, "value", "värde"), { anchor: "middle", color: C.muted });
  s += label(px - 8, py - 22, t(v, "brightness", "ljusstyrka"), { color: C.muted });
  s += p.curve((x) => x, { color: C.line, width: 2, dash: "6 5" });
  s += p.curve((x) => Math.pow(x, 2.2), { color: C.z, width: BOLD });
  s += p.curve((x) => Math.pow(x, 1 / 2.2), { color: C.accent, width: BOLD });
  // 0.5 → 0.218 on the monitor's curve; 0.5 → 0.73 corrected.
  const [ax, ay] = p.P(0.5, Math.pow(0.5, 2.2)), [bx, by] = p.P(0.5, Math.pow(0.5, 1 / 2.2));
  s += line(ax, p.Y(0), ax, by, { color: C.muted, width: 1, dash: "4 3" });
  s += line(p.X(0), ay, ax, ay, { color: C.z, width: 1.5, dash: "4 3" });
  s += line(p.X(0), by, bx, by, { color: C.accent, width: 1.5, dash: "4 3" });
  s += dot(ax, ay, { r: 5, color: C.z }) + dot(bx, by, { r: 5, color: C.accent });
  s += text(p.X(0) - 9, ay, "0.218", { size: 19, color: C.z, weight: 650, anchor: "end" });
  s += text(p.X(0) - 9, by, "0.73", { size: 19, color: C.accent, weight: 650, anchor: "end" });
  // The legend, to the right.
  const lx = px + SIZE + 34;
  const entry = (y, color, dash, name, formula) =>
    line(lx, y, lx + 34, y, { color, width: BOLD, dash }) + label(lx + 46, y - 12, name, { color, fit: W - PAD - lx - 46 }) +
    text(lx + 46, y + 14, formula, { size: 19, mono: true, color: C.muted, weight: 500 });
  s += entry(py + 30, C.z, undefined, t(v, "the monitor", "bildskärmen"), "v^2.2");
  s += entry(py + 110, C.accent, undefined, t(v, "the correction", "korrigeringen"), "v^(1/2.2)");
  s += entry(py + 190, C.line, "6 5", t(v, "both: linear", "båda: linjärt"), "(v^(1/2.2))^2.2 = v");
  return svg(height, s);
}
