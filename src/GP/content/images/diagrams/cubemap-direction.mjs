// Cubemaps, the introduction: a cube map is sampled with a direction from the cube's centre – the vector d and the
// vector 2d leave the centre in the same direction and pierce the same face (+X) at the same point, so they get the same
// texel. Drawn in the course's oblique 3D view. Language-free.
import { BOLD, C, PAD, W, arrow, dot, line, oblique, svg, text } from "./style.mjs";
import { LBL, poly } from "./_advgl.mjs";

export const variants = [{ out: "cubemap-direction.webp", lang: "en" }];

const U = 120;
export const height = PAD + 2 * U * 1.25 + 40;

export function draw() {
  let s = "";
  const P = oblique(W / 2 - 40, PAD + 1.25 * U + 10, U);
  const c = (x, y, z) => P(x, y, z);
  const e = 1; // the cube from -1 to 1
  const pts = [];
  for (const x of [-e, e]) for (const y of [-e, e]) for (const z of [-e, e]) pts.push([x, y, z]);
  // The +X face, shaded, with the point where the direction leaves the cube.
  const dir = [1, 0.45, -0.3];
  const hit = dir.map((v) => v / Math.max(...dir.map(Math.abs)));
  s += poly([c(e, -e, -e), c(e, e, -e), c(e, e, e), c(e, -e, e)], { close: true, fill: C.accentSoft, color: C.accent, width: 1.5 });
  // Hidden edges dashed, the others solid.
  const edges = [];
  for (const a of pts) for (const b of pts) {
    const diff = a.filter((v, i) => v !== b[i]).length;
    if (diff === 1 && a.join() < b.join()) edges.push([a, b]);
  }
  for (const [a, b] of edges) {
    const hidden = (a[0] === -e && b[0] === -e && (a[2] === -e || b[2] === -e) && (a[1] === -e || b[1] === -e)) ||
      (a[0] === -e && b[0] === -e && a[1] === -e && b[1] === -e) || (a[1] === -e && b[1] === -e && a[2] === -e && b[2] === -e) ||
      (a[0] === -e && b[0] === -e && a[2] === -e && b[2] === -e);
    s += line(...c(...a), ...c(...b), { color: hidden ? C.line : C.ink, width: 1.5, dash: hidden ? "5 4" : undefined });
  }
  // 2d (longer, behind) and d.
  const o = c(0, 0, 0);
  const far = c(...hit.map((v) => v * 1.75));
  s += arrow(...o, ...far, { color: C.accent2, width: BOLD, dash: "8 5" });
  s += arrow(...o, ...c(...hit.map((v) => v * 0.62)), { color: C.accent, width: BOLD + 0.5 });
  s += dot(...c(...hit), { r: 6, color: C.ink, stroke: "#ffffff" });
  s += dot(...o, { r: 4.5 });
  const [dx, dy] = c(...hit.map((v) => v * 0.4));
  s += text(dx - 14, dy + 24, "*d*", { size: LBL + 2, weight: 650, color: C.accent, anchor: "middle" });
  s += text(far[0] + 14, far[1] - 4, "2*d*", { size: LBL + 2, weight: 650, color: C.accent2 });
  s += text(c(e, -e, e)[0] + 16, c(e, -e, e)[1] - 8, "+X", { size: LBL, weight: 650, color: C.accent, mono: true });
  return svg(height, s);
}
