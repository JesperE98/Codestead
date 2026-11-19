// Postprocessing, "Trying the effects": the game at 1.45 s with the try-out lines of the tasks confuse and chaos, drawn
// by the simulator from the course's OpenGL project. The same in every API.
import { PAD, W, image, svg } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = [{ out: "postprocessing-effects.webp", lang: "en" }];
const GAP = 16;
const PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + 40 + PAD - 6;
export const lossy = true;
export const quality = 75;

export const renders = {
  confuse: { api: "opengl", chapter: "postprocessing", from: "task:confuse", width: PW * 2, times: [1.45] },
  chaos: { api: "opengl", chapter: "postprocessing", from: "task:chaos", width: PW * 2, times: [1.45] },
};

export function draw(v, R) {
  let s = "";
  [["confuse", "Effects.Confuse"], ["chaos", "Effects.Chaos"]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[id][0].href, x, PAD, PW, PH);
    s += label(x + PW / 2, PAD + PH + 24, `\`${name}\``, { anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
