// Normal Mapping, after the task tbn: the brick wall drawn by the simulator at the start (one normal), after the task
// normal-map (the map's normals used as world-space normals: lit wrongly) and after tbn (tangent space: right).
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { crop } from "./_advlight.mjs";

export const variants = perLanguage("normal-steps");
export const lossy = true;

const GAP = 10, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW * 1.0;
export const height = PAD + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "normal-mapping", from, width: 900 });
export const renders = { start: r("start"), map: r("task:normal-map"), tbn: r("task:tbn") };

export function draw(v, R) {
  let s = "";
  [["start", t(v, "Start", "Start"), C.ink], ["map", "normal-map", C.bad], ["tbn", "tbn", C.good]].forEach(([id, name, color], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    // A square from the middle of the window.
    const sw = img.height * 0.8;
    s += crop(img.href, img.width, img.height, (img.width - sw) / 2, img.height * 0.1, sw, sw, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, name, { size: 19, mono: i > 0, color });
  });
  return svg(height, s);
}
