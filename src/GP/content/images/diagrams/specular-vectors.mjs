// Basic Lighting, "Specular Lighting" (after the quiz about reflect(-lightDir, norm)): the vectors of the specular term
// with the shader's names. lightDir points from the fragment to the lamp; reflect wants the incoming direction,
// -lightDir, and mirrors it about the surface into reflectDir; the smaller the angle between reflectDir and viewDir,
// the brighter the highlight. Language-free (the code's names).
import { BOLD, C, PAD, W, arcArrow, arrow, dot, line, svg, text } from "./style.mjs";
import { L, LS, eye, lamp, surface } from "./_lighting.mjs";

export const variants = [{ out: "specular-vectors.webp", lang: "en" }];
export const height = 380;

export function draw() {
  let s = "";
  const rad = (d) => (d * Math.PI) / 180;
  const fx = 300, fy = 222, len = 125;
  // A direction `a` degrees from the normal (positive: to the right), as a point at distance r from the fragment.
  const at = (a, r) => [fx + r * Math.sin(rad(a)), fy - r * Math.cos(rad(a))];
  s += surface(PAD + 60, fy, W - PAD - 60, fy);
  const [lx, ly] = at(-50, 205), [ex, ey] = at(28, 205);
  s += line(lx, ly, fx, fy, { color: "#c98a12", dash: "5 4", width: 1.5 });
  s += line(fx, fy, ex, ey, { color: C.muted, dash: "5 4", width: 1.5 });
  // The angle between reflectDir and viewDir.
  s += arcArrow(fx, fy, 84, 90 - 50, 90 - 28, { noHead: true, color: C.accent, width: 2 });
  // -lightDir: the light's direction, drawn from the fragment on into the surface; reflectDir is its mirror image.
  const [ix, iy] = [fx + len * Math.sin(rad(50)), fy + len * Math.cos(rad(50))];
  s += arrow(fx, fy, ix, iy, { color: C.muted, width: 2, dash: "6 4" });
  s += arrow(fx, fy, ...at(0, len), { color: C.y, width: BOLD });
  s += arrow(fx, fy, ...at(-50, len), { color: "#c98a12", width: BOLD });
  s += arrow(fx, fy, ...at(50, len), { color: C.accent, width: BOLD });
  s += arrow(fx, fy, ...at(28, len), { color: C.accent2, width: BOLD });
  s += lamp(lx, ly);
  s += eye(ex, ey, 90 - 28 + 180);
  s += dot(fx, fy, { r: 5 });
  const [nx, ny] = at(0, len), [ldx, ldy] = at(-50, len), [rx, ry] = at(50, len);
  s += text(nx - 10, ny - 4, "norm", { size: L, mono: true, weight: 600, color: C.y, anchor: "end" });
  s += text(ldx - 12, ldy + 14, "lightDir", { size: L, mono: true, weight: 600, color: "#b07a10", anchor: "end" });
  s += text(rx + 12, ry + 16, "reflectDir", { size: L, mono: true, weight: 600, color: C.accent });
  s += text(ex + 18, ey + 8, "viewDir", { size: L, mono: true, weight: 600, color: C.accent2 });
  s += text(ix + 12, iy + 4, "-lightDir", { size: L, mono: true, weight: 600, color: C.muted });
  s += text(W / 2, height - PAD - 12, "spec = pow(max(dot(viewDir, reflectDir), 0.0), 32)", { size: LS, mono: true, weight: 600, anchor: "middle" });
  return svg(height, s);
}
