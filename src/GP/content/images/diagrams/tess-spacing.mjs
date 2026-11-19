// Tessellation: a quad patch with all six levels at 8, as the tessellator cuts its (u, v) square – with equal spacing
// 8 × 8 equal parts; with fractional odd spacing the level is rounded up to 9 parts, seven of length 1/8 and two shorter
// ones (1/16 each), placed symmetrically. Where exactly the short ones lie is up to the hardware. Language-free; the
// spacing's name differs between GLSL and HLSL.
import { C, PAD, W, line, svg } from "./style.mjs";
import { code } from "./_practice.mjs";

export const variants = [
  { out: "tess-spacing-opengl-vulkan.webp", lang: "en", names: ["equal_spacing", "fractional_odd_spacing"] },
  { out: "tess-spacing-d3d12.webp", lang: "en", names: ['"integer"', '"fractional_odd"'] },
];
const S = 260, GAP = (W - 2 * PAD - 2 * S) / 1;
export const height = PAD + S + 80 + PAD - 10;

export function draw(v) {
  const equal = Array.from({ length: 9 }, (_, i) => i / 8);
  const seg = [1 / 8, 1 / 8, 1 / 8, 1 / 16, 1 / 8, 1 / 16, 1 / 8, 1 / 8, 1 / 8];
  const odd = [0]; for (const l of seg) odd.push(odd.at(-1) + l);
  let s = "";
  [[equal, v.names[0], "8 × 8"], [odd, v.names[1], "9 × 9"]].forEach(([cuts, name, n], k) => {
    const x0 = PAD + k * (S + GAP), y0 = PAD;
    s += `<rect x="${x0}" y="${y0}" width="${S}" height="${S}" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`;
    for (const c of cuts.slice(1, -1)) {
      s += line(x0 + c * S, y0, x0 + c * S, y0 + S, { color: k ? C.accent2 : C.accent, width: 1.5 });
      s += line(x0, y0 + c * S, x0 + S, y0 + c * S, { color: k ? C.accent2 : C.accent, width: 1.5 });
    }
    s += code(x0 + S / 2, y0 + S + 26, name, { anchor: "middle", weight: 600 });
    s += code(x0 + S / 2, y0 + S + 56, n, { anchor: "middle", weight: 600, color: k ? C.accent2 : C.accent });
  });
  return svg(height, s);
}
