// Diffuse Irradiance, "Cubemap convolution": the convolution's samples on the hemisphere around N, at equal steps of
// the azimuth φ (around) and of the zenith θ (from the normal down to the horizon) – the course takes steps of 0.1;
// here they are coarser so that they can be seen. Each ring has the same number of samples, but the rings near the
// top are short: a sample there stands for a smaller part of the hemisphere, hence the weight sin θ.
import { BOLD, C, PAD, W, arrow, dot, svg, text } from "./style.mjs";
import { panel } from "./_advlight.mjs";
import { hemisphere, sph, view } from "./_hemi.mjs";

export const variants = [{ out: "irradiance-samples.webp", lang: "en" }];

const PH = 300;
export const height = PAD + PH + PAD;

export function draw() {
  let s = panel(PAD, PAD, W - 2 * PAD, PH);
  const vw = view(PAD + 230, PAD + PH - 60, 190, 22);
  const { P, depth } = vw;
  s += hemisphere(vw, { opacity: 0.35 });
  const rings = 6, around = 16;
  // The samples, back ones first and paler.
  const list = [];
  for (let i = 1; i <= rings; i++) {
    const theta = (i - 0.5) * (Math.PI / 2 / rings);
    for (let j = 0; j < around; j++) {
      const phi = (j + 0.5) * ((2 * Math.PI) / around);
      const p = sph(theta, phi);
      list.push({ p, front: depth(...p) >= 0, ring: i });
    }
  }
  list.sort((a, b) => depth(...a.p) - depth(...b.p));
  for (const { p, front, ring } of list) {
    const [x, y] = P(...p);
    s += dot(x, y, { r: front ? 5 : 4, color: ring === 1 ? C.accent2 : C.accent, stroke: "#fff" });
    if (!front) s += `<circle cx="${x}" cy="${y}" r="4" fill="${C.card}" opacity="0.45"/>`;
  }
  const [cx, cy] = P(0, 0, 0), [nx, ny] = P(0, 1.3, 0);
  s += arrow(cx, cy, nx, ny, { color: C.ink, width: BOLD });
  s += text(nx + 12, ny + 8, "*N*", { size: 22, weight: 700 });
  // θ: the angle from N, along one meridian.
  const arc = [];
  for (let k = 0; k <= 24; k++) arc.push(P(...sph(((Math.PI / 2) * k) / 24, Math.PI).map((c) => c * 1.0)));
  s += `<path d="M${arc.map((p) => p.join(",")).join(" L")}" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  const [tx, ty] = P(...sph(0.7, Math.PI).map((c) => c * 1.12));
  s += text(tx - 8, ty, "*θ*", { size: 22, weight: 700, anchor: "end" });
  const [fx, fy] = P(...sph(Math.PI / 2, 0.5 * Math.PI).map((c) => c * 1.0));
  s += text(fx + 44, fy - 16, "*φ*", { size: 22, weight: 700, anchor: "middle" });
  // The explanation, as maths.
  const x = PAD + 470;
  s += text(x, PAD + 56, "*φ*: 0 … 2π", { size: 21, weight: 600 });
  s += text(x, PAD + 92, "*θ*: 0 … π/2", { size: 21, weight: 600 });
  s += text(x, PAD + 150, "× cos *θ*", { size: 21, weight: 600, color: C.accent });
  s += text(x, PAD + 186, "× sin *θ*", { size: 21, weight: 600, color: C.accent2 });
  return svg(height, s);
}
