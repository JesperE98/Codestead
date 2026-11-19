// Tessellation: the wireframe with the same level 8 on every patch (task wireframe) and with the levels from the
// distance (task distance-levels, 8 at the front, about 2 at the back), drawn by the simulator from the course's
// OpenGL project and cut to the back of the terrain, where the difference is.
import { PAD, W, perLanguage, svg, t } from "./style.mjs";
import { crop, label } from "./_practice.mjs";

export const variants = perLanguage("tess-lod");
const GAP = 16, PW = (W - 2 * PAD - GAP) / 2;
const SRC = [170, 80, 320, 180];
const K = PW / SRC[2], PH = SRC[3] * K;
export const height = PAD + PH + 44 + PAD - 6;
export const lossy = true;
export const quality = 60;
export const renders = {
  fixed: { api: "opengl", chapter: "tessellation", from: "task:wireframe", width: 1600 },
  dist: { api: "opengl", chapter: "tessellation", width: 1600 },
};

export function draw(v, R) {
  let s = "";
  [["fixed", t(v, "level 8 everywhere", "nivå 8 överallt")], ["dist", t(v, "levels from the distance", "nivåer efter avståndet")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP);
    s += crop(R[id][0], [800, 600], SRC, x, PAD, PW, PH);
    s += label(x + PW / 2, PAD + PH + 24, name, { anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
