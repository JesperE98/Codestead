// Light casters, "Attenuation": F_att = 1 / (K_c + K_l·d + K_q·d²) over the distance d, for three rows of the
// chapter's table (lights that cover 13, 50 and 100 units). The curve for 50 – the values the chapter uses
// (1.0, 0.09, 0.032) – is marked at the distances of the chapter's own table: 1, 5, 10, 20, 50.
import { C, PAD, W, dot, line, perLanguage, pill, svg, t, text } from "./style.mjs";
import { L, LS } from "./_lighting.mjs";

export const variants = perLanguage("attenuation");

const X0 = PAD + 62, Y0 = 268, PWD = W - PAD - 30 - X0, PHT = 210, DMAX = 100;
export const height = Y0 + 72;

const rowsOf = [
  { range: 13, k: [1.0, 0.35, 0.44], color: C.accent2 },
  { range: 50, k: [1.0, 0.09, 0.032], color: C.accent },
  { range: 100, k: [1.0, 0.045, 0.0075], color: C.z },
];
const f = (k, d) => 1 / (k[0] + k[1] * d + k[2] * d * d);

export function draw(v) {
  const X = (d) => X0 + (d / DMAX) * PWD, Y = (a) => Y0 - a * PHT;
  let s = "";
  for (const a of [0.25, 0.5, 0.75, 1]) s += line(X0, Y(a), X0 + PWD, Y(a), { color: C.grid, width: 1 });
  for (const d of [20, 40, 60, 80, 100]) s += line(X(d), Y0, X(d), Y(1), { color: C.grid, width: 1 });
  s += line(X0, Y0 + 6, X0, Y(1) - 14, { color: C.line });
  s += line(X0 - 6, Y0, X0 + PWD + 8, Y0, { color: C.line });
  for (const r of rowsOf) {
    let d = "";
    for (let i = 0; i <= 400; i++) d += `${i ? "L" : "M"}${X((i / 400) * DMAX).toFixed(1)},${Y(f(r.k, (i / 400) * DMAX)).toFixed(1)}`;
    s += `<path d="${d}" fill="none" stroke="${r.color}" stroke-width="${r.range === 50 ? 3 : 2}" stroke-linecap="round"/>`;
  }
  for (const d of [1, 5, 10, 20, 50]) s += dot(X(d), Y(f(rowsOf[1].k, d)), { r: 4.5, color: C.accent, stroke: "#fff" });
  s += pill(X(10) + 12, Y(f(rowsOf[1].k, 10)) - 16, "0.20", { size: LS, mono: true, color: C.accent });
  // The legend: the distance each light covers.
  const lx = X(52), ly = Y(1) + 10;
  s += text(lx, ly, t(v, "Distance covered", "Avstånd som täcks"), { size: LS, weight: 650, color: C.muted });
  rowsOf.forEach((r, i) => {
    const y = ly + 30 + i * 28;
    s += line(lx, y, lx + 30, y, { color: r.color, width: 3 });
    s += text(lx + 40, y, String(r.range), { size: LS, weight: 650, mono: true, color: r.color });
  });
  for (const d of [0, 20, 40, 60, 80, 100]) s += text(X(d), Y0 + 22, String(d), { size: LS, anchor: "middle", color: C.muted, mono: true });
  for (const a of [0, 0.5, 1]) s += text(X0 - 12, Y(a), a.toFixed(1), { size: LS, anchor: "end", color: C.muted, mono: true });
  s += text(X0 + PWD + 4, Y0 + 50, "*d*", { size: L, anchor: "end", weight: 650 });
  s += text(X0 + 10, Y(1) - 22, "*F*_{att}", { size: L, weight: 650 });
  return svg(height, s);
}
