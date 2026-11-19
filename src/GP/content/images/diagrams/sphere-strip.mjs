// PBR Lighting, "Your program": the UV sphere's index order on a small grid – 4 segments across, 2 rows (the course's
// sphere has 24 × 24). The even row is walked from left to right, the odd one back from right to left, each column
// giving two indices, one in the row and one in the next; every index after the first two makes a triangle with the
// two before it. The numbers are the vertices' indices, y · 5 + x.
import { C, PAD, W, dot, perLanguage, svg, t, text } from "./style.mjs";
import { label, poly, polyline } from "./_advlight.mjs";

export const variants = perLanguage("sphere-strip");

const XS = 4, YS = 2;
export const height = PAD + 40 + YS * 110 + 70 + PAD;

export function draw(v) {
  const gx = PAD + 70, gy = PAD + 46, dx = 128, dy = 110;
  const P = (x, y) => [gx + x * dx, gy + y * dy];
  const idx = [];
  for (let y = 0; y < YS; y++) {
    if (y % 2 === 0) for (let x = 0; x <= XS; x++) idx.push([x, y], [x, y + 1]);
    else for (let x = XS; x >= 0; x--) idx.push([x, y + 1], [x, y]);
  }
  let s = "";
  // The triangles, shaded in turn (the degenerate ones between the rows have no area).
  for (let i = 2; i < idx.length; i++) {
    const tri = [idx[i - 2], idx[i - 1], idx[i]].map(([x, y]) => P(x, y));
    s += poly(tri, { fill: i % 2 === 0 ? C.accentSoft : C.zSoft, color: C.boxStroke, width: 1 });
  }
  // The strip's path.
  s += polyline(idx.map(([x, y]) => P(x, y)), { color: C.accent, width: 2.5 });
  for (let y = 0; y <= YS; y++)
    for (let x = 0; x <= XS; x++) {
      const [px, py] = P(x, y);
      s += dot(px, py, { r: 5 });
      s += `<circle cx="${px + 16}" cy="${py - 16}" r="15" fill="#fff" stroke="${C.boxStroke}"/>`;
      s += text(px + 18, py - 18, String(y * (XS + 1) + x), { size: 19, weight: 700, anchor: "middle" });
    }
  // Row directions.
  const [r0x, r0y] = P(0, 0.5), [r1x, r1y] = P(XS, 1.5);
  s += text(r0x - 40, r0y, "→", { color: C.accent, size: 26, weight: 700, anchor: "middle" });
  s += text(r1x + 40, r1y, "←", { color: C.accent, size: 26, weight: 700, anchor: "middle" });
  // The index sequence.
  const seq = idx.map(([x, y]) => y * (XS + 1) + x);
  const half = seq.length / 2;
  const sy = gy + YS * dy + 34;
  s += label(PAD, sy, t(v, "even row:", "jämn rad:"), { color: C.muted });
  s += text(PAD + 130, sy, seq.slice(0, half).join(" "), { size: 19, mono: true, weight: 600 });
  s += label(PAD, sy + 30, t(v, "odd row:", "udda rad:"), { color: C.muted });
  s += text(PAD + 130, sy + 30, seq.slice(half).join(" "), { size: 19, mono: true, weight: 600 });
  return svg(height, s);
}
