// Framebuffers, "Kernel effects": how the sharpen kernel computes one pixel – the nine samples around it (here a
// darker pixel, 0.5, in a lighter area, 0.8, like a vein of the marble) are multiplied by the kernel's weights and
// added up: 9 · 0.5 − 8 · 0.8 = −1.9, which the colour buffer stores as 0 – the dark vein turns black. Language-free.
import { C, PAD, W, line, svg, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = [{ out: "framebuffer-kernel.webp", lang: "en" }];

const CELL = 64, G = 3 * CELL;
const Y = PAD + 30;
export const height = Y + G + 86;

const grey = (g) => `rgb(${Math.round(g * 255)},${Math.round(g * 255)},${Math.round(g * 255)})`;

function grid(x, values, fill, ink) {
  let s = "";
  values.forEach((val, i) => {
    const cx = x + (i % 3) * CELL, cy = Y + Math.floor(i / 3) * CELL;
    s += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="${fill(val, i)}" stroke="${C.boxStroke}" stroke-width="1"/>`;
    s += text(cx + CELL / 2, cy + CELL / 2, val.label, { anchor: "middle", mono: true, size: LBL, weight: 600, color: ink(val, i) });
  });
  return s + `<rect x="${x}" y="${Y}" width="${G}" height="${G}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
}

export function draw() {
  let s = "";
  const samples = Array.from({ length: 9 }, (_, i) => (i === 4 ? { g: 0.5, label: "0.5" } : { g: 0.8, label: "0.8" }));
  const kernel = Array.from({ length: 9 }, (_, i) => ({ label: i === 4 ? "9" : "−1" }));
  const x1 = PAD + 6, x2 = x1 + G + 72, x3 = x2 + G + 72;
  s += text(x1 + G / 2, PAD + 12, "texture", { anchor: "middle", mono: true, size: SML, color: C.muted });
  s += text(x2 + G / 2, PAD + 12, "kernel", { anchor: "middle", mono: true, size: SML, color: C.muted });
  s += grid(x1, samples, (v) => grey(v.g), (v) => (v.g < 0.6 ? "#ffffff" : C.ink));
  s += `<rect x="${x1 + CELL}" y="${Y + CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  s += grid(x2, kernel, (_, i) => (i === 4 ? C.accentSoft : "#ffffff"), () => C.ink);
  s += text(x1 + G + 36, Y + G / 2, "×", { anchor: "middle", size: 30, weight: 500 });
  s += text(x2 + G + 36, Y + G / 2, "=", { anchor: "middle", size: 30, weight: 500 });
  // The result: one pixel.
  const rx = x3 + 6, ry = Y + CELL;
  s += `<rect x="${rx}" y="${ry}" width="${CELL}" height="${CELL}" fill="#000000" stroke="${C.accent}" stroke-width="3"/>`;
  s += text(rx + CELL / 2, ry + CELL / 2, "0", { anchor: "middle", mono: true, size: LBL, weight: 600, color: "#ffffff" });
  s += line(PAD, Y + G + 26, W - PAD, Y + G + 26, { color: C.grid, width: 1 });
  s += text(W / 2, Y + G + 56, "9 · 0.5 − 8 · 0.8 = −1.9  →  0", { anchor: "middle", mono: true, size: LBL, fit: W - 2 * PAD });
  return svg(height, s);
}
