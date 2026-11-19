// Advanced Data, "Batching vertex attributes": the bytes of the cube's vertex buffer, interleaved (position and texture
// coordinates of each vertex next to each other, a stride of 20 bytes) and batched (all positions, then all texture
// coordinates: two blocks with strides of 12 and 8 bytes; the second starts at 12 · n for n vertices).
import { C, PAD, W, arrow, perLanguage, svg, t, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = perLanguage("buffer-layout");

const B = 4.2, RH = 40; // px per byte, the height of a row of bytes
const X0 = PAD, R1 = PAD + 74, R2 = R1 + RH + 124;
export const height = R2 + RH + 92;

function cell(x, y, bytes, kind, label) {
  const w = bytes * B;
  const [fill, stroke] = kind === "p" ? [C.accentSoft, C.accent] : [C.accent2Soft, C.accent2];
  return `<rect x="${x}" y="${y}" width="${w}" height="${RH}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    text(x + w / 2, y + RH / 2, label, { anchor: "middle", size: SML, weight: 600, mono: true });
}

/** A bracket above (dir -1) or below (dir 1) a row, from x1 to x2, with a label. */
function bracket(x1, x2, y, dir, label, color) {
  const h = 10 * dir;
  return `<path d="M${x1},${y} v${h} H${x2} v${-h}" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    text(x1, y + h + 18 * dir, label, { size: SML, weight: 600, color });
}

export function draw(v) {
  let s = "";
  // Interleaved: P T P T …
  s += text(X0, PAD + 14, t(v, "Interleaved", "Omväxlande (interleaved)"), { size: LBL, weight: 650 });
  let x = X0;
  for (let i = 0; i < 6; i++) {
    s += cell(x, R1, 12, "p", "P");
    s += cell(x + 12 * B, R1, 8, "t", "T");
    x += 20 * B;
  }
  s += text(x + 10, R1 + RH / 2, "…", { size: LBL, weight: 600 });
  s += bracket(X0, X0 + 20 * B, R1 - 4, -1, t(v, "stride 20", "stride 20"), C.ink);
  s += arrow(X0 + 12 * B, R1 + RH + 34, X0 + 12 * B, R1 + RH + 4, { color: C.accent2, width: 1.5 });
  s += text(X0 + 12 * B + 8, R1 + RH + 30, t(v, "T at offset 12", "T på offset 12"), { size: SML, weight: 600, color: C.accent2 });
  // Batched: P P P … T T T …
  s += text(X0, R2 - 60, t(v, "Batched", "Blockvis (batched)"), { size: LBL, weight: 650 });
  x = X0;
  for (let i = 0; i < 5; i++) (s += cell(x, R2, 12, "p", "P")), (x += 12 * B);
  s += text(x + 18, R2 + RH / 2, "…", { size: LBL, weight: 600, anchor: "middle" });
  x += 36;
  const tStart = x;
  for (let i = 0; i < 6; i++) (s += cell(x, R2, 8, "t", "T")), (x += 8 * B);
  s += text(x + 10, R2 + RH / 2, "…", { size: LBL, weight: 600 });
  s += bracket(X0, X0 + 12 * B, R2 - 4, -1, "stride 12", C.accent);
  s += bracket(tStart, tStart + 8 * B, R2 - 4, -1, "stride 8", C.accent2);
  s += arrow(tStart, R2 + RH + 34, tStart, R2 + RH + 4, { color: C.accent2, width: 1.5 });
  s += text(tStart + 8, R2 + RH + 30, t(v, "T block at offset 12 · n", "T-blocket på offset 12 · n"), { size: SML, weight: 600, color: C.accent2 });
  // Legend.
  const ly = height - PAD - 10;
  s += `<rect x="${X0}" y="${ly - 10}" width="20" height="20" fill="${C.accentSoft}" stroke="${C.accent}"/>`;
  s += text(X0 + 28, ly, t(v, "P: position, 12 bytes", "P: position, 12 byte"), { size: SML });
  s += `<rect x="${X0 + 300}" y="${ly - 10}" width="20" height="20" fill="${C.accent2Soft}" stroke="${C.accent2}"/>`;
  s += text(X0 + 328, ly, t(v, "T: texture coordinates, 8 bytes", "T: texturkoordinater, 8 byte"), { size: SML, fit: W - PAD - X0 - 330 });
  return svg(height, s);
}
