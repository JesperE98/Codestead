// Collision detection: the box and the circle test at 1.75 s, drawn by the simulator from the course's OpenGL project
// (the tasks do-collisions and circle) and cut to the ball. The box's corner has reached the green brick of column 10
// and destroyed it; the round ball hasn't touched it yet – it goes a frame later.
import { C, PAD, W, perLanguage, svg, t } from "./style.mjs";
import { crop, label } from "./_practice.mjs";

export const variants = perLanguage("collision-shapes");
const GAP = 18, PW = (W - 2 * PAD - GAP) / 2;
const SRC = [440, 46, 180, 132]; // the part of the window
const K = PW / SRC[2], PH = SRC[3] * K;
export const height = PAD + PH + 44 + PAD - 6;
export const lossy = true;
export const renders = {
  aabb: { api: "opengl", chapter: "collision-detection", from: "task:do-collisions", width: 2400, times: [1.75] },
  circle: { api: "opengl", chapter: "collision-detection", from: "task:circle", width: 2400, times: [1.75] },
};

export function draw(v, R) {
  let s = "";
  const ball = [387.5 + (76 * 100) / 60, 555 - (76 * 350) / 60]; // frames 30 … 105
  [["aabb", t(v, "box (AABB): 4 bricks", "låda (AABB): 4 block")], ["circle", t(v, "circle: 3 bricks", "cirkel: 3 block")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP);
    const g = (gx, gy) => [x + (gx - SRC[0]) * K, PAD + (gy - SRC[1]) * K];
    s += crop(R[id][0], [800, 600], SRC, x, PAD, PW, PH);
    const [bx, by] = g(ball[0], ball[1]);
    if (id === "aabb") s += `<rect x="${bx}" y="${by}" width="${25 * K}" height="${25 * K}" fill="none" stroke="${C.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    else s += `<circle cx="${bx + 12.5 * K}" cy="${by + 12.5 * K}" r="${12.5 * K}" fill="none" stroke="${C.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    // the brick that makes the difference: column 10, row 2
    const [rx, ry] = g((800 / 15) * 10, 75);
    s += `<rect x="${rx}" y="${ry}" width="${(800 / 15) * K}" height="${37.5 * K}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 3"/>`;
    s += label(x + PW / 2, PAD + PH + 24, name, { anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
