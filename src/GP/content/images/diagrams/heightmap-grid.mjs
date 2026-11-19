// Tessellation: Height Map – every pixel of the course's height map becomes a vertex: its column j gives x, its row i
// gives z (both centred), its grey value the height. Language-free.
import { C, PAD, arrow, asset, image, svg, text } from "./style.mjs";
import { code } from "./_practice.mjs";

export const variants = [{ out: "heightmap-grid.webp", lang: "en" }];
const S = 256;
export const height = PAD + S + 40 + PAD;

export function draw() {
  const L0 = PAD + 30;
  let s = image(asset("opengl/tessellation-height-map/solution/heightmap.png"), L0, PAD, S, S, { pixelated: true });
  const j = 176, i = 70; // a pixel on the ridge
  s += `<rect x="${L0 + j - 5}" y="${PAD + i - 5}" width="10" height="10" fill="none" stroke="${C.accent}" stroke-width="2.5"/>`;
  s += arrow(L0, PAD + S + 16, L0 + 80, PAD + S + 16, { color: C.x, width: 2 }) + code(L0 + 90, PAD + S + 16, "j", { color: C.x, weight: 700 });
  s += arrow(L0 - 14, PAD, L0 - 14, PAD + 80, { color: C.z, width: 2 }) + code(L0 - 14, PAD + 98, "i", { color: C.z, weight: 700, anchor: "middle" });
  s += arrow(L0 + j + 10, PAD + i, L0 + S + 50, PAD + 70, { color: C.accent, width: 2 });
  const x0 = L0 + S + 64;
  const lines = [["*x* = *j* − 128", C.x], ["*z* = *i* − 128", C.z], ["*y* = *value* · 64 / 256 − 16", C.y]];
  lines.forEach(([l, c], k) => (s += text(x0, PAD + 70 + k * 44, l, { size: 22, weight: 600, color: c })));
  s += code(x0, PAD + 70 + 3 * 44 + 6, "−16 … 47.75", { color: C.muted, weight: 600 });
  return svg(height, s);
}
