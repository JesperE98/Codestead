// Anti Aliasing, the task msaa: a piece of the cube's edge, magnified so that every pixel shows, without multisampling
// (the start) and with 4 samples per pixel (the task msaa) – drawn by the simulator from the course's OpenGL project at
// the window's own size, 800 × 600.
import { PAD, W, perLanguage, svg, t } from "./style.mjs";
import { caption, crop } from "./_advgl.mjs";

export const variants = perLanguage("aa-compare");
export const lossy = true;
export const quality = 92;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 250;
export const height = PAD + PH + 70;

export const renders = {
  off: { api: "opengl", chapter: "anti-aliasing", from: "start", width: 800 },
  on: { api: "opengl", chapter: "anti-aliasing", from: "task:msaa", width: 800 },
};

const VIEW = { x: 512, y: 170, w: 40 }; // window pixels: the cube's upper right edge

export function draw(v, R) {
  let s = "";
  const cols = [
    ["off", t(v, "Without MSAA", "Utan MSAA"), t(v, "green or background", "grönt eller bakgrund")],
    ["on", t(v, "4× MSAA", "4× MSAA"), t(v, "mixes along the edge", "blandningar längs kanten")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    const r = R[id][0];
    s += crop(r.href, r.width, r.height, VIEW.x, VIEW.y, VIEW.w, VIEW.w * (PH / PW), x, PAD, PW, PH, { pixelated: true });
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { fit: PW });
  });
  return svg(height, s);
}
