// Normal Mapping, after the quiz on why a normal map looks blue: the chapter's brickwall_normal.png, a part of it
// magnified, and three of its texels decoded with normal = colour · 2 − 1: the flat face of a brick (0, 0, 1), the
// bevel at a brick's right edge (+x, red) and at a brick's top edge (+y, green: up the image).
import { C, PAD, W, asset, badge, image, line, perLanguage, svg, t, text } from "./style.mjs";
import { crop, frame, label } from "./_advlight.mjs";

export const variants = perLanguage("normal-map-colours");

const IS = 176; // the size of the map and of the magnified part
export const height = PAD + 30 + IS + PAD;

// The magnified part (texels 48..80 × 16..48 of the 256 × 256 map) and three texels in it.
const Z = { x: 48, y: 16, s: 32 };
const samples = [
  { at: [56, 24], rgb: [127, 127, 254], n: "( 0,    0,    1  )", nn: [0, 0, 1] },
  { at: [63, 20], rgb: [224, 127, 210], n: "( 0.76, 0,    0.65)", nn: [0.76, 0, 0.65] },
  { at: [56, 33], rgb: [127, 224, 210], n: "( 0,    0.76, 0.65)", nn: [0, 0.76, 0.65] },
];

export function draw(v) {
  const map = asset("opengl/normal-mapping/solution/brickwall_normal.png");
  let s = "";
  const y = PAD + 30;
  s += label(PAD, PAD + 8, t(v, "normal map", "normal map"), { color: C.muted });
  s += image(map, PAD, y, IS, IS, { pixelated: true });
  const k = IS / 256;
  s += frame(PAD + Z.x * k, y + Z.y * k, Z.s * k, Z.s * k, { color: C.ink, width: 2 });
  const zx = PAD + IS + 20;
  s += label(zx, PAD + 8, t(v, "magnified", "förstorat"), { color: C.muted });
  s += crop(map, 256, 256, Z.x, Z.y, Z.s, Z.s, zx, y, IS, IS, { pixelated: true });
  s += line(PAD + (Z.x + Z.s) * k, y + Z.y * k, zx, y, { color: C.line, width: 1, dash: "3 3" });
  s += line(PAD + (Z.x + Z.s) * k, y + (Z.y + Z.s) * k, zx, y + IS, { color: C.line, width: 1, dash: "3 3" });
  const zk = IS / Z.s;
  const rx = zx + IS + 22;
  s += label(rx, PAD + 8, t(v, "colour → normal", "färg → normal"), { color: C.muted });
  samples.forEach((p, i) => {
    const px = zx + (p.at[0] - Z.x + 0.5) * zk, py = y + (p.at[1] - Z.y + 0.5) * zk;
    s += `<circle cx="${px}" cy="${py}" r="12" fill="none" stroke="#fff" stroke-width="3"/>` + badge(px, py, i + 1, { r: 10 });
    const ey = y + 2 + i * 62;
    s += badge(rx + 10, ey + 12, i + 1, { r: 10 });
    s += `<rect x="${rx + 28}" y="${ey}" width="24" height="24" rx="4" fill="rgb(${p.rgb.join(",")})" stroke="${C.boxStroke}"/>`;
    s += text(rx + 58, ey + 12, `(${p.rgb.map((c) => (c / 255).toFixed(2)).join(", ")})`, { size: 19, mono: true, weight: 500 });
    s += text(rx + 28, ey + 42, `→ (${p.nn.map((c) => (c === 0 ? "0" : c.toFixed(2))).join(", ")})`, { size: 19, mono: true, weight: 600, color: C.accent });
  });
  return svg(height, s);
}
