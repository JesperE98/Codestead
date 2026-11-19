// SSAO, after the quiz on the hemisphere: a fragment on the floor in front of a wall, seen from the side, with the
// same samples in a sphere (left) and in a hemisphere along the normal (right). A sample counts as occluded when it
// lies inside the geometry – behind the surface the camera sees there. With the sphere, the half below the floor is
// occluded too, even on an open floor; with the hemisphere only the wall occludes.
import { BOLD, C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";

export const variants = perLanguage("ssao-hemisphere");

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 320;
export const height = PAD + PH + PAD;

// Sample offsets in a unit disc (a fixed set, spread out; more of them near the centre).
const pts = [];
for (let i = 0; i < 26; i++) {
  const a = i * 2.39996, r = 0.25 + 0.75 * Math.sqrt(((i * 7) % 26) / 26);
  pts.push([Math.cos(a) * r, Math.sin(a) * r]);
}

function scene(x, hemi, v) {
  const y = PAD;
  let s = panel(x, y, PW, PH);
  s += label(x + 14, y + 24, hemi ? t(v, "Hemisphere along the normal", "Halvsfär längs normalen") : t(v, "Sphere", "Sfär"), { size: 21, weight: 650, fit: PW - 28 });
  const fy = y + PH - 124, wallX = x + PW - 64; // the floor's height, the wall's left side
  const fx = wallX - 52, R = 86; // the fragment and the kernel's radius
  // Floor and wall (solid).
  s += `<path d="M${x + 1},${fy} L${wallX},${fy} L${wallX},${y + 44} L${x + PW - 1},${y + 44} L${x + PW - 1},${y + PH - 1} L${x + 1},${y + PH - 1} Z" fill="${C.grid}"/>`;
  s += line(x + 1, fy, wallX, fy, { color: C.line, width: 2 }) + line(wallX, fy, wallX, y + 44, { color: C.line, width: 2 });
  // The kernel's outline.
  s += hemi
    ? `<path d="M${fx - R},${fy} A${R},${R} 0 0 1 ${fx + R},${fy}" fill="${C.accentSoft}" fill-opacity="0.5" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="5 4"/>`
    : `<circle cx="${fx}" cy="${fy}" r="${R}" fill="${C.accentSoft}" fill-opacity="0.5" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  let occluded = 0;
  for (const [px, py] of pts) {
    const sx = fx + px * R, sy = fy - (hemi ? Math.abs(py) : py) * R;
    const inside = sy > fy || sx > wallX;
    if (inside) occluded++;
    s += dot(sx, sy, { r: 5, color: inside ? C.bad : C.good, stroke: "#fff" });
  }
  s += arrow(fx, fy, fx, fy - 54, { color: C.ink, width: BOLD });
  s += dot(fx, fy, { r: 6, color: C.ink });
  s += label(x + 14, y + PH - 20, t(v, `occluded: ${occluded} of ${pts.length}`, `skymda: ${occluded} av ${pts.length}`), { color: C.bad });
  return s;
}

export function draw(v) {
  return svg(height, scene(PAD, false, v) + scene(PAD + PW + GAP, true, v));
}
