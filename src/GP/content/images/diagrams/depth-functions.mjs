// Depth testing, "Depth test function": the chapter's scene with the depth function LESS (the start) and ALWAYS (the
// task depth-always), drawn by the simulator from the course's OpenGL project. With ALWAYS the floor, drawn last,
// covers the cubes' lower halves, and each cube's later faces cover its front. Both show the left part of the window,
// around the left cube, magnified.
import { PAD, W, perLanguage, svg, t } from "./style.mjs";
import { caption, crop } from "./_advgl.mjs";

export const variants = perLanguage("depth-functions");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = (PW * 3) / 4;
export const height = PAD + PH + 70;

export const renders = {
  less: { api: "opengl", chapter: "depth-testing", from: "start", width: 1200 },
  always: { api: "opengl", chapter: "depth-testing", from: "task:depth-always", width: 1200 },
};

export function draw(v, R) {
  let s = "";
  const cols = [
    ["less", "LESS", t(v, "the nearest fragment wins", "närmaste fragmentet vinner")],
    ["always", "ALWAYS", t(v, "the last one drawn wins", "det sist ritade vinner")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    const r = R[id][0];
    // The window's left part, 4:3: x from 4.5 % to 59 %, y from 21 % to 76 %.
    s += crop(r.href, r.width, r.height, r.width * 0.045, r.height * 0.21, r.width * 0.545, r.width * 0.545 * 0.75, x, PAD, PW, PH);
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { mono: true, fit: PW });
  });
  return svg(height, s);
}
