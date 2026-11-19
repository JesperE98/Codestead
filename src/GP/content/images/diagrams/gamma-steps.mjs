// Gamma Correction, the end: the floor with its four lights after each task, drawn by the simulator from the chapter's
// OpenGL project – no correction, the shader's correction alone (washed out), the sRGB texture, and the quadratic
// attenuation. Only the lower part of the window (the floor) is shown.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("gamma-steps");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, RW = Math.round(PW * 2);
const CY = 0.47, CH = 0.53, PH = PW * 0.75 * CH;
export const height = PAD + 2 * PH + GAP + PAD;

const r = (from) => ({ api: "opengl", chapter: "gamma-correction", from, width: RW });
export const renders = { start: r("start"), shader: r("task:gamma-shader"), srgb: r("task:srgb-texture"), quadratic: r("solution") };

export function draw(v, R) {
  const list = [
    ["start", t(v, "Start: no correction", "Start: ingen korrigering")],
    ["shader", "gamma-shader"],
    ["srgb", "srgb-texture"],
    ["quadratic", "quadratic"],
  ];
  let s = "";
  list.forEach(([id, name], i) => {
    const x = PAD + (i % 2) * (PW + GAP), y = PAD + Math.floor(i / 2) * (PH + GAP);
    const img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, img.height * CY, img.width, img.height * CH, x, y, PW, PH);
    s += pill(x + 10, y + 22, name, { size: L, mono: i > 0, color: i === 0 ? C.ink : C.accent });
  });
  return svg(height, s);
}
