// Shadow Mapping, "Shadow mapping": the two passes in a side view. The directional light's parallel rays come from the
// upper left; pass 1 stores the closest depth along each ray in the depth map (drawn as the strip across the rays).
// In pass 2 a floor point P behind the box has the depth 0.9 in the light's view, but the depth map holds 0.4 there
// – the top of the box – so P is in shadow. A floor point Q that the light sees directly is lit. (The chapter's
// example numbers.)
import { BOLD, C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel, poly } from "./_advlight.mjs";

export const variants = perLanguage("shadow-map-idea");

const PH = 340;
export const height = PAD + PH + PAD;

export function draw(v) {
  const x0 = PAD, y0 = PAD;
  let s = panel(x0, y0, W - 2 * PAD, PH);
  // The light's direction: down and to the right at 45°; across the rays: down and to the left.
  const d = [Math.SQRT1_2, Math.SQRT1_2], n = [-Math.SQRT1_2, Math.SQRT1_2];
  const floorY = y0 + PH - 52;
  const bx = 300, bw = 90, bh = 90, by = floorY - bh; // the box
  const P = [bx + bw + 50, floorY]; // in the box's shadow (which reaches bh = 90 beyond the box at 45°)
  const H = [P[0] - bh, by]; // where the ray to P meets the box's top
  const Q = [540, floorY]; // a lit point
  const C0 = [260, 170]; // the depth map's centre
  // Where a ray to the point q starts on the depth map (the line through C0 along n).
  const onMap = (q) => { const k = (q[0] - C0[0]) * n[0] + (q[1] - C0[1]) * n[1]; return [C0[0] + n[0] * k, C0[1] + n[1] * k, k]; };
  const sP = onMap(H), sQ = onMap(Q);
  // The floor and the shadow.
  s += `<rect x="${x0 + 1}" y="${floorY}" width="${W - 2 * PAD - 2}" height="${y0 + PH - floorY - 1}" fill="${C.grid}"/>`;
  s += `<rect x="${bx + bw}" y="${floorY}" width="${bh}" height="9" fill="${C.ink}" opacity="0.5"/>`;
  s += line(x0 + 1, floorY, W - PAD - 1, floorY, { color: C.line, width: 2 });
  // Faint parallel rays.
  for (const k of [-60, -20, 30, 70]) {
    const p = [C0[0] + n[0] * k, C0[1] + n[1] * k];
    const tt = (floorY - p[1]) / d[1];
    s += line(p[0], p[1], p[0] + d[0] * tt, floorY, { color: C.accent, width: 1, dash: "4 5", opacity: 0.6 });
  }
  // The ray to P: what the light sees ends at H; behind it, P.
  s += arrow(sP[0], sP[1], H[0], H[1], { color: C.accent, width: BOLD });
  s += line(H[0], H[1], P[0], P[1], { color: C.bad, width: BOLD, dash: "6 5" });
  s += arrow(sQ[0], sQ[1], Q[0], Q[1], { color: C.accent, width: BOLD });
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="2"/>`;
  // The depth map: a strip across the rays, with texels.
  const k0 = Math.min(sP[2], sQ[2]) - 40, k1 = Math.max(sP[2], sQ[2]) + 40;
  const th = [d[0] * 9, d[1] * 9];
  const m0 = [C0[0] + n[0] * k0, C0[1] + n[1] * k0], m1 = [C0[0] + n[0] * k1, C0[1] + n[1] * k1];
  s += poly([[m0[0] - th[0], m0[1] - th[1]], [m1[0] - th[0], m1[1] - th[1]], [m1[0] + th[0], m1[1] + th[1]], [m0[0] + th[0], m0[1] + th[1]]], { fill: "#fff", color: C.ink, width: 1.5 });
  for (let k = k0 + 16; k < k1; k += 16) { const p = [C0[0] + n[0] * k, C0[1] + n[1] * k]; s += line(p[0] - th[0], p[1] - th[1], p[0] + th[0], p[1] + th[1], { color: C.line, width: 1 }); }
  s += label(m1[0] - 16, m1[1] - 16, t(v, "depth map (pass 1)", "depth map (pass 1)"), { anchor: "end" });
  s += label(m0[0] + 18, m0[1] - 4, t(v, "light", "ljus"), { color: C.accent });
  // The points and their depths.
  s += dot(H[0], H[1], { r: 5.5, color: C.accent2 });
  s += label(H[0] - 6, H[1] - 20, t(v, "closest: 0.4", "närmast: 0.4"), { anchor: "end", color: C.accent2 });
  s += dot(P[0], P[1], { r: 6, color: C.bad });
  s += label(P[0], floorY + 30, t(v, "P: 0.9 > 0.4, in shadow", "P: 0.9 > 0.4, i skugga"), { anchor: "middle", color: C.bad });
  s += dot(Q[0], Q[1], { r: 6, color: C.good });
  s += label(Q[0] + 12, floorY - 18, t(v, "Q: lit", "Q: belyst"), { color: C.good });
  return svg(height, s);
}
