// Setting up, delta time: the paddle at 500 pixels per second over the first tenth of a second, at 60 and at 120 frames
// per second. Every dot is where a frame draws it: 8.3 or 4.2 pixels further each frame, and 50 pixels after 0.1 s either way.
import { C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { code, gameTexture, label, num } from "./_practice.mjs";

export const variants = perLanguage("delta-time");
const X0 = 150, X1 = W - PAD - 60; // 0 … 50 pixels of movement
const ROW = 104;
export const height = PAD + 30 + 2 * ROW + 40 + PAD;

export function draw(v) {
  const paddle = gameTexture("paddle");
  const k = (X1 - X0) / 50;
  let s = label(PAD, PAD + 12, t(v, "500 pixels per second · 0 … 0.1 s", "500 pixlar per sekund · 0 … 0,1 s").replace("0.1", num(v, 0.1)), { color: C.muted, weight: 500 });
  [[60, C.accent], [120, C.accent2]].forEach(([fps, color], r) => {
    const y = PAD + 30 + r * ROW + 50;
    s += label(PAD, y - 12, `${fps} fps`, { weight: 700 });
    s += code(PAD, y + 16, `dt = 1/${fps}`, { color: C.muted });
    s += line(X0, y, X1, y, { color: C.line, width: 1.5 });
    const n = fps / 10;
    for (let i = 0; i <= n; i++) s += dot(X0 + (500 / fps) * i * k, y, { r: r === 0 ? 6 : 4.5, color });
    // the paddle at the end, 100 × 20 scaled like the movement
    s += `<image href="${paddle}" x="${X1 - 22}" y="${y - 40}" width="44" height="11" preserveAspectRatio="none" opacity="0.9"/>`;
    const step = num(v, (500 / fps).toFixed(1));
    s += arrow(X0, y + 28, X0 + (500 / fps) * k, y + 28, { color, width: 2, both: true });
    s += label(X0 + (500 / fps) * k + 10, y + 28, t(v, `${step} px per frame`, `${step} px per bildruta`), { color, size: 19 });
  });
  const yb = PAD + 30 + 2 * ROW + 16;
  s += arrow(X0, yb, X1, yb, { color: C.ink, width: 2, both: true });
  s += label((X0 + X1) / 2, yb + 22, t(v, "50 pixels after 0.1 s in both", "50 pixlar efter 0,1 s i båda"), { anchor: "middle" });
  return svg(height, s);
}
