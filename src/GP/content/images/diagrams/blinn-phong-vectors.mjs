// Advanced Lighting, "Blinn-Phong": the vectors of Phong and of Blinn-Phong at the same point of a flat floor, with the
// light and the camera low above the floor on the same side (the floor beyond the chapter's light). Phong: the angle
// between V and R is more than 90°, so dot(V, R) < 0 and the specular term is cut off. Blinn-Phong: the angle between N
// and H stays below 90°. Language-free (symbols and code only).
import { BOLD, C, PAD, W, arrow, dot, line, svg, text } from "./style.mjs";
import { T, angle, dir, label, panel } from "./_advlight.mjs";

export const variants = [{ out: "blinn-phong-vectors.webp", lang: "en" }];

const GAP = 16;
const PW = (W - 2 * PAD - GAP) / 2;
const PH = 250;
export const height = PAD + PH + PAD;

const LEN = 140; // a vector's length
const A_L = 150, A_V = 168, A_R = 180 - A_L; // directions (degrees from +x, counter-clockwise)
const A_H = (A_L + A_V) / 2;

function lightIcon(x, y) {
  let s = "";
  for (let k = 0; k < 8; k++) {
    const [dx, dy] = dir(k * 45);
    s += line(x + dx * 13, y + dy * 13, x + dx * 19, y + dy * 19, { color: C.accent, width: 2 });
  }
  return s + `<circle cx="${x}" cy="${y}" r="9" fill="${C.accent}"/>`;
}

function eyeIcon(x, y) {
  return `<path d="M${x - 15},${y} Q${x},${y - 12} ${x + 15},${y} Q${x},${y + 12} ${x - 15},${y} Z" fill="#fff" stroke="${C.z}" stroke-width="2"/>` +
    `<circle cx="${x}" cy="${y}" r="5" fill="${C.z}"/>`;
}

function scene(x, blinn) {
  const y = PAD;
  let s = panel(x, y, PW, PH);
  s += text(x + 14, y + 22, blinn ? "Blinn-Phong" : "Phong", { size: T, weight: 650 });
  const px = x + PW * 0.58, py = y + PH - 56; // the point on the floor
  // The floor.
  s += `<rect x="${x + 1}" y="${py}" width="${PW - 2}" height="${y + PH - py - 1}" fill="${C.grid}"/>`;
  s += line(x + 1, py, x + PW - 1, py, { color: C.line, width: 2 });
  const at = (a, len = LEN) => { const [dx, dy] = dir(a); return [px + dx * len, py + dy * len]; };
  const [lx, ly] = at(A_L, LEN + 30), [vx, vy] = at(A_V, LEN + 30);
  s += lightIcon(lx, ly) + eyeIcon(vx, vy);
  // N, L, V and R or H.
  const vec = (a, color, name, len, [lx, ly]) =>
    arrow(px, py, ...at(a, len), { color, width: BOLD }) + label(px + lx, py + ly, `*${name}*`, { size: 21, color, anchor: "middle", weight: 700 });
  s += vec(90, C.ink, "N", 110, [-15, -98]);
  s += vec(A_L, C.accent, "L", LEN, [-72, -58]);
  s += vec(A_V, C.z, "V", LEN, [-118, -10]);
  if (!blinn) {
    s += vec(A_R, C.accent2, "R", LEN, [112, -40]);
    s += angle(px, py, 40, dir(A_R), dir(A_V), { color: C.bad, width: 2.5 });
    s += label(px + 38, py - 82, "> 90°", { color: C.bad });
    s += text(x + PW / 2, y + PH - 24, "dot(V, R) < 0", { size: 19, mono: true, anchor: "middle", color: C.bad, weight: 600 });
  } else {
    s += vec(A_H, C.accent2, "H", 118, [-128, -54]);
    s += angle(px, py, 46, dir(90), dir(A_H), { color: C.good, width: 2.5 });
    s += label(px - 8, py - 76, "< 90°", { color: C.good, anchor: "end" });
    s += text(x + PW / 2, y + PH - 24, "dot(N, H) > 0", { size: 19, mono: true, anchor: "middle", color: C.good, weight: 600 });
  }
  s += dot(px, py, { r: 5 });
  return s;
}

export function draw() {
  return svg(height, scene(PAD, false) + scene(PAD + PW + GAP, true));
}
