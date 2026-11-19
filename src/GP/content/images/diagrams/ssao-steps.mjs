// SSAO, the end: the chapter's scene drawn by the simulator after each task – without ambient occlusion (the start),
// the raw SSAO texture with its 4 × 4 noise, the blurred one, and the lit scene with the occlusion applied to the
// ambient light. The two SSAO textures are magnified: the ring's underside and the floor below the planet.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("ssao-steps");
export const lossy = true;

const GAP = 12, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
const ZH = PW * 0.5625; // the magnified top row: under the planet
export const height = PAD + ZH + GAP + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "ssao", from, width: Math.round(PW * 2) });
export const renders = { start: r("start"), raw: r("task:kernel"), blur: r("task:blur"), apply: r("solution") };

export function draw(v, R) {
  let s = "";
  [["raw", "kernel"], ["blur", "blur"], ["start", t(v, "Start: no AO", "Start: ingen AO")], ["apply", "apply"]].forEach(([id, name], i) => {
    const x = PAD + (i % 2) * (PW + GAP), y = i < 2 ? PAD : PAD + ZH + GAP, img = R[id][0];
    if (i < 2) s += crop(img.href, img.width, img.height, img.width * 0.3, img.height * 0.38, img.width * 0.4, img.height * 0.3, x, y, PW, ZH);
    else s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, PW, PH);
    s += pill(x + 8, y + 20, name, { size: L, mono: id !== "start", color: id === "start" ? C.ink : C.accent });
  });
  return svg(height, s);
}
