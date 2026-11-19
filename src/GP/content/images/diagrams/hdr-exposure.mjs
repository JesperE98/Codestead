// HDR, "Exposure": the tunnel drawn by the simulator with the exposures 0.1, 1.0 (the chapter's) and 5.0 – a low
// exposure shows the bright end, a high one the dark walls.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("hdr-exposure");
export const lossy = true;

const GAP = 12, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW * 0.75;
export const height = PAD + PH + PAD;
const r = (e) => ({ api: "opengl", chapter: "hdr", edits: [{ file: "main.cpp", find: "float exposure = 1.0f;", replace: `float exposure = ${e}f;` }], width: Math.round(PW * 2) });
export const renders = { e01: r("0.1"), e1: r("1.0"), e5: r("5.0") };

export function draw(v, R) {
  let s = "";
  [["e01", "0.1"], ["e1", "1.0"], ["e5", "5.0"]].forEach(([id, e], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, t(v, `exposure ${e}`, `exponering ${e}`), { size: L, color: i === 1 ? C.accent : C.ink });
  });
  return svg(height, s);
}
