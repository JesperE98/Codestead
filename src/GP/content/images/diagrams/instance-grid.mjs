// Instancing, "Instancing": the 100 quads of the task offsets, drawn by the simulator from the course's OpenGL project
// with one instanced draw, with the instance numbers of the corners and of a few others – instance 0 bottom left, 9
// bottom right, 99 top right: the offsets array is filled row by row from the bottom. Language-free.
import { PAD, W, image, pill, svg } from "./style.mjs";
import { SML } from "./_advgl.mjs";

export const variants = [{ out: "instance-grid.webp", lang: "en" }];
export const lossy = true;

const PW = 560, PH = 420, X = (W - PW) / 2, Y = PAD;
export const height = Y + PH + PAD;

export const renders = { grid: { api: "opengl", chapter: "instancing", from: "task:offsets", width: PW * 2 } };

export function draw(v, R) {
  let s = image(R.grid[0].href, X, Y, PW, PH);
  // The quads' centres are at -0.9, -0.7 … 0.9 in NDC; instance i has column i % 10 and row i / 10 from the bottom.
  const at = (i) => [X + ((-0.9 + 0.2 * (i % 10) + 1) / 2) * PW, Y + (1 - (-0.9 + 0.2 * Math.floor(i / 10) + 1) / 2) * PH];
  for (const i of [0, 1, 9, 10, 45, 90, 99]) {
    const [x, y] = at(i);
    s += pill(x, y, String(i), { size: SML, mono: true, anchor: "middle", w: i < 10 ? 30 : 40 });
  }
  return svg(height, s);
}
