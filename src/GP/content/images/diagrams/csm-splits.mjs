// Cascaded Shadow Mapping: the camera's view seen from above, split at learnopengl's distances into five cascades –
// 0.1–10, 10–20, 20–50, 50–250 and 250–500 units – in the colours of the chapter's debug view. Not to scale: the depth
// axis is drawn with a square root, or the first cascades would be thin lines.
import { C, PAD, W, line, perLanguage, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("csm-splits");
export const height = 350;

export function draw(v) {
  const cx = PAD + 20, cy = 140, L = W - 2 * PAD - 40, spread = 0.17;
  const X = (d) => cx + Math.sqrt(d / 500) * L;
  const splits = [0.1, 10, 20, 50, 250, 500];
  const colours = ["#e04646", "#2fa84f", "#3b6fe0", "#e0c020", "#c040c0"];
  let s = "";
  for (let i = 0; i < 5; i++) {
    const a = X(splits[i]), b = X(splits[i + 1]);
    const ha = (a - cx) * spread, hb = (b - cx) * spread;
    s += `<path d="M${a},${cy - ha} L${b},${cy - hb} L${b},${cy + hb} L${a},${cy + ha} Z" fill="${colours[i]}" fill-opacity="0.32" stroke="${colours[i]}" stroke-width="2"/>`;
    s += label((a + b) / 2, cy, String(i), { anchor: "middle", weight: 700, size: 22 });
  }
  for (const d of splits.slice(1)) {
    const x = X(d);
    s += line(x, cy + (x - cx) * spread + 6, x, height - PAD - 60, { color: C.line, width: 1, dash: "3 3" });
    s += code(x, height - PAD - 44, t(v, String(d), String(d)), { anchor: "middle", weight: 600 });
  }
  s += `<circle cx="${cx}" cy="${cy}" r="7" fill="${C.ink}"/>`;
  s += label(W / 2, height - PAD - 10, t(v, "distance from the camera (square-root scale)", "avstånd från kameran (kvadratrotsskala)"), { anchor: "middle", color: C.muted, weight: 500 });
  return svg(height, s);
}
