// Mesh (Direct3D 12), after the quiz about a mesh without a specular map: the CBV/SRV heap of the program – the CBV in
// slot 0 and two slots per mesh, the diffuse map (t0) and the specular map (t1). Each mesh keeps the GPU handle of its
// first slot, m_srvHandle, and Draw points root parameter 2's table there. Language-free (the code's names).
import { C, PAD, W, arrow, line, svg } from "./style.mjs";
import { LS, code } from "./_lighting.mjs";

export const variants = [{ out: "heap-slots.webp", lang: "en" }];

const SW = 96, SY = PAD + 34, SH = 52;
export const height = SY + SH + 150;

export function draw() {
  let s = "";
  const slots = [["CBV", C.line], ["t0", C.accent], ["t1", C.accent], ["t0", C.accent2], ["t1", C.accent2], ["…", C.line]];
  const X = (i) => PAD + 4 + i * (SW + 8);
  slots.forEach(([name, color], i) => {
    const soft = color === C.accent ? C.accentSoft : color === C.accent2 ? C.accent2Soft : "#eef0f4";
    s += code(X(i) + SW / 2, PAD + 12, i < 5 ? String(i) : "5 … 16", { anchor: "middle", color: C.muted, size: LS });
    s += `<rect x="${X(i)}" y="${SY}" width="${SW}" height="${SH}" rx="6" fill="${soft}" stroke="${color}" stroke-width="1.5"${i === 5 ? ' stroke-dasharray="5 4"' : ""}/>`;
    s += code(X(i) + SW / 2, SY + SH / 2, name, { anchor: "middle", weight: 650 });
  });
  // The meshes' pairs of slots, and their handles.
  [["planet", 1, C.accent], ["rings", 3, C.accent2]].forEach(([mesh, first, color]) => {
    const x0 = X(first), x1 = X(first + 1) + SW, by = SY + SH + 12;
    s += `<path d="M${x0},${by} L${x0},${by + 8} L${x1},${by + 8} L${x1},${by}" fill="none" stroke="${color}" stroke-width="2"/>`;
    s += code((x0 + x1) / 2, by + 30, mesh, { anchor: "middle", weight: 650, color });
    s += arrow(x0 + 18, by + 92, x0 + 18, SY + SH + 2, { color, width: 2 });
    s += code(x0 + 30, by + 76, "m_srvHandle", { size: LS, color, weight: 600 });
  });
  s += line(X(0) + SW / 2, SY + SH + 4, X(0) + SW / 2, SY + SH + 14, { color: C.line });
  s += code(X(0) + SW / 2, SY + SH + 30, "b1", { anchor: "middle", color: C.muted });
  return svg(height, s);
}
