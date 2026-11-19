// PBR Theory, "Energy conservation": a light ray hits a surface and splits into a reflected part (specular, kS) and a
// refracted part (diffuse, kD = 1 − kS). In a dielectric the refracted light scatters and partly leaves the surface
// again – the diffuse colour; in a metal all of it is absorbed, so a metal only reflects.
import { BOLD, C, PAD, W, arrow, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel, polyline } from "./_advlight.mjs";

export const variants = perLanguage("reflect-refract");

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 290;
export const height = PAD + PH + PAD;

function scene(x, metal, v) {
  const y = PAD;
  let s = panel(x, y, PW, PH);
  s += label(x + 14, y + 24, metal ? t(v, "Metal", "Metall") : t(v, "Dielectric (non-metal)", "Dielektrikum (icke-metall)"), { size: 21, weight: 650, fit: PW - 28 });
  const sy = y + 150, hx = x + PW / 2 - 10;
  s += `<rect x="${x + 1}" y="${sy}" width="${PW - 2}" height="${y + PH - sy - 1}" fill="${metal ? "#dfe3ea" : "#f3e6d8"}"/>`;
  s += line(x + 1, sy, x + PW - 1, sy, { color: C.line, width: 2 });
  // Incoming and reflected.
  s += arrow(hx - 90, sy - 90, hx - 3, sy - 3, { color: C.accent, width: BOLD + 0.5 });
  s += arrow(hx, sy, hx + 90, sy - 90, { color: C.accent2, width: BOLD });
  s += label(hx + 70, sy - 98, t(v, "reflected: `kS`", "reflekteras: `kS`"), { color: C.accent2, anchor: "middle" });
  // Refracted: into the material.
  const path = metal
    ? [[hx, sy], [hx + 20, sy + 40], [hx + 6, sy + 70]]
    : [[hx, sy], [hx + 22, sy + 34], [hx - 6, sy + 58], [hx - 40, sy + 40], [hx - 62, sy + 18], [hx - 74, sy]];
  s += polyline(path, { color: C.y, width: 2, dash: "5 4" });
  if (metal) {
    s += `<circle cx="${hx + 6}" cy="${sy + 70}" r="7" fill="${C.ink}"/>`;
    s += label(hx + 22, sy + 74, t(v, "absorbed", "absorberas"), { color: C.ink });
  } else {
    s += arrow(hx - 74, sy, hx - 120, sy - 56, { color: C.y, width: 2 });
    s += label(hx - 120, sy - 76, t(v, "diffuse", "diffust"), { color: C.y, anchor: "middle" });
  }
  s += label(x + 14, y + PH - 24, t(v, "refracted: `kD = 1.0 - kS`", "bryts: `kD = 1.0 - kS`"), { color: C.y, fit: PW - 28 });
  return s;
}

export function draw(v) {
  return svg(height, scene(PAD, false, v) + scene(PAD + PW + GAP, true, v));
}
