// Skeletal Animation, linear blend skinning in 2D with the tentacle's bones (Base, Lower at 0.55, Upper at 1.1, Tip at
// 1.65): a vertex v between Lower and Upper with the weights 0.5 and 0.5. In the pose, Lower turns 30° about its joint
// and Upper another 30° about its own. Each bone's final matrix (global · offset) moves v to where that bone alone
// would take it; the weighted sum is where the vertex goes.
import { C, PAD, W, dot, line, perLanguage, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("skinning");
const U = 118; // pixels per unit
export const height = PAD + 40 + 2.35 * U + 96 + PAD;

const rot = ([cx, cy], deg) => ([x, y]) => {
  const a = (deg * Math.PI) / 180, dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

export function draw(v) {
  const joints = [[0, 0], [0, 0.55], [0, 1.1], [0, 1.65], [0, 2.2]];
  const names = ["Base", "Lower", "Upper", "Tip"];
  const vtx = [0.2, 0.62];
  const fLower = rot(joints[1], 40), fUpper = (p) => fLower(rot(joints[2], 40)(p));
  const posed = [joints[0], joints[1], fLower(joints[2]), fUpper(joints[3]), fUpper(joints[4])];
  const vL = fLower(vtx), vU = fUpper(vtx), vB = [(vL[0] + vU[0]) / 2, (vL[1] + vU[1]) / 2];
  let s = "";
  const panel = (ox, title, js, colourOf, right) => {
    const g = ([x, y]) => [ox + x * U, PAD + 40 + 2.25 * U - y * U];
    let r = label(ox, PAD + 14, title, { anchor: "middle" });
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = g(js[i]), [x2, y2] = g(js[i + 1]);
      r += line(x1, y1, x2, y2, { color: colourOf(i), width: 9, opacity: 0.85 });
      r += dot(x1, y1, { r: 6, color: C.ink });
      if (!right) r += code(x1 - 14, y1 - 6, names[i], { anchor: "end", color: colourOf(i), weight: 600 });
    }
    return { r, g };
  };
  const colour = (i) => (i === 1 ? C.accent : i === 2 ? C.accent2 : C.line);
  const a = panel(PAD + 150, t(v, "bind pose", "bindposen"), joints, colour);
  s += a.r;
  const [vx, vy] = a.g(vtx);
  s += dot(vx, vy, { r: 7, color: C.y }) + label(vx + 12, vy, "*v*", { color: C.y });
  const b = panel(W - PAD - 150, t(v, "animated", "animerad"), posed, colour, true);
  s += b.r;
  const [lx, ly] = b.g(vL), [ux, uy] = b.g(vU), [bx, by] = b.g(vB);
  s += line(lx, ly, ux, uy, { color: C.y, width: 1.5, dash: "4 3" });
  s += dot(lx, ly, { r: 6, color: C.accent }) + label(lx + 14, ly + 6, "*v*_{Lower}", { color: C.accent });
  s += dot(ux, uy, { r: 6, color: C.accent2 }) + label(ux + 14, uy - 4, "*v*_{Upper}", { color: C.accent2 });
  s += dot(bx, by, { r: 7, color: C.y }) + label(bx + 14, by, "*v*′", { color: C.y });
  s += label(W / 2, height - PAD - 48, "*v*′ = 0.5 · *F*_{Lower} *v* + 0.5 · *F*_{Upper} *v*".replaceAll("0.5", t(v, "0.5", "0,5")), { anchor: "middle", weight: 500 });
  s += label(W / 2, height - PAD - 14, "*F* = *global* · *offset*", { anchor: "middle", weight: 500, color: C.muted });
  return svg(height, s);
}
