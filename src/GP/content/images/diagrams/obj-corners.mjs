// Assimp, after the quiz about the face corners: one corner of the ring's first face, 563/563/562, is three indices –
// into the positions (v), the texture coordinates (vt) and the normals (vn), each counted from 1 – shown with the
// file's own lines. A vertex for the GPU has the three values side by side and one index for all of them.
// Language-free (the file's lines and the course's struct name).
import { C, PAD, W, arrow, svg } from "./style.mjs";
import { L, code } from "./_lighting.mjs";

export const variants = [{ out: "obj-corners.webp", lang: "en" }];

const COLORS = [C.accent, C.accent2, C.z];
const SOFT = [C.accentSoft, C.accent2Soft, C.zSoft];
const CH = 12.1; // JetBrains Mono at 20 px: about 12.1 px per character
const LX = PAD + 120, LH = 28, BH = 3 * LH + 10, LY = PAD + 70;
const VY = LY + 3 * (BH + 12) + 8;
export const height = VY + 56 + PAD;

export function draw() {
  let s = "";
  // The face line, with the corner in question boxed.
  const fy = PAD + 18;
  s += code(PAD + 4, fy, "f 562/562/562", { size: L, color: C.muted });
  const cx = PAD + 4 + 14 * CH;
  s += code(cx, fy, "563/563/562", { size: L, weight: 700 });
  s += `<rect x="${cx - 6}" y="${fy - 17}" width="${11 * CH + 12}" height="34" rx="6" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
  s += code(cx + 12 * CH, fy, "565/565/562", { size: L, color: C.muted });
  // The corner's three indices, one per list, and the lists.
  const lists = [
    ["v", [[562, "1.40000 0.00000 -0.00000"], [563, "2.00000 0.00000 -0.00000"], [564, "1.38802 0.00000 -0.18274"]], 563],
    ["vt", [[562, "0.00000 0.00000"], [563, "1.00000 0.00000"], [564, "0.00000 0.02083"]], 563],
    ["vn", [[561, "0.00000 -1.00000 0.00000"], [562, "0.00000 1.00000 0.00000"], [563, "…"]], 562],
  ];
  s += arrow(cx + 5.5 * CH, fy + 20, PAD + 44, LY - 6, { color: C.ink, width: 1.5 });
  lists.forEach(([kind, lines, pick], i) => {
    const y = LY + i * (BH + 12);
    s += `<rect x="${LX}" y="${y}" width="${W - PAD - LX}" height="${BH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    lines.forEach(([n, val], j) => {
      const ly = y + 5 + LH * j + LH / 2;
      const on = n === pick;
      if (on) {
        s += `<rect x="${LX + 4}" y="${ly - LH / 2 + 1}" width="${W - PAD - LX - 8}" height="${LH - 2}" rx="4" fill="${SOFT[i]}"/>`;
        s += code(PAD + 44, ly, String(n), { size: L, anchor: "middle", weight: 700, color: COLORS[i] });
        s += arrow(PAD + 72, ly, LX - 6, ly, { color: COLORS[i], width: 2 });
      }
      s += code(LX + 14, ly, `${String(n)}  ${kind} ${val}`, { color: on ? C.ink : C.muted, weight: on ? 600 : 500 });
    });
  });
  // The GPU vertex: all three side by side, one index.
  s += code(PAD + 4, VY + 28, "Vertex", { size: L, weight: 700 });
  const segs = [["2, 0, 0", 0.4], ["1, 0", 0.25], ["0, 1, 0", 0.35]];
  let sx = LX;
  segs.forEach(([lbl, f], i) => {
    const w = (W - PAD - LX) * f;
    s += `<rect x="${sx + 2}" y="${VY + 6}" width="${w - 4}" height="44" rx="6" fill="${SOFT[i]}" stroke="${COLORS[i]}" stroke-width="1.5"/>`;
    s += code(sx + w / 2, VY + 28, lbl, { anchor: "middle", weight: 600 });
    sx += w;
  });
  return svg(height, s);
}
