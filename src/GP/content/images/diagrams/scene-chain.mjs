// Scene Graph: the chain of planets. Every child sits at (3.5, 0, 0) with scale 0.6 in its parent's space; since the
// parent's global matrix also scales the offset, the steps in the world shrink – 3.5, 2.1, 1.26, … – and the planets
// land at 0, 3.5, 5.6, 6.86, 7.62, …, each 0.6 times the size of the one before.
import { C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("scene-chain");
export const height = 300;
const U = 66, X0 = PAD + 70, Y = 150;

export function draw(v) {
  const n = (x) => t(v, String(x), String(x).replace(".", ","));
  let s = "";
  const xs = [], rs = [];
  let x = 0, scale = 1;
  for (let i = 0; i < 9; i++) { xs.push(x); rs.push(scale); x += 3.5 * scale; scale *= 0.6; }
  s += line(X0 - 40, Y, W - PAD - 6, Y, { color: C.line, width: 1.2 });
  xs.forEach((wx, i) => {
    const cx = X0 + wx * U, r = 34 * rs[i];
    s += `<circle cx="${cx}" cy="${Y}" r="${r}" fill="${i === 0 ? C.accentSoft : C.zSoft}" stroke="${i === 0 ? C.accent : C.z}" stroke-width="2"/>`;
    s += `<ellipse cx="${cx}" cy="${Y}" rx="${r * 1.7}" ry="${r * 0.35}" fill="none" stroke="${i === 0 ? C.accent : C.z}" stroke-width="1.5"/>`;
    if (i < 4) {
      s += dot(cx, Y, { r: 3.5 });
      s += code(cx, Y + 74, n(+wx.toFixed(2)), { anchor: "middle", weight: 600, color: C.accent2 });
    }
    if (i > 0 && i < 4) {
      const px = X0 + xs[i - 1] * U;
      s += arrow(px, Y - 62, cx, Y - 62, { color: C.accent, width: 2, both: true });
      s += code((px + cx) / 2, Y - 84, i === 1 ? "3.5" : `3.5·${n(+(rs[i - 1]).toFixed(2))}`.replace("3.5", n(3.5)), { anchor: "middle", color: C.accent, weight: 600 });
    }
  });
  s += label(PAD, Y - 62, t(v, "local", "lokalt"), { color: C.accent, size: 19 });
  s += label(PAD, Y + 74, t(v, "global", "globalt"), { color: C.accent2 });
  s += label(W / 2, height - PAD - 10, t(v, "global(child) = global(parent) · local(child)", "global(barn) = global(förälder) · lokal(barn)"), { anchor: "middle", weight: 500, fit: W - 2 * PAD });
  return svg(height, s);
}
