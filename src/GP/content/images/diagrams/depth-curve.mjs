// Depth testing, "Depth value precision": the value that ends up in the depth buffer for a distance z in front of the
// camera, with the chapter's near = 0.1 and far = 100 – the non-linear F_depth (what the projection gives) against the
// linear equation. The marks are the chapter's numbers: 0.5 at 0.2 units, 0.9 at about 1 unit, and the left cube's
// front 3.5 units away at about 0.97.
import { BOLD, C, PAD, W, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { LBL, SML, poly } from "./_advgl.mjs";

export const variants = perLanguage("depth-curve");

const near = 0.1, far = 100, ZMAX = 10;
const X0 = PAD + 62, X1 = W - PAD - 14, Y0 = PAD + 44, Y1 = PAD + 44 + 270;
export const height = Y1 + 74;

const sx = (z) => X0 + (z / ZMAX) * (X1 - X0);
const sy = (d) => Y1 - d * (Y1 - Y0);
const nonLinear = (z) => (1 / z - 1 / near) / (1 / far - 1 / near);
const linear = (z) => (z - near) / (far - near);

export function draw(v) {
  let s = "";
  // Grid and axes.
  for (let z = 0; z <= ZMAX; z += 2) {
    s += line(sx(z), Y0, sx(z), Y1, { color: C.grid, width: 1 });
    s += text(sx(z), Y1 + 20, String(z), { anchor: "middle", size: SML, color: C.muted });
  }
  for (const d of [0, 0.5, 1]) {
    s += line(X0, sy(d), X1, sy(d), { color: C.grid, width: 1 });
    s += text(X0 - 10, sy(d), d === 0.5 ? "0.5" : String(d), { anchor: "end", size: SML, color: C.muted });
  }
  s += line(X0, Y1, X1, Y1, { color: C.line });
  s += line(X0, Y0 - 6, X0, Y1, { color: C.line });
  s += text((X0 + X1) / 2, Y1 + 50, t(v, "distance from the camera (units)", "avstånd från kameran (enheter)"), { anchor: "middle", size: LBL, weight: 600 });
  s += text(PAD, PAD + 14, t(v, "Depth buffer value", "Värde i djupbufferten"), { size: LBL, weight: 650 });
  // The two equations.
  const pts = [];
  for (let z = near; z <= ZMAX + 1e-9; z += 0.01) pts.push([sx(z), sy(nonLinear(z))]);
  s += poly(pts, { color: C.accent, width: BOLD + 0.5 });
  s += poly([[sx(near), sy(linear(near))], [sx(ZMAX), sy(linear(ZMAX))]], { color: C.accent2, width: BOLD, dash: "7 5" });
  // The marks.
  const mark = (z, label, dx, dy, anchor) => {
    const x = sx(z), y = sy(nonLinear(z));
    return line(x, y, x, Y1, { color: C.accent, width: 1, dash: "4 3" }) + dot(x, y, { r: 5, color: C.accent }) +
      text(x + dx, y + dy, label, { size: SML, weight: 600, anchor });
  };
  s += mark(0.2, t(v, "0.5 at 0.2 units", "0.5 vid 0.2 enheter"), 14, 6, "start");
  s += mark(3.5, t(v, "front of the left cube: 0.97", "vänstra kubens framsida: 0.97"), 0, 26, "start");
  // Legend, under the curve's top.
  const ly = sy(0.62);
  s += line(sx(4.4), ly, sx(5.2), ly, { color: C.accent, width: BOLD + 0.5 });
  s += text(sx(5.4), ly, t(v, "the depth buffer (∝ 1/z)", "djupbufferten (∝ 1/z)"), { size: SML, weight: 600 });
  s += line(sx(4.4), ly + 34, sx(5.2), ly + 34, { color: C.accent2, width: BOLD, dash: "7 5" });
  s += text(sx(5.4), ly + 34, t(v, "linear (z − near) / (far − near)", "linjärt (z − near) / (far − near)"), { size: SML, weight: 600 });
  return svg(height, s);
}
