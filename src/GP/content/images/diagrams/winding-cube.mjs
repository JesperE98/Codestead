// Face culling, "Winding order": a cube seen from the camera in front of it, twice – with the first triangle of its
// front face, and with the first triangle of its back face seen through the cube (the counter-clockwise cube of the
// chapter: front (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5); back (-0.5, -0.5, -0.5), (0.5, 0.5, -0.5),
// (0.5, -0.5, -0.5)). Both are counter-clockwise seen from outside; on the screen the front one goes round
// counter-clockwise, the back one clockwise.
import { BOLD, C, PAD, W, arcArrow, badge, line, perLanguage, svg, t, text } from "./style.mjs";
import { LBL, SML, poly } from "./_advgl.mjs";

export const variants = perLanguage("winding-cube");

const GAP = 20, PW = (W - 2 * PAD - GAP) / 2;
const F = 105, B = 62; // half the front and the back square on screen
const CY = PAD + 22 + F;
export const height = CY + F + 118;

function cube(cx, backFace) {
  let s = "";
  const fp = (x, y) => [cx + x * 2 * F, CY - y * 2 * F];
  const bp = (x, y) => [cx + x * 2 * B, CY - y * 2 * B];
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  s += poly(corners.map(([x, y]) => bp(x, y)), { close: true, color: C.line, width: 1.5, dash: "5 4" });
  for (const [x, y] of corners) s += line(...fp(x, y), ...bp(x, y), { color: C.line, width: 1.5, dash: "5 4" });
  s += poly(corners.map(([x, y]) => fp(x, y)), { close: true, color: backFace ? C.line : C.ink, width: 1.5 });
  const tri = backFace ? [bp(-0.5, -0.5), bp(0.5, 0.5), bp(0.5, -0.5)] : [fp(-0.5, -0.5), fp(0.5, -0.5), fp(0.5, 0.5)];
  const color = backFace ? C.accent2 : C.accent;
  s += poly(tri, { close: true, fill: backFace ? C.accent2Soft : C.accentSoft, color, width: BOLD });
  const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  s += backFace ? arcArrow(mx, my, 23, 400, 60, { color, width: BOLD }) : arcArrow(mx, my, 30, 210, 480, { color, width: BOLD });
  // The corners in the order they are listed.
  const off = backFace ? [[-15, 15], [15, -15], [15, 15]] : [[-15, 15], [15, 15], [15, -15]];
  tri.forEach(([x, y], i) => (s += badge(x + off[i][0], y + off[i][1], i + 1, { r: 12, color })));
  return s;
}

export function draw(v) {
  let s = "";
  const cols = [
    [false, C.accent, t(v, "Front face", "Framsidan"), t(v, "counter-clockwise on screen", "moturs på skärmen"), t(v, "front-facing: drawn", "framsida: ritas")],
    [true, C.accent2, t(v, "Back face, seen through", "Baksidan, sedd genom kuben"), t(v, "the same corners: clockwise", "samma hörn: medurs"), t(v, "back-facing: culled", "baksida: tas bort")],
  ];
  cols.forEach(([backFace, color, title, l1, l2], i) => {
    const x = PAD + i * (PW + GAP), cx = x + PW / 2;
    s += cube(cx, backFace);
    const ty = CY + F + 34;
    s += text(cx, ty, title, { anchor: "middle", size: LBL, weight: 650, color, fit: PW });
    s += text(cx, ty + 28, l1, { anchor: "middle", size: SML, fit: PW });
    s += text(cx, ty + 54, `→ ${l2}`, { anchor: "middle", size: SML, color: C.muted, fit: PW });
  });
  return svg(height, s);
}
