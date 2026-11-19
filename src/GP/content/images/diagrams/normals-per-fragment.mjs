// Normal Mapping, the start: a brick wall seen from the side. Left, the flat quad has one normal, the same for every
// fragment, so it is lit evenly. Right, the quad is just as flat, but every fragment gets its own normal from the normal
// map – the normals of the bumpy surface the map describes (dashed) – and the lighting follows the bricks.
import { BOLD, C, PAD, W, arrow, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel, polyline } from "./_advlight.mjs";

export const variants = perLanguage("normals-per-fragment");

const PW = W - 2 * PAD, PH = 150;
export const height = PAD + 2 * PH + 16 + PAD;

// The profile of two bricks with mortar between them: height h(u) for u in 0..1, and its slope.
const profile = (u) => {
  const m = ((u % 0.5) + 0.5) % 0.5; // position within one brick + joint (0.5 wide)
  const j = 0.05, b = 0.08; // half the joint, the bevel's width
  if (m < j || m > 0.5 - j) return -1; // in the joint
  if (m < j + b) return -1 + (m - j) / b; // bevel up
  if (m > 0.5 - j - b) return -1 + (0.5 - j - m) / b; // bevel down
  return 0;
};

function scene(y, perFragment, v) {
  const x = PAD;
  let s = panel(x, y, PW, PH);
  s += label(x + 16, y + 22, perFragment ? t(v, "A normal per fragment: the normal map", "En normal per fragment: normal map") : t(v, "One normal for the whole surface", "En normal för hela ytan"), { size: 21, weight: 650 });
  const sx = x + 40, sw = PW - 80, sy = y + PH - 36, depth = 18;
  // The surface the normal map describes (dashed), and the flat quad.
  if (perFragment) {
    const pts = [];
    for (let i = 0; i <= 400; i++) { const u = i / 400; pts.push([sx + u * sw, sy - 2 - (profile(u * 1.3 + 0.03) + 1) * depth]); }
    s += polyline(pts, { color: C.line, width: 1.5, dash: "4 3" });
  }
  s += line(sx, sy, sx + sw, sy, { color: C.ink, width: 3 });
  // The normals.
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const u = i / n, px = sx + u * sw;
    let dx = 0, dy = -1;
    if (perFragment) {
      const e = 0.002, uu = u * 1.3 + 0.03;
      const slope = ((profile(uu + e) - profile(uu - e)) / (2 * e)) * (depth / (sw / 1.3));
      const l = Math.hypot(slope, 1); dx = -slope / l; dy = -1 / l;
    }
    s += arrow(px, sy, px + dx * 52, sy + dy * 52, { color: perFragment && dx !== 0 ? C.accent : C.z, width: BOLD - 0.5 });
  }
  return s;
}

export function draw(v) {
  return svg(height, scene(PAD, false, v) + scene(PAD + PH + 16, true, v));
}
