// Shadow Mapping, the end of "Improving shadow maps": the floor around the cube's shadow drawn by the simulator after
// the tasks of the chapter's OpenGL project – shadows (shadow acne: the striped floor), bias (the stripes gone, the
// shadow's edge jagged) and pcf (soft edges) – each the same part of the window, magnified.
import { C, PAD, W, pill, svg } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = [{ out: "shadow-steps.webp", lang: "en" }];
export const lossy = true;

// The part shown: a square of the floor at the left end of the shadow.
const SX = 0.53, SY = 0.66, SW = 0.2, SH = 0.2 * (4 / 3);
const GAP = 10, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW;
export const height = PAD + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "shadow-mapping", from, width: 1400 });
export const renders = { shadows: r("task:shadows"), bias: r("task:bias"), pcf: r("solution") };

export function draw(v, R) {
  let s = "";
  ["shadows", "bias", "pcf"].forEach((id, i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, img.width * SX, img.height * SY, img.width * SW, img.height * SH, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, id, { size: L, mono: true, color: C.accent });
  });
  return svg(height, s);
}
