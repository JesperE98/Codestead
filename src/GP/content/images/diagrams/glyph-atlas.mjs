// Text Rendering (Vulkan, Direct3D 12): the glyph atlas the projects build – 1024 × 512 texels, 16 × 8 cells of 64 × 64,
// glyph c in cell (c % 16, c / 16), copied to the cell's top left – made from the simulator's table of the course's font
// at 48 pixels, as the R8 texture holds it (coverage, white on black). One cell is picked out: 'g', character 103.
import { C, PAD, W, line, svg } from "./style.mjs";
import { code, glyph, pngUrl } from "./_practice.mjs";

export const variants = [{ out: "glyph-atlas.webp", lang: "en" }];
const AW = 1024, AH = 512, CELL = 64;
const DW = W - 2 * PAD, DH = (DW * AH) / AW; // the atlas in the drawing
const K = DW / AW;
export const height = PAD + 34 + DH + 44 + PAD;

function atlas() {
  const px = new Uint8Array(AW * AH * 4);
  for (let i = 0; i < AW * AH; i++) { px[i * 4] = 24; px[i * 4 + 1] = 27; px[i * 4 + 2] = 34; px[i * 4 + 3] = 255; }
  for (let c = 32; c < 127; c++) {
    const g = glyph(48, c);
    const ox = (c % 16) * CELL, oy = Math.floor(c / 16) * CELL;
    for (let y = 0; y < g.rows; y++)
      for (let x = 0; x < g.width; x++) {
        const a = g.bitmap[y * g.pitch + x] / 255, p = ((oy + y) * AW + ox + x) * 4;
        for (let k = 0; k < 3; k++) px[p + k] = Math.round(px[p + k] * (1 - a) + 255 * a);
      }
  }
  return pngUrl(AW, AH, px);
}

export function draw() {
  const x0 = PAD, y0 = PAD + 34;
  let s = `<image href="${atlas()}" x="${x0}" y="${y0}" width="${DW}" height="${DH}" preserveAspectRatio="none"/>`;
  for (let i = 0; i <= 16; i++) s += line(x0 + i * CELL * K, y0, x0 + i * CELL * K, y0 + DH, { color: "#4a5262", width: 1 });
  for (let j = 0; j <= 8; j++) s += line(x0, y0 + j * CELL * K, x0 + DW, y0 + j * CELL * K, { color: "#4a5262", width: 1 });
  // the cell of 'g' and the glyph's own rectangle in it
  const c = 103, g = glyph(48, c);
  const cx = x0 + (c % 16) * CELL * K, cy = y0 + Math.floor(c / 16) * CELL * K;
  s += `<rect x="${cx}" y="${cy}" width="${CELL * K}" height="${CELL * K}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  s += `<rect x="${cx}" y="${cy}" width="${g.width * K}" height="${g.rows * K}" fill="none" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  s += code(x0, PAD + 14, "1024 × 512", { weight: 600 });
  s += code(x0 + DW, PAD + 14, "16 × 8 · 64 × 64", { weight: 600, anchor: "end" });
  s += code(cx + CELL * K / 2, y0 + DH + 24, "'g' = 103 → (103 % 16, 103 / 16) = (7, 6)", { anchor: "middle", weight: 600, color: C.accent });
  return svg(height, s);
}
