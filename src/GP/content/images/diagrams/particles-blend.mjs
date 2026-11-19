// Particles: the trail at 2.0 s with the chapter's additive blending (the particle's colour times its alpha added to
// what is there) and, for comparison, with the ordinary alpha blending – drawn by the simulator from the course's OpenGL
// project and cut to the trail. Additive blending makes the overlapping fresh particles add up to a white core.
import { PAD, W, svg } from "./style.mjs";
import { crop, label } from "./_practice.mjs";

export const variants = [{ out: "particles-blend.webp", lang: "en" }];
const GAP = 18, PW = (W - 2 * PAD - GAP) / 2;
const SRC = [462, 312, 130, 130];
const K = PW / SRC[2], PH = SRC[3] * K;
export const height = PAD + PH + 44 + PAD - 6;
export const lossy = true;
const over = [{ file: "main.cpp", find: "    glBlendFunc(GL_SRC_ALPHA, GL_ONE);", replace: "    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);" }];
export const renders = {
  add: { api: "opengl", chapter: "particles", width: 2400, times: [2.0] },
  over: { api: "opengl", chapter: "particles", edits: over, width: 2400, times: [2.0] },
};

export function draw(v, R) {
  let s = "";
  [["add", "*src*·*α* + *dst*"], ["over", "*src*·*α* + *dst*·(1 − *α*)"]].forEach(([id, f], i) => {
    const x = PAD + i * (PW + GAP);
    s += crop(R[id][0], [800, 600], SRC, x, PAD, PW, PH);
    s += label(x + PW / 2, PAD + PH + 24, f, { anchor: "middle", fit: PW, weight: 500 });
  });
  return svg(height, s);
}
