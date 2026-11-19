// Light casters, the introduction: the chapter's three light casters – a directional light (parallel rays, no
// position), a point light (rays in all directions, fading with distance) and a spotlight (a cone) – each above the
// chapter's scene lit by it, drawn by the simulator from the OpenGL program after the tasks "directional",
// "point-light" and "soft-edges".
import { C, PAD, W, arrow, line, perLanguage, svg, t, text } from "./style.mjs";
import { L, lamp, crop } from "./_lighting.mjs";

export const variants = perLanguage("light-types");
export const lossy = true;

const GAP = 14, PW = (W - 2 * PAD - 2 * GAP) / 3, DH = 118, RH = PW * 0.75;
export const height = PAD + DH + 8 + RH + 44;

const steps = ["directional", "point-light", "soft-edges"];
export const renders = Object.fromEntries(steps.map((id) => [id, { api: "opengl", chapter: "light-casters", from: `task:${id}`, width: Math.round(PW * 2) }]));

function directional(x, y) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const sx = x + 22 + i * 40, sy = y + 14;
    s += arrow(sx, sy, sx + 36, sy + 80, { color: "#c98a12", width: 2.2 });
  }
  return s + line(x + 12, y + DH - 14, x + PW - 12, y + DH - 14, { color: C.ink, width: 3 });
}

function point(x, y) {
  const cx = x + PW / 2, cy = y + DH / 2 - 4;
  let s = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.26;
    for (let k = 0; k < 3; k++) {
      const r1 = 22 + k * 15, r2 = r1 + 11;
      s += line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, { color: "#c98a12", width: 2.2, opacity: 1 - k * 0.33 });
    }
  }
  return s + lamp(cx, cy);
}

function spot(x, y) {
  const cx = x + PW / 2, cy = y + 22, h = DH - 36, w = h * Math.tan((22 * Math.PI) / 180);
  let s = `<path d="M${cx},${cy} L${cx - w},${cy + h} L${cx + w},${cy + h} Z" fill="#fde8b0" opacity="0.9"/>`;
  s += line(cx, cy, cx - w, cy + h, { color: "#c98a12", width: 1.5, dash: "5 4" }) + line(cx, cy, cx + w, cy + h, { color: "#c98a12", width: 1.5, dash: "5 4" });
  s += arrow(cx, cy, cx, cy + h - 6, { color: "#c98a12", width: 2.2 });
  s += line(x + 12, y + DH - 14, x + PW - 12, y + DH - 14, { color: C.ink, width: 3 });
  return s + lamp(cx, cy, { r: 9 });
}

export function draw(v, R) {
  const names = t(v, ["Directional light", "Point light", "Spotlight"], ["Riktat ljus", "Punktljus", "Strålkastare"]);
  let s = "";
  [directional, point, spot].forEach((f, i) => {
    const x = PAD + i * (PW + GAP);
    s += `<rect x="${x}" y="${PAD}" width="${PW}" height="${DH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += f(x, PAD);
    const r = R[steps[i]][0];
    s += crop(r, 0, 0, r.width, r.height, x, PAD + DH + 8, PW, RH);
    s += text(x + PW / 2, PAD + DH + 8 + RH + 24, names[i], { size: L, weight: 650, anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
