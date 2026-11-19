// The cross-section that the Parallax Mapping pictures share (not a picture itself): a brick, a mortar joint and the
// next brick, as the depth map describes them (depth 0 at the quad, 1 at the bottom of the joint), and a view ray.
import { C, line } from "./style.mjs";
import { poly } from "./_advlight.mjs";

export const variants = [];
export const height = 0;
export const draw = () => "";

/** The depth map along the section, u from 0 to 1. */
export function depth(u) {
  const k = [[0, 0], [0.3, 0], [0.42, 0.85], [0.58, 0.85], [0.7, 0], [1, 0]];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, d0] = k[i - 1], [u1, d1] = k[i]; return d0 + ((u - u0) / (u1 - u0)) * (d1 - d0); }
  return 0;
}

/** The section in a box: returns { X(u), Y(d), draw } – the solid below the depth map, and the quad's line. */
export function section(x, y, w, h) {
  const X = (u) => x + u * w, Y = (d) => y + d * h;
  const pts = [];
  for (let i = 0; i <= 200; i++) { const u = i / 200; pts.push([X(u), Y(depth(u))]); }
  const solid = poly([...pts, [X(1), Y(1) + 14], [X(0), Y(1) + 14]], { fill: C.accentSoft, color: "none" }) +
    pts.slice(1).map((p, i) => line(pts[i][0], pts[i][1], p[0], p[1], { color: C.accent, width: 2 })).join("");
  return { X, Y, solid, quad: line(X(0) - 6, Y(0), X(1) + 6, Y(0), { color: C.ink, width: 3 }) };
}
