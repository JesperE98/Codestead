// Rendering Sprites, the game's coordinates: the orthographic projection makes the game's units the window's pixels,
// (0, 0) at the top left and (800, 600) at the bottom right, y pointing down. The paddle of the next chapter, 100 × 20
// at (350, 580), is drawn where those numbers say. Language-free.
import { C, PAD, W, arrow, dot, image, svg } from "./style.mjs";
import { code, gameTexture } from "./_practice.mjs";

export const variants = [{ out: "game-coords.webp", lang: "en" }];
const IW = 520, K = IW / 800, IH = 600 * K;
const X0 = (W - IW) / 2, Y0 = PAD + 44;
export const height = Y0 + IH + 54 + PAD - 14;

export function draw() {
  let s = image(gameTexture("background"), X0, Y0, IW, IH);
  const g = (x, y) => [X0 + x * K, Y0 + y * K];
  const [px, py] = g(350, 580);
  s += `<image href="${gameTexture("paddle")}" x="${px}" y="${py}" width="${100 * K}" height="${20 * K}" preserveAspectRatio="none"/>`;
  s += arrow(X0, Y0 - 16, X0 + 140, Y0 - 16, { color: C.x, width: 2.5 }) + code(X0 + 150, Y0 - 16, "x", { color: C.x, weight: 700 });
  s += arrow(X0 - 16, Y0, X0 - 16, Y0 + 140, { color: C.y, width: 2.5 }) + code(X0 - 16, Y0 + 156, "y", { color: C.y, weight: 700, anchor: "middle" });
  s += dot(X0, Y0, { r: 6, color: C.accent }) + code(X0 + 12, Y0 + 20, "(0, 0)", { weight: 600, color: "#ffffff" });
  s += dot(X0 + IW, Y0 + IH, { r: 6, color: C.accent }) + code(X0 + IW + 4, Y0 + IH + 24, "(800, 600)", { weight: 600, anchor: "end" });
  s += dot(px, py, { r: 5, color: C.accent }) + code(px - 10, py - 18, "(350, 580)", { weight: 600, color: "#ffffff", anchor: "end" });
  s += code(px + 100 * K / 2, Y0 + IH + 24, "100 × 20", { weight: 600, anchor: "middle", color: C.muted });
  return svg(height, s);
}
