// Depth testing, "Visualizing the depth buffer": the depth buffer's value as a grey (task visualize-depth) and the
// linearized depth divided by far (the solution), drawn by the simulator from the course's OpenGL project. The first
// is almost white because the depth is non-linear, the second almost black because everything is close to the camera.
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { caption } from "./_advgl.mjs";

export const variants = perLanguage("depth-visualized");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = (PW * 3) / 4;
export const height = PAD + PH + 70;

export const renders = {
  raw: { api: "opengl", chapter: "depth-testing", from: "task:visualize-depth", width: Math.round(PW * 2) },
  linear: { api: "opengl", chapter: "depth-testing", width: Math.round(PW * 2) },
};

export function draw(v, R) {
  let s = "";
  const cols = [
    ["raw", t(v, "The depth buffer's value", "Värdet i djupbufferten"), t(v, "almost 1 everywhere", "nästan 1 överallt")],
    ["linear", t(v, "Linear depth ÷ far", "Linjärt djup ÷ far"), t(v, "a few units of 100", "några enheter av 100")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[id][0].href, x, PAD, PW, PH);
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { fit: PW });
  });
  return svg(height, s);
}
