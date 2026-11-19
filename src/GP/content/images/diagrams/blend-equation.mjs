// Blending, "Blending": the chapter's example – the semi-transparent green square (0, 1, 0) with alpha 0.6 drawn over
// the red square (1, 0, 0) – and the blend equation with the factors source alpha and one minus source alpha, which
// gives (0.4, 0.6, 0) where they overlap. Language-free (only colours and maths).
import { C, PAD, W, line, svg, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = [{ out: "blend-equation.webp", lang: "en" }];

const S = 150, OV = 70; // the squares' size and their overlap
const SX = (W - (2 * S - OV)) / 2, SY = PAD + 8;
export const height = SY + S + 150;

const rgb = (r, g, b) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
const card = [0xf7 / 255, 0xf8 / 255, 0xfa / 255];

export function draw() {
  let s = "";
  const gx = SX + S - OV, gy = SY + 36;
  // The red square (the destination, drawn first), the green one blended over the card and over the red.
  s += `<rect x="${SX}" y="${SY}" width="${S}" height="${S}" fill="${rgb(1, 0, 0)}"/>`;
  s += `<rect x="${gx}" y="${gy}" width="${S}" height="${S - 36}" fill="${rgb(0.4 * card[0], 0.6 + 0.4 * card[1], 0.4 * card[2])}"/>`;
  s += `<rect x="${gx}" y="${gy}" width="${OV}" height="${S - 36}" fill="${rgb(0.4, 0.6, 0)}"/>`;
  s += `<rect x="${gx}" y="${gy}" width="${S}" height="${S - 36}" fill="none" stroke="${C.ink}" stroke-width="1" stroke-dasharray="4 3"/>`;
  // Labels left and right of the squares.
  s += text(SX - 14, SY + 30, "(1, 0, 0)", { anchor: "end", size: LBL, weight: 600, mono: true });
  s += text(SX - 14, SY + 58, "C_destination", { anchor: "end", size: SML, color: C.muted, mono: true });
  s += text(gx + S + 14, gy + 30, "(0, 1, 0)", { size: LBL, weight: 600, mono: true });
  s += text(gx + S + 14, gy + 58, "C_source", { size: SML, color: C.muted, mono: true });
  s += text(gx + S + 14, gy + 86, "α = 0.6", { size: LBL, weight: 600 });
  // A pointer to the overlap.
  const ox = gx + OV / 2, oy = SY + S + 16;
  s += line(ox, SY + S - 12, ox, oy, { color: C.ink, width: 1.5 });
  s += text(ox, oy + 16, "(0.4, 0.6, 0)", { anchor: "middle", size: LBL, weight: 650, mono: true });
  // The equation.
  const ey = oy + 62;
  s += text(W / 2, ey, "C_result = C_source · α + C_destination · (1 − α)", { anchor: "middle", size: SML, weight: 600, mono: true, fit: W - 2 * PAD });
  s += text(W / 2, ey + 36, "= (0, 1, 0) · 0.6 + (1, 0, 0) · 0.4 = (0.4, 0.6, 0)", { anchor: "middle", size: SML, mono: true, fit: W - 2 * PAD });
  s += line(PAD, ey - 26, W - PAD, ey - 26, { color: C.grid, width: 1 });
  return svg(height, s);
}
