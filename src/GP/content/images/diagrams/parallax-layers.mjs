// Parallax Mapping, "Steep Parallax Mapping" and "Parallax Occlusion Mapping": the same cross-section, divided into
// layers. Steep parallax mapping walks along the ray one layer deeper per step and stops at the first step below the
// surface (orange) – the depth is rounded to a layer. Parallax occlusion mapping also keeps the step before (purple)
// and interpolates between the two where the difference to the depth map crosses zero (green).
import { BOLD, C, PAD, W, dot, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";
import { depth, section } from "./_parallax.mjs";

export const variants = perLanguage("parallax-layers");

const PH = 236, GAP = 16;
export const height = PAD + 2 * PH + GAP + PAD;
const LAYERS = 8;

function scene(y, occlusion, v) {
  let s = panel(PAD, y, W - 2 * PAD, PH);
  s += label(PAD + 16, y + 24, occlusion ? t(v, "Parallax occlusion mapping", "Parallax occlusion mapping") : t(v, "Steep parallax mapping: 8 layers", "Steep parallax mapping: 8 lager"), { size: 21, weight: 650 });
  const sx = PAD + 30, sw = W - 2 * PAD - 60, sy = y + 70, sh = 130;
  const sec = section(sx, sy, sw, sh);
  // The layers.
  for (let i = 1; i <= LAYERS; i++) s += line(sx, sec.Y(i / LAYERS), sx + sw, sec.Y(i / LAYERS), { color: C.grid, width: 1 });
  s += sec.solid + sec.quad;
  // The ray: from A (u = 0.62) down and to the left.
  const uA = 0.66, slope = 0.34;
  const rayU = (d) => uA - slope * d;
  s += line(sec.X(rayU(-0.35)), sec.Y(-0.35), sec.X(rayU(1)), sec.Y(1), { color: C.z, width: 1.5, dash: "5 4" });
  // The steps.
  let k = 0;
  while (k < LAYERS && k / LAYERS < depth(rayU(k / LAYERS))) k++;
  for (let i = 0; i < k; i++) s += dot(sec.X(rayU(i / LAYERS)), sec.Y(i / LAYERS), { r: 4.5, color: C.z });
  const [cx, cy] = [sec.X(rayU(k / LAYERS)), sec.Y(k / LAYERS)];
  const [qx, qy] = [sec.X(rayU((k - 1) / LAYERS)), sec.Y((k - 1) / LAYERS)];
  if (!occlusion) {
    s += dot(cx, cy, { r: 7, color: C.accent });
    s += line(cx, cy, cx, sec.Y(0), { color: C.accent, width: 1.5, dash: "3 3" });
    s += dot(cx, sec.Y(0), { r: 5, color: C.accent });
    s += label(cx - 14, cy + 40, t(v, "first step below the surface", "första steget under ytan"), { color: C.accent, anchor: "end" });
  } else {
    // Where afterDepth and beforeDepth interpolate to zero.
    const after = depth(rayU(k / LAYERS)) - k / LAYERS, before = depth(rayU((k - 1) / LAYERS)) - (k - 1) / LAYERS;
    const w = after / (after - before);
    const d = (k - w) / LAYERS;
    const [ix, iy] = [sec.X(rayU(d)), sec.Y(d)];
    s += dot(qx, qy, { r: 7, color: C.accent2 }) + dot(cx, cy, { r: 7, color: C.accent });
    s += line(ix, iy, ix, sec.Y(0), { color: C.good, width: 1.5, dash: "3 3" });
    s += dot(ix, iy, { r: 7, color: C.good }) + dot(ix, sec.Y(0), { r: 5, color: C.good });
    s += label(qx + 16, qy + 12, t(v, "before", "före"), { color: C.accent2 });
    s += label(cx + 4, cy + 30, t(v, "after", "efter"), { color: C.accent });
    s += label(ix - 16, iy + 4, t(v, "interpolated", "interpolerat"), { color: C.good, anchor: "end" });
  }
  void BOLD;
  return s;
}

export function draw(v) {
  return svg(height, scene(PAD, false, v) + scene(PAD + PH + GAP, true, v));
}
