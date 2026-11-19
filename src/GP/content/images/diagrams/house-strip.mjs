// Geometry shader, "Let's build houses": the five vertices the geometry shader emits around a point, as offsets from it,
// in the order of the triangle strip – (1, 2, 3) and (2, 3, 4) are the wall, (3, 4, 5) the roof. Vulkan's y points
// down, so its offsets have the opposite sign in y; the house looks the same. Language-free.
import { C, PAD, W, badge, dot, svg, text } from "./style.mjs";
import { LBL, SML, poly } from "./_advgl.mjs";

export const variants = [
  { out: "house-strip-opengl-d3d12.webp", lang: "en", ydown: false },
  { out: "house-strip-vulkan.webp", lang: "en", ydown: true },
];

const U = 520; // px per unit of NDC
const CX = W / 2, CY = PAD + 0.4 * U + 56;
export const height = CY + 0.2 * U + 56;

export function draw(v) {
  let s = "";
  const off = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0.4]]; // y up
  const p = off.map(([x, y]) => [CX + x * U, CY - y * U]);
  const fills = [C.accentSoft, C.accent2Soft, C.ySoft];
  const strokes = [C.accent, C.accent2, C.y];
  for (let i = 0; i < 3; i++) s += poly([p[i], p[i + 1], p[i + 2]], { close: true, fill: fills[i], color: strokes[i], width: 2 });
  // The strip's order.
  s += poly(p, { color: C.ink, width: 1.5, dash: "6 5" });
  s += dot(CX, CY, { r: 6 });
  s += text(CX - 14, CY + 22, "(0, 0)", { anchor: "end", mono: true, size: SML, color: C.muted });
  const fmt = (n) => (n === 0 ? "0.0" : (n < 0 ? "−" : "") + Math.abs(n).toFixed(1));
  const labels = off.map(([x, y]) => `(${fmt(x)}, ${fmt(v.ydown ? -y : y)})`);
  const place = [[-18, 14, "end"], [18, 14, "start"], [-18, 0, "end"], [18, 0, "start"], [0, -30, "middle"]];
  p.forEach(([x, y], i) => {
    s += badge(x + (i === 4 ? 0 : i % 2 ? 0 : 0), y, i + 1, { r: 13, color: C.ink });
    const [dx, dy, anchor] = place[i];
    s += text(x + dx + (anchor === "end" ? -10 : anchor === "start" ? 10 : 0), y + dy + (i === 4 ? -6 : 0), labels[i], { mono: true, size: LBL, anchor, weight: 600 });
  });
  return svg(height, s);
}
