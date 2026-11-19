// DSA, the separate attribute format: each attribute's format (components, type, offset within a vertex), the binding
// point it reads from, and the buffer with its offset and stride behind that binding point – the course's rectangle
// with position (3 floats) and texture coordinates (2 floats) interleaved, five floats per vertex. Language-free.
import { BOLD, C, PAD, W, arrow, box, svg } from "./style.mjs";
import { code } from "./_practice.mjs";

export const variants = [{ out: "attrib-format.webp", lang: "en" }];
export const height = 470;

export function draw() {
  let s = "";
  const aw = 300;
  s += code(W / 2, PAD + 12, "glVertexArrayAttribFormat", { anchor: "middle", weight: 600, color: C.accent });
  s += box(PAD + 20, PAD + 32, aw, 66, { style: "accent" }) + code(PAD + 20 + aw / 2, PAD + 52, "attribute 0", { anchor: "middle", weight: 700 }) + code(PAD + 20 + aw / 2, PAD + 78, "3 × GL_FLOAT, +0", { anchor: "middle" });
  s += box(W - PAD - 20 - aw, PAD + 32, aw, 66, { style: "accent" }) + code(W - PAD - 20 - aw / 2, PAD + 52, "attribute 1", { anchor: "middle", weight: 700 }) + code(W - PAD - 20 - aw / 2, PAD + 78, "2 × GL_FLOAT, +12", { anchor: "middle" });
  const by = 200;
  s += arrow(PAD + 20 + aw / 2, PAD + 102, W / 2 - 30, by - 4, { color: C.ink, width: BOLD });
  s += arrow(W - PAD - 20 - aw / 2, PAD + 102, W / 2 + 30, by - 4, { color: C.ink, width: BOLD });
  s += code(W - PAD - 6, PAD + 136, "glVertexArrayAttribBinding", { anchor: "end", weight: 600, color: C.ink });
  s += box(W / 2 - 170, by, 340, 66, { style: "accent2" }) + code(W / 2, by + 20, "binding point 0", { anchor: "middle", weight: 700 }) + code(W / 2, by + 46, "VBO, offset 0, stride 20", { anchor: "middle" });
  s += code(W / 2 + 12, by + 98, "glVertexArrayVertexBuffer", { weight: 600, color: C.accent2 });
    // the buffer: two vertices of five floats
  const y = 340, fw = 64, x0 = (W - 10 * fw) / 2;
  const kinds = ["x", "y", "z", "s", "t"];
  for (let i = 0; i < 10; i++) {
    const k = i % 5;
    s += `<rect x="${x0 + i * fw}" y="${y}" width="${fw}" height="44" fill="${k < 3 ? C.accentSoft : C.ySoft}" stroke="${C.boxStroke}"/>`;
    s += code(x0 + i * fw + fw / 2, y + 22, kinds[k], { anchor: "middle", weight: 600 });
  }
  s += arrow(W / 2, by + 70, W / 2, y - 6, { color: C.accent2, width: BOLD });
  s += arrow(x0, y + 62, x0 + 5 * fw, y + 62, { color: C.accent2, width: 2, both: true });
  s += code(x0 + 2.5 * fw, y + 86, "stride = 5 · 4 = 20", { anchor: "middle", color: C.accent2, weight: 600 });
  s += arrow(x0, y - 14, x0 + 3 * fw, y - 14, { color: C.accent, width: 1.5, both: true });
  s += code(x0 + 3 * fw + 8, y - 14, "+12", { color: C.accent, weight: 600 });
  return svg(height, s);
}
