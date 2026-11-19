// PBR Theory, "The reflectance equation": the hemisphere Ω around the normal n of a point p. Light arrives from every
// direction ωi in it – one of them drawn, with the small solid angle dωi around it and the angle θ to the normal,
// whose cosine n · ωi weakens it; Lo is the light reflected towards the viewer, in the direction ωo. Language-free.
import { BOLD, C, PAD, W, arrow, dot, line, svg, text } from "./style.mjs";
import { panel } from "./_advlight.mjs";
import { hemisphere, sph, view } from "./_hemi.mjs";

export const variants = [{ out: "reflectance-hemisphere.webp", lang: "en" }];

const PH = 300;
export const height = PAD + PH + PAD;

export function draw() {
  let s = panel(PAD, PAD, W - 2 * PAD, PH);
  const vw = view(PAD + 215, PAD + PH - 84, 160);
  const { P } = vw;
  // The surface: a larger ellipse.
  const [cx, cy] = P(0, 0, 0);
  s += `<ellipse cx="${cx}" cy="${cy}" rx="200" ry="${200 * Math.sin(vw.a)}" fill="${C.grid}" stroke="${C.boxStroke}"/>`;
  s += hemisphere(vw);
  const g = (v3) => P(...v3);
  // n.
  const [nx, ny] = g([0, 1.25, 0]);
  s += arrow(cx, cy, nx, ny, { color: C.ink, width: BOLD });
  s += text(nx + 14, ny + 6, "*n*", { size: 22, weight: 700 });
  // ωi: incoming, from the upper left; its patch dωi on the hemisphere.
  const ti = 0.75, pi = Math.PI * 0.92;
  const wi = sph(ti, pi), [ix, iy] = g(wi.map((c) => c * 1.0));
  const patch = [];
  for (const [dt, dp] of [[-0.09, -0.16], [0.09, -0.16], [0.09, 0.16], [-0.09, 0.16]]) patch.push(g(sph(ti + dt, pi + dp)));
  s += `<polygon points="${patch.map((p) => p.join(",")).join(" ")}" fill="${C.accent}" fill-opacity="0.45" stroke="${C.accent}" stroke-width="1.5"/>`;
  const [fx, fy] = g(wi.map((c) => c * 1.45));
  s += arrow(fx, fy, cx - 4, cy - 4, { color: C.accent, width: BOLD + 0.5 });
  s += text(fx - 6, fy - 16, "*ω*_{i}", { size: 24, weight: 700, color: C.accent, anchor: "middle" });
  s += text(ix - 34, iy + 4, "d*ω*_{i}", { size: 21, weight: 700, color: C.accent, anchor: "end" });
  // θ between n and ωi.
  const arc = [];
  for (let k = 0; k <= 20; k++) arc.push(g(sph((ti * k) / 20, pi).map((c) => c * 0.32)));
  s += `<path d="M${arc.map((p) => p.join(",")).join(" L")}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  const [tx, ty] = g(sph(ti / 2, pi).map((c) => c * 0.44));
  s += text(tx - 6, ty, "*θ*", { size: 22, weight: 700, anchor: "middle" });
  // ωo: towards the viewer.
  const wo = sph(0.85, 0.15), [ox, oy] = g(wo.map((c) => c * 1.35));
  s += arrow(cx, cy, ox, oy, { color: C.accent2, width: BOLD + 0.5 });
  s += text(ox - 14, oy - 16, "*ω*_{o}", { size: 24, weight: 700, color: C.accent2, anchor: "end" });
  s += `<path d="M${ox + 6},${oy - 18} q14,-12 28,0 q-14,12 -28,0 Z" fill="#fff" stroke="${C.accent2}" stroke-width="2"/><circle cx="${ox + 20}" cy="${oy - 18}" r="4" fill="${C.accent2}"/>`;
  // p and Ω.
  s += dot(cx, cy, { r: 6 });
  s += text(cx + 12, cy + 18, "*p*", { size: 22, weight: 700 });
  const [hx, hy] = g(sph(1.15, -0.5));
  s += text(hx + 18, hy - 4, "Ω", { size: 24, weight: 700, color: C.accent });
  // The equation's pieces, on the right.
  const x = PAD + 468;
  s += text(x, PAD + 60, "*n* · *ω*_{i} = cos *θ*", { size: 21, weight: 600 });
  s += text(x, PAD + 120, "*L*_{o}(*p*, *ω*_{o}) =", { size: 21, weight: 600, color: C.accent2 });
  s += text(x + 10, PAD + 160, "∫_{Ω} *f*_{r} *L*_{i} (*n* · *ω*_{i}) d*ω*_{i}", { size: 21, weight: 600, fit: W - PAD - x - 16 });
  void line;
  return svg(height, s);
}
