// Camera, "Camera/View space" (steps 1–4): the camera's own axes, computed the chapter's way for a camera that is up
// and to the right of the target – direction = normalize(position − target) (pointing away from what the camera looks
// at), right = normalize(up × direction), up = direction × right. Seen from a little above and to the right (not the
// usual oblique view, in which the camera's axes would lie on top of each other).
import { BOLD, C, PAD, W, arrow, dot, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("camera-axes");
export const height = 300;

const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return a.map((x) => x / l);
};
const add = (a, b, k = 1) => a.map((x, i) => x + k * b[i]);

export function draw(v) {
  let s = "";
  // An orthographic view, turned 12° about y and looking 20° down; +z still comes towards the viewer, down and left.
  const az = (12 * Math.PI) / 180, el = (20 * Math.PI) / 180, unit = 54, ox = 330, oy = 205;
  const P = (x, y, z) => {
    const X = x * Math.cos(az) - z * Math.sin(az), Z = x * Math.sin(az) + z * Math.cos(az);
    return [ox + unit * X, oy - unit * (y * Math.cos(el) - Z * Math.sin(el))];
  };
  const target = [0, 0, 0], pos = [-2.5, 1.5, 3.0];
  const D = norm(sub(pos, target));
  const R = norm(cross([0, 1, 0], D));
  const U = cross(D, R);
  // The world's axes at the target, light.
  const axis = (to, color, label) => {
    const [x1, y1] = P(0, 0, 0), [x2, y2] = P(...to);
    return arrow(x1, y1, x2, y2, { color, width: 1.5, opacity: 0.45 }) + text(x2 + (to[2] ? -8 : 8), y2 + (to[1] ? -6 : 4), label, { size: 13, italic: true, color, opacity: 0.7, anchor: to[2] ? "end" : "start" });
  };
  s += axis([1.6, 0, 0], C.x, "x") + axis([0, 1.6, 0], C.y, "y") + axis([0, 0, 1.6], C.z, "z");
  // The target: a small cube.
  const c = 0.35;
  const corners = [[-c, -c, c], [c, -c, c], [c, c, c], [-c, c, c], [-c, -c, -c], [c, -c, -c], [c, c, -c], [-c, c, -c]].map((p) => P(...p));
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]])
    s += line(...corners[a], ...corners[b], { color: C.line, width: 1 });
  const [tx, ty] = P(...target);
  s += dot(tx, ty, { r: 4.5, color: C.ink });
  s += text(tx, ty + 38, t(v, "target", "mål"), { size: 13, weight: 600, anchor: "middle" });
  // The line of sight, from the camera to the target (the camera looks down its own −z).
  const [px, py] = P(...pos);
  s += line(px, py, tx, ty, { color: C.muted, dash: "5 4" });
  // The camera's axes.
  const L = 1.4;
  const tip = (dir) => P(...add(pos, dir, L));
  const [dx, dy] = tip(D), [rx, ry] = tip(R), [ux, uy] = tip(U);
  s += arrow(px, py, dx, dy, { color: C.z, width: BOLD });
  s += arrow(px, py, rx, ry, { color: C.x, width: BOLD });
  s += arrow(px, py, ux, uy, { color: C.y, width: BOLD });
  s += dot(px, py, { r: 5, color: C.ink });
  s += text(px - 10, py + 16, t(v, "camera position", "kamerans position"), { size: 13, weight: 600, anchor: "end" });
  s += text(dx - 8, dy - 12, t(v, "direction", "riktning"), { size: 13, weight: 650, color: C.z, anchor: "middle" });
  s += text(rx + 8, ry + 8, t(v, "right", "höger"), { size: 13, weight: 650, color: C.x });
  s += text(ux + 8, uy - 4, t(v, "up", "upp"), { size: 13, weight: 650, color: C.y });

  // The recipe, on the right.
  const x0 = 470;
  const rows = [
    [C.z, t(v, "direction", "riktning"), t(v, "normalize(*position* − *target*)", "normalisera(*position* − *mål*)")],
    [C.x, t(v, "right", "höger"), t(v, "normalize((0, 1, 0) × *direction*)", "normalisera((0, 1, 0) × *riktning*)")],
    [C.y, t(v, "up", "upp"), t(v, "*direction* × *right*", "*riktning* × *höger*")],
  ];
  rows.forEach(([color, name, formula], i) => {
    const y = PAD + 70 + i * 62;
    s += `<rect x="${x0}" y="${y - 22}" width="${W - PAD - x0}" height="48" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += `<rect x="${x0}" y="${y - 22}" width="5" height="48" rx="2" fill="${color}"/>`;
    s += text(x0 + 16, y - 7, name, { size: 13, weight: 650, color });
    s += text(x0 + 16, y + 12, formula, { size: 13, fit: W - PAD - x0 - 24 });
  });
  s += text(x0, PAD + 20, t(v, "The camera's axes", "Kamerans axlar"), { size: 15, weight: 650 });
  return svg(height, s);
}
