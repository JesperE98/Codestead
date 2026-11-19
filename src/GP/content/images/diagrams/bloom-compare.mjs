// Physically Based Bloom: the same scene without bloom (the chapter's start), with the Bloom chapter's threshold and
// Gaussian blur, and with the physically based bloom of this chapter – drawn by the simulator from the course's OpenGL
// projects and showing the whole window.
import { PAD, W, perLanguage, svg, t } from "./style.mjs";
import { crop, label } from "./_practice.mjs";

export const variants = perLanguage("bloom-compare");
const GAP = 12, PW = (W - 2 * PAD - 2 * GAP) / 3;
const SRC = [0, 0, 800, 600];
const K = PW / SRC[2], PH = SRC[3] * K;
export const height = PAD + PH + 44 + PAD - 6;
export const lossy = true;
export const renders = {
  none: { api: "opengl", chapter: "physically-based-bloom", from: "start", width: 1200 },
  gauss: { api: "opengl", chapter: "bloom", width: 1200 },
  pbb: { api: "opengl", chapter: "physically-based-bloom", width: 1200 },
};

export function draw(v, R) {
  let s = "";
  [["none", t(v, "no bloom", "utan bloom")], ["gauss", t(v, "threshold + Gaussian", "tröskel + Gauss")], ["pbb", t(v, "physically based", "fysikaliskt baserad")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP);
    s += crop(R[id][0], [800, 600], SRC, x, PAD, PW, PH);
    s += label(x + PW / 2, PAD + PH + 24, name, { anchor: "middle", fit: PW + GAP - 2 });
  });
  return svg(height, s);
}
