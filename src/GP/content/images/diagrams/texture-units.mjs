// Mesh (OpenGL), after the quiz about the naming convention: Mesh::Draw binds texture i to texture unit i and tells
// the sampler named after it – texture_<type><N>, where N counts per type from 1 – to read that unit. The chapter's
// quiz example: a mesh with a diffuse, a specular and a second diffuse texture. Language-free (the code's names).
import { C, PAD, W, arrow, svg } from "./style.mjs";
import { LS, code } from "./_lighting.mjs";

export const variants = [{ out: "texture-units.webp", lang: "en" }];

const rows = [
  ["texture_diffuse", "GL_TEXTURE0", "texture_diffuse", "1", C.accent],
  ["texture_specular", "GL_TEXTURE1", "texture_specular", "1", C.accent2],
  ["texture_diffuse", "GL_TEXTURE2", "texture_diffuse", "2", C.accent],
];
const RH = 52, Y0 = PAD + 34;
export const height = Y0 + rows.length * RH + 6;

export function draw() {
  let s = "";
  const x1 = PAD, x2 = PAD + 300, x3 = PAD + 476;
  s += code(x1, PAD + 12, "textures[i].type", { color: C.muted, size: LS });
  s += code(x2, PAD + 12, "unit", { color: C.muted, size: LS });
  s += code(x3, PAD + 12, "sampler", { color: C.muted, size: LS });
  rows.forEach(([type, unit, name, n, color], i) => {
    const y = Y0 + i * RH, cy = y + RH / 2;
    s += `<rect x="${x1}" y="${y + 6}" width="${W - 2 * PAD}" height="${RH - 12}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += code(x1 + 10, cy, `[${i}] ${type}`, { size: LS, weight: 600, color });
    s += arrow(x2 - 44, cy, x2 - 10, cy, { color: C.line, width: 1.5 });
    s += code(x2, cy, unit, { size: LS, weight: 600 });
    s += arrow(x3 - 44, cy, x3 - 10, cy, { color: C.line, width: 1.5 });
    s += code(x3, cy, name, { size: LS, weight: 600 });
    s += code(x3 + name.length * 11.45, cy, n, { size: LS, weight: 800, color });
  });
  return svg(height, s);
}
