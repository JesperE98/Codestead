// Levels: level one's file and the wall it becomes in the area of 800 × 300 pixels – 15 columns of 800 / 15 ≈ 53.3
// pixels and 8 rows of 300 / 8 = 37.5 pixels; 0 is no brick, 1 a solid stone, 2 … 5 a light tile tinted blue, green,
// yellow, orange. Language-free.
import { C, PAD, W, arrow, svg } from "./style.mjs";
import { code, gameTexture, tintFilter } from "./_practice.mjs";
import { readFileSync } from "node:fs";

export const variants = [{ out: "level-file.webp", lang: "en" }];
const LH = 25; // a line of the file
const AW = 560, AX = (W - AW) / 2, K = AW / 800, AH = 300 * K;
const FY = PAD + 30, AY = FY + 8 * LH + 54;
export const height = AY + AH + 76 + PAD - 10;

const colours = { 2: [0.2, 0.6, 1.0], 3: [0.0, 0.7, 0.0], 4: [0.8, 0.8, 0.4], 5: [1.0, 0.5, 0.0], 1: [0.8, 0.8, 0.7] };

export function draw() {
  const rows = readFileSync(new URL("../../projects/opengl/levels/solution/levels/one.lvl", import.meta.url), "utf8").trim().split("\n").map((r) => r.trim().split(/\s+/).map(Number));
  let s = `<defs>${Object.entries(colours).map(([n, c]) => tintFilter(`b${n}`, c)).join("")}</defs>`;
  s += code(W / 2, PAD + 8, "levels/one.lvl", { anchor: "middle", weight: 700 });
  rows.forEach((r, y) => {
    r.forEach((n, x) => {
      const cx = W / 2 + (x - 7) * 22;
      s += code(cx, FY + y * LH + 12, String(n), { anchor: "middle", color: n === 0 ? C.line : n === 1 ? C.muted : C.ink, weight: n > 1 ? 700 : 500 });
    });
  });
  s += arrow(W / 2, FY + 8 * LH + 6, W / 2, AY - 8, { color: C.line, width: 2.5 });
  const uw = (800 / 15) * K, uh = 37.5 * K;
  s += `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="${C.clear}" opacity="0.15"/>`;
  rows.forEach((r, y) => r.forEach((n, x) => {
    if (n === 0) return;
    const tex = n === 1 ? gameTexture("block_solid") : gameTexture("block");
    s += `<image href="${tex}" x="${AX + x * uw}" y="${AY + y * uh}" width="${uw}" height="${uh}" preserveAspectRatio="none" filter="url(#b${n})"/>`;
  }));
  s += `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="none" stroke="${C.boxStroke}"/>`;
  // one brick's size: under the first column, beside the first row
  const by = AY + AH + 18;
  s += arrow(AX, by, AX + uw, by, { color: C.accent, width: 2, both: true });
  s += code(AX + uw + 10, by, "53.3", { color: C.accent, weight: 600 });
  const bx = AX + AW + 14;
  s += arrow(bx, AY, bx, AY + uh, { color: C.accent, width: 2, both: true });
  s += code(bx + 8, AY + uh / 2, "37.5", { color: C.accent, weight: 600 });
  s += code(W / 2, by + 34, "800 / 15 ≈ 53.3  ·  300 / 8 = 37.5", { anchor: "middle", color: C.muted, weight: 600 });
  return svg(height, s);
}
