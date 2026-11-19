// Bloom, the start of the chapter: the three steps with the buffers the simulator draws after each task of the
// chapter's OpenGL project – (1) the scene renders into the HDR colour buffer and, at the same time, its bright parts
// into a second one; (2) the bright buffer is blurred; (3) the blur is added to the scene, tone-mapped.
import { C, PAD, W, arrow, badge, perLanguage, pill, svg, t } from "./style.mjs";
import { crop, label } from "./_advlight.mjs";

export const variants = perLanguage("bloom-steps");
export const lossy = true;

const GAPX = 40, GAPY = 46, PW = (W - 2 * PAD - GAPX) / 2, PH = PW * 0.75;
export const height = PAD + 30 + PH + GAPY + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "bloom", from, width: Math.round(PW * 2) });
export const renders = { scene: r("start"), bright: r("task:bright-pass"), blur: r("task:blur"), final: r("solution") };

export function draw(v, R) {
  let s = "";
  const at = (i) => [PAD + (i % 2) * (PW + GAPX), PAD + 30 + Math.floor(i / 2) * (PH + GAPY)];
  const cells = [
    ["scene", t(v, "the scene (buffer 0)", "scenen (buffert 0)")],
    ["bright", t(v, "its bright parts (buffer 1)", "dess ljusa delar (buffert 1)")],
    ["final", t(v, "scene + blur, tone-mapped", "scen + blur, tone mappad")],
    ["blur", t(v, "the bright parts blurred", "de ljusa delarna blurrade")],
  ];
  cells.forEach(([id, name], i) => {
    const [x, y] = at(i), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, PW, PH);
    s += pill(x + 8, y + PH - 18, name, { size: 19, color: C.ink });
  });
  // Step 1 over the top row; 2: bright → blur (down the right); 3: blur and scene → final.
  const [x0, y0] = at(0), [x1] = at(1), [, y3] = at(3);
  s += badge(x0 + 12, PAD + 12, 1, { r: 11 }) + label(x0 + 30, PAD + 12, t(v, "one pass, two colour buffers", "ett pass, två färgbuffertar"), { fit: W - 2 * PAD - 40 });
  s += arrow(x1 + PW / 2, y0 + PH + 4, x1 + PW / 2, y3 - 4, { color: C.accent, width: 2.5 });
  s += badge(x1 + PW / 2 + 22, y0 + PH + GAPY / 2, 2, { r: 11 });
  s += label(x1 + PW / 2 + 40, y0 + PH + GAPY / 2, t(v, "blur", "blur"), { color: C.accent });
  s += arrow(x1 - 4, y3 + PH / 2, x0 + PW + 4, y3 + PH / 2, { color: C.accent, width: 2.5 });
  s += arrow(x0 + PW / 2, y0 + PH + 4, x0 + PW / 2, y3 - 4, { color: C.accent, width: 2.5 });
  s += badge(x0 + PW / 2 + 22, y0 + PH + GAPY / 2, 3, { r: 11 });
  s += label(x0 + PW / 2 + 40, y0 + PH + GAPY / 2, "+", { color: C.accent, size: 24 });
  return svg(height, s);
}
