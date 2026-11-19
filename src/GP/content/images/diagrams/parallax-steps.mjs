// Parallax Mapping, the end: the same bricks, magnified, drawn by the simulator after the tasks parallax (the sides
// smeared), steep (sharp sides made of steps, one per layer) and occlusion (smooth sides).
import { C, PAD, W, perLanguage, pill, svg } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = [{ out: "parallax-steps.webp", lang: "en" }];
export const lossy = true;

// A part of the lower middle of the window, where the bricks' front sides face the camera.
const SX = 0.36, SY = 0.66, SW = 0.28, SH = 0.2;
const GAP = 10, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = (PW * SH * 0.75) / SW;
export const height = PAD + PH + PAD;
const r = (from) => ({ api: "opengl", chapter: "parallax-mapping", from, width: 1600 });
export const renders = { parallax: r("task:parallax"), steep: r("task:steep"), occlusion: r("solution") };

export function draw(v, R) {
  let s = "";
  ["parallax", "steep", "occlusion"].forEach((id, i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, img.width * SX, img.height * SY, img.width * SW, img.height * SH, x, PAD, PW, PH);
    s += pill(x + 6, PAD + 20, id, { size: L, mono: true, color: C.accent });
  });
  return svg(height, s);
}
