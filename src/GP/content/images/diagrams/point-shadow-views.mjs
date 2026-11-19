// Point Shadows, the end: the room drawn by the simulator from a camera near its front wall with a wide field of view
// (100°), so that the side walls, the floor and the ceiling show: the depth cube map seen from there (the task
// depth-cubemap), and the shadows of all five cubes with PCF (the solution). The chapter's camera sees only the back
// wall.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("point-shadow-views");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + PAD;
const wide = [
  { file: "main.cpp", find: "glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);", replace: "glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  4.6f);" },
  { file: "main.cpp", find: "float fov   =  45.0f;", replace: "float fov   =  100.0f;" },
];
const r = (from) => ({ api: "opengl", chapter: "point-shadows", from, edits: wide, width: Math.round(PW * 2) });
export const renders = { depth: r("task:depth-cubemap"), shadows: r("solution") };

export function draw(v, R) {
  let s = "";
  [["depth", t(v, "The depth cube map", "Djup-cube mapen")], ["shadows", t(v, "Shadows, with PCF", "Skuggor, med PCF")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, name, { size: L, color: C.ink });
  });
  return svg(height, s);
}
