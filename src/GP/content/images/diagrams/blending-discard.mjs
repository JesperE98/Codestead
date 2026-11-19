// Blending, "Discarding fragments": the five grass quads drawn with the alpha ignored (the task grass) and with the
// fragments of alpha < 0.1 discarded (the task discard), by the simulator from the course's OpenGL project.
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { caption } from "./_advgl.mjs";

export const variants = perLanguage("blending-discard");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = (PW * 3) / 4;
export const height = PAD + PH + 70;

export const renders = {
  grass: { api: "opengl", chapter: "blending", from: "task:grass", width: Math.round(PW * 2) },
  discard: { api: "opengl", chapter: "blending", from: "task:discard", width: Math.round(PW * 2) },
};

export function draw(v, R) {
  let s = "";
  const cols = [
    ["grass", t(v, "Alpha ignored", "Alfa används inte"), t(v, "transparent texels are black", "genomskinliga texlar är svarta")],
    ["discard", t(v, "discard if alpha < 0.1", "discard om alfa < 0.1"), t(v, "only the blades are left", "bara grässtråna blir kvar")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[id][0].href, x, PAD, PW, PH);
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { fit: PW });
  });
  return svg(height, s);
}
