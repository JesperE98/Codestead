// OIT: Introduction – the overlap of the green (near) and the blue (far) quad, drawn by the simulator from the course's
// OpenGL project: as the program draws them (green first, depth writes on: the blue quad is cut off), with depth writes
// off (blue blended over green: the wrong order) and sorted far to near (the right colour). The ring marks the pixel
// (230, 300); its colour is written below.
import { C, PAD, W, perLanguage, svg, t } from "./style.mjs";
import { code, crop, label } from "./_practice.mjs";

export const variants = perLanguage("oit-order");
const GAP = 14, PW = (W - 2 * PAD - 2 * GAP) / 3;
const SRC = [40, 40, 720, 560];
const K = PW / SRC[2], PH = SRC[3] * K;
export const height = PAD + PH + 76 + PAD - 8;
export const lossy = true;
export const renders = {
  drawn: { api: "opengl", chapter: "oit-introduction", width: 1600 },
  nowrite: { api: "opengl", chapter: "oit-introduction", from: "exercise:ex-depth-mask", width: 1600 },
  sorted: { api: "opengl", chapter: "oit-introduction", from: "exercise:ex-sorted", width: 1600 },
};

export function draw(v, R) {
  let s = "";
  const panels = [
    ["drawn", t(v, "as drawn", "som ritat"), "(0, 128, 0)", C.bad],
    ["nowrite", t(v, "depth writes off", "utan djupskrivning"), "(0, 64, 128)", C.bad],
    ["sorted", t(v, "sorted far to near", "sorterat bakifrån"), "(0, 128, 64)", C.good],
  ];
  panels.forEach(([id, name, rgb, color], i) => {
    const x = PAD + i * (PW + GAP);
    s += crop(R[id][0], [800, 600], SRC, x, PAD, PW, PH);
    s += `<circle cx="${x + (230 - SRC[0]) * K}" cy="${PAD + (300 - SRC[1]) * K}" r="7" fill="none" stroke="#ffffff" stroke-width="2.5"/>`;
    s += label(x + PW / 2, PAD + PH + 22, name, { anchor: "middle", fit: PW + GAP - 2 });
    s += code(x + PW / 2, PAD + PH + 50, rgb, { anchor: "middle", color, weight: 600 });
  });
  return svg(height, s);
}
