// HDR, "Tone mapping": the tunnel's far end drawn by the simulator before and after Reinhard tone mapping – the
// floating point colour buffer clamped in the 8-bit window (flat white), and Reinhard's x / (x + 1), which keeps the
// boards. The middle of the window, where the tunnel ends, magnified.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("hdr-tonemap");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "hdr", from, width: 1200 });
export const renders = { clamped: r("task:float-buffer"), reinhard: r("task:reinhard") };

export function draw(v, R) {
  let s = "";
  [["clamped", t(v, "Without tone mapping", "Utan tone mapping")], ["reinhard", "Reinhard"]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    // The middle half of the window.
    s += crop(img.href, img.width, img.height, img.width * 0.25, img.height * 0.25, img.width * 0.5, img.height * 0.5, x, PAD, PW, PH);
    s += pill(x + 10, PAD + 22, name, { size: L, color: i === 1 ? C.accent : C.ink });
  });
  return svg(height, s);
}
