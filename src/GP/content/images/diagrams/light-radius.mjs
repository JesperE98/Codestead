// Deferred Shading, "Calculating a light's volume or radius": a light's brightest channel times its attenuation
// 1 / (1 + 0.7 d + 1.8 d²) over the distance d, for a channel of 1.0 and of 0.5, and the threshold 5/256 below which a
// contribution is hardly visible. Where a curve crosses it is the light's radius: about 5.1 and 3.5 units.
import { BOLD, C, PAD, W, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, plot } from "./_advlight.mjs";

export const variants = perLanguage("light-radius");

const PWID = 470, PHGT = 250;
export const height = PAD + PHGT + 76;

const att = (d) => 1 / (1 + 0.7 * d + 1.8 * d * d);
const radius = (imax) => (-0.7 + Math.sqrt(0.49 - 4 * 1.8 * (1 - (256 / 5) * imax))) / (2 * 1.8);

export function draw(v) {
  const px = PAD + 66, py = PAD + 10;
  const p = plot(px, py, PWID, PHGT, [0, 6], [0, 0.1]);
  let s = p.axes({ xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 0.05, 0.1], yfmt: (y) => y.toFixed(2), xgrid: [1, 2, 3, 4, 5, 6], ygrid: [0.025, 0.05, 0.075, 0.1] });
  s += label(px + PWID / 2, py + PHGT + 44, t(v, "distance d", "avstånd d"), { anchor: "middle", color: C.muted });
  // The threshold.
  const th = 5 / 256;
  s += line(px, p.Y(th), px + PWID, p.Y(th), { color: C.bad, width: 2, dash: "6 4" });
  s += text(px + PWID + 10, p.Y(th), "5/256", { size: 19, weight: 650, color: C.bad });
  const lines = [[1.0, C.accent, "1.0"], [0.5, C.accent2, "0.5"]];
  for (const [imax, color] of lines) s += p.curve((d) => imax * att(d), { color, width: BOLD, from: (-0.7 + Math.sqrt(0.49 - 7.2 * (1 - imax / 0.1))) / 3.6 });
  lines.forEach(([imax, color, name], i) => {
    const r = radius(imax);
    s += line(p.X(r), p.Y(th), p.X(r), py + PHGT, { color, width: 1.5, dash: "3 3" });
    s += dot(p.X(r), p.Y(th), { r: 5.5, color });
    s += text(p.X(r) + 8, p.Y(th) - 16 - i * 0, `${r.toFixed(1)}`, { size: 19, weight: 700, color });
    // The legend, top right.
    const ly = py + 26 + i * 34;
    s += line(px + PWID - 200, ly, px + PWID - 170, ly, { color, width: BOLD }) + label(px + PWID - 160, ly, `*I*_{max} = ${name}`, { color });
  });
  return svg(height, s);
}
