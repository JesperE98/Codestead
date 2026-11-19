// Cubemaps, "Reflection" and "Refraction": the vectors of environment mapping at a point of a cube's surface – the view
// vector I from the camera, the normal N, and the vector R that samples the cube map: reflect(I, N) mirrors I about N,
// refract(I, N, 1.00 / 1.52) bends it into the glass (Snell's law, air to glass). The names are the same in GLSL and
// HLSL. Two pictures from one source; language-free.
import { BOLD, C, PAD, W, arrow, dot, line, svg, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = [
  { out: "cubemap-reflect.webp", lang: "en", kind: "reflect" },
  { out: "cubemap-refract.webp", lang: "en", kind: "refract" },
];

const SY = PAD + 170; // the surface
export const height = SY + 110;

export function draw(v) {
  let s = "";
  const px = W / 2 - 110, py = SY;
  // The cube below the surface, the environment as a dashed arc around everything.
  s += `<rect x="${PAD}" y="${SY}" width="${W - 2 * PAD}" height="${height - SY - PAD}" fill="${v.kind === "refract" ? C.zSoft : "#eef0f4"}"/>`;
  s += line(PAD, SY, W - PAD, SY, { color: C.ink, width: 2 });
  // I comes in from the upper left at 45°.
  const L = 150, a = Math.PI / 4;
  const ix = px - L * Math.sin(a), iy = py - L * Math.cos(a);
  s += arrow(ix, iy, px - 4, py - 4, { color: C.ink, width: BOLD });
  s += text((ix + px) / 2 - 24, (iy + py) / 2 + 14, "*I*", { size: LBL + 2, weight: 650 });
  s += arrow(px, py, px, py - 120, { color: C.y, width: BOLD });
  s += text(px + 14, py - 112, "*N*", { size: LBL + 2, weight: 650, color: C.y });
  s += line(px, py, px, py + 90, { color: C.line, width: 1, dash: "4 3" });
  if (v.kind === "reflect") {
    const rx = px + L * Math.sin(a), ry = py - L * Math.cos(a);
    s += arrow(px, py, rx, ry, { color: C.accent, width: BOLD + 0.5 });
    s += text(rx + 12, ry - 6, "*R* = `reflect(I, N)`", { size: LBL, weight: 600, color: C.accent });
  } else {
    // sin(b) = sin(a) · 1.00 / 1.52
    const b = Math.asin(Math.sin(a) / 1.52), L2 = 115;
    s += line(px, py, px + 110 * Math.sin(a), py + 110 * Math.cos(a), { color: C.line, width: 1.5, dash: "6 4" });
    const rx = px + L2 * Math.sin(b), ry = py + L2 * Math.cos(b);
    s += arrow(px, py, rx, ry, { color: C.accent, width: BOLD + 0.5 });
    s += text(px + 96, py + 62, "*R* = `refract(I, N, 1.00 / 1.52)`", { size: LBL, weight: 600, color: C.accent });
    s += text(W - PAD - 12, SY - 18, "1.00", { size: LBL, weight: 600, mono: true, anchor: "end", color: C.muted });
    s += text(W - PAD - 12, SY + 22, "1.52", { size: LBL, weight: 600, mono: true, anchor: "end", color: C.z });
  }
  s += dot(px, py, { r: 4.5 });
  return svg(height, s);
}
