// Light casters, "Spotlight": the chapter's names for a spotlight – SpotDir, the direction it aims at; the cut-off
// angle ϕ; and, for a fragment, LightDir (from the fragment to the light) and θ, the angle between SpotDir and the
// direction from the light to the fragment. The fragment inside the cone has θ < ϕ, the one outside θ > ϕ.
// Language-free (the code's names and the angles).
import { BOLD, C, PAD, arcArrow, arrow, dot, line, svg, text } from "./style.mjs";
import { L, lamp, surface } from "./_lighting.mjs";

export const variants = [{ out: "spotlight-cone.webp", lang: "en" }];
export const height = 360;

export function draw() {
  let s = "";
  const rad = (d) => (d * Math.PI) / 180;
  const lx = 110, ly = 62, gy = 296; // the light and the floor
  const AIM = -40, PHI = 15; // SpotDir's angle (degrees on screen: 0 = right, negative = down) and the cut-off
  const dir = (a, r) => [lx + r * Math.cos(rad(a)), ly - r * Math.sin(rad(a))];
  const toFloor = (a) => dir(a, (gy - ly) / Math.sin(rad(-a)));
  const [e1x, e1y] = toFloor(AIM + PHI), [e2x, e2y] = toFloor(AIM - PHI);
  s += `<path d="M${lx},${ly} L${e1x},${e1y} L${e2x},${e2y} Z" fill="#fde8b0" opacity="0.85"/>`;
  s += line(lx, ly, e1x, e1y, { color: "#c98a12", width: 1.5, dash: "5 4" }) + line(lx, ly, e2x, e2y, { color: "#c98a12", width: 1.5, dash: "5 4" });
  s += surface(PAD + 20, gy, 700, gy);
  const IN = AIM + 8, OUT = AIM - 30;
  const [fx, fy] = toFloor(IN), [ox, oy] = toFloor(OUT);
  s += line(lx, ly, fx, fy, { color: C.accent, width: 1.5, dash: "4 3" });
  s += line(lx, ly, ox, oy, { color: C.muted, width: 1.5, dash: "4 3" });
  // ϕ: between SpotDir and the cone's edge; θ: between SpotDir and the direction to the fragment inside.
  s += arcArrow(lx, ly, 175, AIM, AIM + PHI, { noHead: true, color: "#c98a12", width: 2 });
  s += text(...dir(AIM + PHI / 2, 198), "ϕ", { size: L + 2, italic: true, weight: 650, anchor: "middle", color: "#b07a10" });
  s += arcArrow(lx, ly, 112, AIM, IN, { noHead: true, color: C.accent, width: 2 });
  s += text(...dir(AIM + 4, 134), "θ", { size: L + 2, italic: true, weight: 650, anchor: "middle", color: C.accent });
  const [sx, sy] = dir(AIM, 235);
  s += arrow(lx, ly, sx, sy, { color: "#c98a12", width: BOLD });
  s += text(sx - 30, sy + 26, "SpotDir", { size: L, mono: true, weight: 600, color: "#b07a10" });
  // LightDir at both fragments: from the fragment towards the light.
  const toLight = (x, y, k) => [x + (lx - x) * k, y + (ly - y) * k];
  const [tx, ty] = toLight(fx, fy, 0.3);
  s += arrow(fx, fy, tx, ty, { color: C.accent, width: BOLD });
  s += arrow(ox, oy, ...toLight(ox, oy, 0.3), { color: C.muted, width: BOLD });
  s += text(tx + 6, ty - 22, "LightDir", { size: L, mono: true, weight: 600, color: C.accent });
  s += dot(fx, fy, { r: 6, color: C.accent, stroke: "#fff" });
  s += dot(ox, oy, { r: 6, color: C.ink, stroke: "#fff" });
  s += lamp(lx, ly);
  s += text(fx, gy + 30, "*θ* < *ϕ*", { size: L, anchor: "middle", weight: 650, color: C.accent });
  s += text(ox, gy + 30, "*θ* > *ϕ*", { size: L, anchor: "middle", weight: 650, color: C.muted });
  return svg(height, s);
}
