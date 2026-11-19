// Textures, "Mipmaps": the crate's mip chain at its real relative sizes – each level half as wide and high as the one
// before – with the levels' sizes. Language-free.
import { C, PAD, asset, svg, text } from "./style.mjs";

export const variants = [{ out: "mipmaps.webp", lang: "en" }];
const BIG = 212;
export const height = PAD + 6 + BIG + 40;
export const lossy = true;

const crate = asset("opengl/textures/solution/container.png");

export function draw() {
  let s = "";
  const top = PAD + 6;
  let x = PAD + 6, size = BIG;
  for (let level = 0; level <= 8; level++) {
    const shown = Math.max(size, 1.5);
    s += `<image href="${crate}" x="${x}" y="${top + BIG - shown}" width="${shown}" height="${shown}" preserveAspectRatio="none"/>`;
    s += `<rect x="${x}" y="${top + BIG - shown}" width="${shown}" height="${shown}" fill="none" stroke="${C.boxStroke}" stroke-width="1"/>`;
    const px = 256 >> level;
    const cx = x + shown / 2;
    if (level <= 5) {
      s += text(cx, top + BIG + 20, `${px} × ${px}`, { anchor: "middle", size: level <= 2 ? 13 : 12, weight: 600 });
    }
    x += shown + (level < 3 ? 26 : level < 5 ? 34 : 14);
    size /= 2;
  }
  s += text(x - 4, top + BIG + 20, "… 1 × 1", { anchor: "start", size: 12, weight: 600 });
  return svg(height, s);
}
