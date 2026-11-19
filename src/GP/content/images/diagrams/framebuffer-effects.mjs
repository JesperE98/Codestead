// Framebuffers, "Post-processing" and "Kernel effects": the chapter's scene after the tasks inversion, grayscale,
// sharpen and blur, drawn by the simulator from the course's OpenGL project – four screen shaders reading the same
// texture. (Edge detection, the last task, is the chapter's result picture.)
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { caption } from "./_advgl.mjs";

export const variants = perLanguage("framebuffer-effects");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = (PW * 3) / 4, CH = 44;
export const height = PAD + 2 * (PH + CH) + 6;

const tasks = ["inversion", "grayscale", "sharpen", "blur"];
export const renders = Object.fromEntries(
  tasks.map((id) => [id, { api: "opengl", chapter: "framebuffers", from: `task:${id}`, width: Math.round(PW * 2) }]),
);

export function draw(v, R) {
  const names = t(v, ["Inversion", "Grayscale", "Sharpen", "Blur"], ["Invertering", "Gråskala", "Skärpa", "Oskärpa"]);
  let s = "";
  tasks.forEach((id, i) => {
    const x = PAD + (i % 2) * (PW + GAP), y = PAD + Math.floor(i / 2) * (PH + CH);
    s += image(R[id][0].href, x, y, PW, PH);
    s += caption(x + PW / 2, y + PH + 20, names[i], null, { fit: PW });
  });
  return svg(height, s);
}
