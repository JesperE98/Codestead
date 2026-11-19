// Skeletal Animation: the tentacle's sway at four moments of its 2-second cycle – 0, 500, 1000 and 1500 ticks – drawn by
// the simulator from the course's OpenGL project. The keys are at these times; the cycle ends where it began.
import { PAD, W, image, svg } from "./style.mjs";
import { code } from "./_practice.mjs";

export const variants = [{ out: "tentacle-sway.webp", lang: "en" }];
const GAP = 10, PW = (W - 2 * PAD - 3 * GAP) / 4, SRC_W = 0.5; // the middle half of the window
const PH = (PW / SRC_W) * 0.75;
export const height = PAD + PH + 40 + PAD - 8;
export const lossy = true;
const times = [0.0001, 0.5, 1.0, 1.5];
export const renders = { sway: { api: "opengl", chapter: "skeletal-animation", width: Math.round((PW / SRC_W) * 2), times } };

export function draw(v, R) {
  let s = "";
  times.forEach((tm, i) => {
    const x = PAD + i * (PW + GAP), r = R.sway[i];
    const id = `sw${i}`;
    s += `<clipPath id="${id}"><rect x="${x}" y="${PAD}" width="${PW}" height="${PH}" rx="6"/></clipPath>`;
    s += `<g clip-path="url(#${id})">${image(r.href, x - PW / 2, PAD, PW / SRC_W, PH, { border: false, r: 0 })}</g>`;
    s += `<rect x="${x}" y="${PAD}" width="${PW}" height="${PH}" rx="6" fill="none" stroke="#c3cad5"/>`;
    s += code(x + PW / 2, PAD + PH + 22, `${Math.round(tm * 1000)} ticks`, { anchor: "middle", weight: 600 });
  });
  return svg(height, s);
}
