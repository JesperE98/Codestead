// Parallax Mapping, "Parallax mapping": a cross-section of the brick surface the depth map describes, below the flat
// quad. The eye looks at the fragment A; a real relief would let the ray go on to B. Parallax mapping takes the depth
// at A, follows the ray down to that depth and uses the texture coordinates there (the offset P along the surface,
// viewDir.xy / viewDir.z · depth): close to B, not exactly B.
import { BOLD, C, PAD, W, arrow, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";
import { depth, section } from "./_parallax.mjs";

export const variants = perLanguage("parallax-offset");

const PH = 290;
export const height = PAD + PH + PAD;

export function draw(v) {
  let s = panel(PAD, PAD, W - 2 * PAD, PH);
  const sx = PAD + 30, sw = W - 2 * PAD - 60, sy = PAD + 120, sh = 120;
  const sec = section(sx, sy, sw, sh);
  s += sec.solid + sec.quad;
  // The view ray: from the upper right, through A (u = 0.5, above the joint), down and to the left.
  const uA = 0.5, slope = 0.32; // u per unit of depth
  const rayU = (d) => uA - slope * d * (sh / sw) * 2.2;
  // B: where the ray meets the depth map.
  let dB = 0;
  for (let d = 0; d <= 1; d += 0.001) if (d >= depth(rayU(d))) { dB = d; break; }
  const dA = depth(uA);
  const [ax, ay] = [sec.X(uA), sec.Y(0)], [bx, by] = [sec.X(rayU(dB)), sec.Y(dB)];
  const [px, py] = [sec.X(rayU(dA)), sec.Y(dA)];
  const ex = ax + (ax - bx) * 1.25, ey = ay - (by - ay) * 1.25; // the eye
  s += line(ex, ey, ax, ay, { color: C.z, width: 1.5, dash: "5 4" });
  s += line(ax, ay, px, py, { color: C.z, width: 1.5, dash: "5 4" });
  s += arrow(ax, ay, ax + (ex - ax) * 0.55, ay + (ey - ay) * 0.55, { color: C.z, width: BOLD });
  s += text(ax + (ex - ax) * 0.55 + 10, ay + (ey - ay) * 0.55 + 14, "viewDir", { size: 19, mono: true, color: C.z, weight: 600 });
  s += `<path d="M${ex - 16},${ey} Q${ex},${ey - 12} ${ex + 16},${ey} Q${ex},${ey + 12} ${ex - 16},${ey} Z" fill="#fff" stroke="${C.z}" stroke-width="2"/><circle cx="${ex}" cy="${ey}" r="5" fill="${C.z}"/>`;
  // The depth at A, and the point of the ray at that depth.
  s += line(ax, ay, ax, py, { color: C.muted, width: 1.5, dash: "3 3" });
  s += line(px, py, ax, py, { color: C.muted, width: 1.5, dash: "3 3" });
  s += text(ax + 8, (ay + py) / 2, t(v, "depth at A", "djup vid A"), { size: 19, weight: 600, color: C.muted });
  s += line(px, py, px, ay, { color: C.accent2, width: 1.5, dash: "3 3" });
  // P: the offset along the quad, from A to the texture coordinates used.
  s += arrow(ax, ay - 2, px, ay - 2, { color: C.accent2, width: BOLD + 0.5 });
  s += text((ax + px) / 2, ay - 18, "*P*", { size: 22, weight: 700, anchor: "middle", color: C.accent2 });
  s += dot(px, ay, { r: 5, color: C.accent2 });
  s += dot(ax, ay, { r: 6, color: C.ink }) + text(ax + 10, ay - 16, "*A*", { size: 22, weight: 700 });
  s += dot(bx, by, { r: 6, color: C.good }) + text(bx - 12, by + 4, "*B*", { size: 22, weight: 700, anchor: "end", color: C.good });
  s += label(sx + 4, sy - 22, t(v, "the quad", "fyrhörningen"), {});
  s += label(sx + 4, sy + sh + 18, t(v, "the surface the depth map describes", "ytan som djupkartan beskriver"), { color: C.accent, fit: sw });
  void W;
  return svg(height, s);
}
