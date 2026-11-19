// Instancing, "Instanced arrays": which attribute values the vertex shader gets in an instanced draw of the quad (6
// vertices) – the position advances with every vertex and starts again with each instance; the instanced offset
// advances only once per instance, so all six vertices of instance 0 get offset 0, those of instance 1 offset 1, ….
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = perLanguage("instanced-array");

const LW = 112, CW = 42, IG = 18; // the label column, a cell, the gap between instances
const X0 = PAD + LW, Y0 = PAD + 40, RH = 40;
export const height = Y0 + 3 * RH + 92;

function cell(x, y, w, label, fill, stroke, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${RH}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    text(x + w / 2, y + RH / 2, label, { anchor: "middle", mono: true, size: SML, weight: o.weight ?? 600, fit: w - 4, color: o.color });
}

export function draw(v) {
  let s = "";
  const rows = [t(v, "vertex", "vertex"), "position", "offset"];
  rows.forEach((r, i) => (s += text(PAD, Y0 + i * RH + RH / 2, r, { size: LBL, weight: 600 })));
  for (let inst = 0; inst < 2; inst++) {
    const x = X0 + inst * (6 * CW + IG);
    s += text(x + 3 * CW, PAD + 16, t(v, `instance ${inst}`, `instans ${inst}`), { anchor: "middle", size: LBL, weight: 650 });
    for (let i = 0; i < 6; i++) {
      s += cell(x + i * CW, Y0, CW, String(i), "#ffffff", C.boxStroke, { weight: 500, color: C.muted });
      s += cell(x + i * CW, Y0 + RH, CW, `P${i}`, C.accentSoft, C.accent);
    }
    s += cell(x, Y0 + 2 * RH, 6 * CW, `offset ${inst}`, C.accent2Soft, C.accent2);
  }
  s += text(X0 + 2 * (6 * CW + IG) - IG / 2 + 2, Y0 + RH * 1.5, "…", { size: LBL, weight: 600 });
  // What each row does.
  const ny = Y0 + 3 * RH + 30;
  s += `<rect x="${PAD}" y="${ny - 10}" width="20" height="20" fill="${C.accentSoft}" stroke="${C.accent}"/>`;
  s += text(PAD + 30, ny, t(v, "per vertex: the next value for every vertex", "per vertex: nästa värde för varje vertex"), { size: SML, fit: W - 2 * PAD - 30 });
  s += `<rect x="${PAD}" y="${ny + 26}" width="20" height="20" fill="${C.accent2Soft}" stroke="${C.accent2}"/>`;
  s += text(PAD + 30, ny + 36, t(v, "per instance: the next value for every instance", "per instans: nästa värde för varje instans"), { size: SML, fit: W - 2 * PAD - 30 });
  return svg(height, s);
}
