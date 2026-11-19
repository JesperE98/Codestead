// Light casters, "Smooth/Soft edges" (after the task "soft-edges"): the spotlight's intensity over the angle θ to its
// direction – the hard cut-off of the task "spotlight" at 12.5°, and the soft edge between the inner (12.5°) and the
// outer cone (17.5°), clamp((θ − γ) / ε, 0, 1) in cosines – and container 0 with both, drawn by the simulator.
import { C, PAD, W, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { L, LS, crop } from "./_lighting.mjs";

export const variants = perLanguage("soft-edges");
export const lossy = true;

const S = 196; // the renders
const X0 = PAD + 2 * S + 14 + 60, PWD = W - PAD - 18 - X0, Y0 = PAD + 180, PHT = 150, TMAX = 25;
export const height = PAD + S + 48;

export const renders = {
  hard: { api: "opengl", chapter: "light-casters", from: "task:spotlight", width: 800 },
  soft: { api: "opengl", chapter: "light-casters", from: "task:soft-edges", width: 800 },
};

const cos = (d) => Math.cos((d * Math.PI) / 180);
const soft = (d) => Math.min(1, Math.max(0, (cos(d) - cos(17.5)) / (cos(12.5) - cos(17.5))));

export function draw(v, R) {
  let s = "";
  // Container 0 fills the middle of the 800 × 600 window.
  s += crop(R.hard[0], 210, 110, 380, 380, PAD, PAD, S, S);
  s += crop(R.soft[0], 210, 110, 380, 380, PAD + S + 14, PAD, S, S);
  s += text(PAD + S / 2, PAD + S + 26, t(v, "Hard edge", "Hård kant"), { size: L, weight: 650, anchor: "middle", color: C.muted });
  s += text(PAD + S + 14 + S / 2, PAD + S + 26, t(v, "Soft edge", "Mjuk kant"), { size: L, weight: 650, anchor: "middle", color: C.accent });
  // The intensity over θ.
  const X = (d) => X0 + (d / TMAX) * PWD, Y = (a) => Y0 - a * PHT;
  s += `<rect x="${X(12.5)}" y="${Y(1) - 6}" width="${X(17.5) - X(12.5)}" height="${PHT + 6}" fill="${C.accentSoft}"/>`;
  s += line(X0, Y0 + 6, X0, Y(1) - 12, { color: C.line });
  s += line(X0 - 6, Y0, X0 + PWD + 6, Y0, { color: C.line });
  s += `<path d="M${X(0)},${Y(1)} L${X(12.5)},${Y(1)} L${X(12.5)},${Y(0)} L${X(TMAX)},${Y(0)}" fill="none" stroke="${C.muted}" stroke-width="2" stroke-dasharray="6 4"/>`;
  let d = "";
  for (let i = 0; i <= 250; i++) d += `${i ? "L" : "M"}${X((i / 250) * TMAX).toFixed(1)},${Y(soft((i / 250) * TMAX)).toFixed(1)}`;
  s += `<path d="${d}" fill="none" stroke="${C.accent}" stroke-width="3" stroke-linejoin="round"/>`;
  s += dot(X(15), Y(soft(15)), { r: 4.5, color: C.accent, stroke: "#fff" });
  for (const [deg, lbl, anchor, dx] of [[0, "0°", "middle", 0], [12.5, "12.5°", "end", 6], [17.5, "17.5°", "start", -6]])
    s += text(X(deg) + dx, Y0 + 22, lbl, { size: LS, anchor, color: deg ? C.ink : C.muted, weight: 600 });
  s += text(X0 - 10, Y(1), "1", { size: LS, anchor: "end", color: C.muted, weight: 600 });
  s += text(X0 - 10, Y0, "0", { size: LS, anchor: "end", color: C.muted, weight: 600 });
  s += text(X0 + PWD, Y0 + 22, "*θ*", { size: L, anchor: "end", weight: 650 });
  s += text(X(15) + 10, Y(soft(15)) - 14, "0.54", { size: LS, mono: true, weight: 600, color: C.accent });
  return svg(height, s);
}
