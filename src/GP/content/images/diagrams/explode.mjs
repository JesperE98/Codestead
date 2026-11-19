// Geometry shader, "Exploding objects": the planet of the task explode at three moments of one swing – whole at 4.7 s,
// halfway at 6.3 s and furthest apart at 7.9 s (every triangle moves along its normal by (sin(time) + 1) / 2 times the
// magnitude: 0, 0.5 and 1 of it) – drawn by the simulator from the course's OpenGL project. Language-free.
import { PAD, W, svg, text } from "./style.mjs";
import { LBL, crop } from "./_advgl.mjs";

export const variants = [{ out: "explode.webp", lang: "en" }];
export const lossy = true;

const times = [4.71, 6.28, 7.86];
const GAP = 14, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW;
export const height = PAD + PH + 44;

export const renders = { planet: { api: "opengl", chapter: "geometry-shader", from: "task:explode", width: 1000, times } };

export function draw(v, R) {
  let s = "";
  times.forEach((time, i) => {
    const x = PAD + i * (PW + GAP);
    const r = R.planet[i];
    // The middle of the window, square.
    const side = r.height * 0.9;
    s += crop(r.href, r.width, r.height, (r.width - side) / 2, (r.height - side) / 2, side, side, x, PAD, PW, PH);
    s += text(x + PW / 2, PAD + PH + 22, `t = ${time.toFixed(1)} s`, { anchor: "middle", size: LBL, weight: 650, mono: true });
  });
  return svg(height, s);
}
