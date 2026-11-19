// Basic Lighting, "One last thing": the chapter's 2D example of a non-uniform scale – a surface along (1, 1) with the
// normal (1, −1), stretched by 2 along y. The model matrix M tilts the surface to (1, 2) but turns the normal into
// (1, −2), which is no longer perpendicular; the normal matrix (M⁻¹)ᵀ gives (1, −0.5), which is. Language-free.
import { BOLD, C, PAD, W, arrow, grid, line, svg, text } from "./style.mjs";
import { L, LS } from "./_lighting.mjs";

export const variants = [{ out: "normal-matrix.webp", lang: "en" }];

const GAP = 16;
const PW = (W - 2 * PAD - 2 * GAP) / 3, PH = 214, U = 40;
export const height = PAD + PH + 76;

export function draw() {
  let s = "";
  const panels = [
    { surf: [1, 1], n: [1, -1], formula: "*n*", value: "(1, −1)", color: C.y, ok: true },
    { surf: [1, 2], n: [1, -2], formula: "*M* *n*", value: "(1, −2)", color: C.bad, ok: false },
    { surf: [1, 2], n: [1, -0.5], formula: "(*M*^{−1})^{T} *n*", value: "(1, −0.5)", color: C.y, ok: true },
  ];
  panels.forEach((p, i) => {
    const x = PAD + i * (PW + GAP), y = PAD;
    const ox = x + PW / 2, oy = y + PH / 2;
    s += `<rect x="${x}" y="${y}" width="${PW}" height="${PH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += grid(x + PW / 2 - 2.5 * U, y + 7, 5 * U, PH - 14, U / 2);
    s += line(x + 8, oy, x + PW - 8, oy, { color: C.line, width: 1 });
    s += line(ox, y + 6, ox, y + PH - 6, { color: C.line, width: 1 });
    const k = 1.1 / Math.max(...p.surf.map(Math.abs)) * (p.surf[1] === 2 ? 1.3 : 1.45);
    const [sx, sy] = p.surf;
    s += line(ox - sx * k * U, oy + sy * k * U, ox + sx * k * U, oy - sy * k * U, { color: C.ink, width: 4 });
    // The normal from the middle of the surface.
    const [nx, ny] = p.n;
    const tx = ox + nx * U * 1.25, ty = oy - ny * U * 1.25;
    s += arrow(ox, oy, tx, ty, { color: p.color, width: BOLD + 0.5 });
    if (p.ok) {
      // A right-angle mark between the surface and the normal.
      const a = Math.hypot(sx, sy), b = Math.hypot(nx, ny), m = 13;
      const ux = sx / a, uy = -sy / a, vx = nx / b, vy = -ny / b;
      s += `<path d="M${ox + ux * m},${oy + uy * m} L${ox + (ux + vx) * m},${oy + (uy + vy) * m} L${ox + vx * m},${oy + vy * m}" fill="none" stroke="${C.muted}" stroke-width="1.5"/>`;
    }
    s += text(x + PW / 2, y + PH + 24, p.formula, { size: L, weight: 650, anchor: "middle", color: p.color === C.bad ? C.bad : C.ink });
    s += text(x + PW / 2, y + PH + 54, `${p.value} ${p.ok ? "✓" : "✗"}`, { size: LS, anchor: "middle", mono: true, weight: 600, color: p.ok ? C.good : C.bad });
    if (i > 0) s += text(x + 12, y + 20, "×2 ↕", { size: LS, weight: 650, color: C.muted });
  });
  return svg(height, s);
}
