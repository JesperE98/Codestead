// Text Rendering, the glyph metrics: 'X' and 'p' of the course's font (Inter Bold) as FreeType renders them at 48 pixels
// – the simulator's own glyph table –, enlarged five times, each bitmap with its box, on the baseline, with the
// metrics of the chapter's table at the 'p'.
import { C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { code, glyph, glyphUrl, label, pixelImage } from "./_practice.mjs";

export const variants = perLanguage("glyph-metrics");
export const height = 430;

const K = 5; // pixels of the drawing per glyph pixel
const BASE = 250; // the baseline
const O1 = 130; // the first glyph's origin

function bitmap(g, ox) {
  const x = ox + g.left * K, y = BASE - g.top * K, w = g.width * K, h = g.rows * K;
  return { x, y, w, h, s: pixelImage(glyphUrl(g), x, y, w, h) + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="5 4"/>` };
}

const dim = (x1, y1, x2, y2, color = C.accent) => arrow(x1, y1, x2, y2, { color, width: 2, both: true });
const ext = (x1, y1, x2, y2) => line(x1, y1, x2, y2, { color: C.accent, width: 1.2, dash: "3 3" });

export function draw(v) {
  const X = glyph(48, "X"), P = glyph(48, "p");
  const O2 = O1 + (X.advance >> 6) * K, O3 = O2 + (P.advance >> 6) * K;
  const bx = bitmap(X, O1), bp = bitmap(P, O2);
  let s = line(PAD + 10, BASE, W - PAD - 10, BASE, { color: C.ink, width: 1.5 });
  s += label(PAD + 10, BASE - 16, t(v, "baseline", "baslinjen"), { color: C.muted });
  s += bx.s + bp.s;
  for (const o of [O1, O2, O3]) s += dot(o, BASE, { r: 5, color: C.accent2 });
  s += label(O1 - 12, BASE + 20, t(v, "origin", "origo"), { color: C.accent2, anchor: "end" });
  // width, above the p
  s += ext(bp.x, bp.y - 4, bp.x, bp.y - 30) + ext(bp.x + bp.w, bp.y - 4, bp.x + bp.w, bp.y - 30);
  s += dim(bp.x, bp.y - 22, bp.x + bp.w, bp.y - 22);
  s += code(bp.x + bp.w / 2, bp.y - 44, "width", { anchor: "middle", color: C.accent, weight: 600 });
  // height, to its right
  const hx = bp.x + bp.w + 22;
  s += ext(bp.x + bp.w + 4, bp.y, hx + 8, bp.y) + ext(bp.x + bp.w + 4, bp.y + bp.h, hx + 8, bp.y + bp.h);
  s += dim(hx, bp.y, hx, bp.y + bp.h);
  s += code(hx + 12, BASE + 26, "height", { color: C.accent, weight: 600 });
  // bearingY, further right: from the baseline to the bitmap's top
  const by = hx + 110;
  s += ext(hx + 10, bp.y, by + 8, bp.y);
  s += dim(by, BASE, by, bp.y);
  s += code(by + 12, (BASE + bp.y) / 2, "bearingY", { color: C.accent, weight: 600 });
  // bearingX, below: from the origin to the bitmap's left edge (too short for arrows between the lines: from outside)
  const yb = bp.y + bp.h + 26;
  s += ext(O2, BASE + 8, O2, yb + 10) + ext(bp.x, bp.y + bp.h + 4, bp.x, yb + 10);
  s += arrow(O2 - 34, yb, O2, yb, { color: C.accent, width: 2 }) + arrow(bp.x + 34, yb, bp.x, yb, { color: C.accent, width: 2 });
  s += code(bp.x + 44, yb, "bearingX", { color: C.accent, weight: 600 });
  // advance: origin to origin, under both glyphs
  const ya = yb + 46;
  for (const [a, b] of [[O1, O2], [O2, O3]]) {
    s += ext(b, BASE + 8, b, ya + 10);
    s += dim(a + 3, ya, b - 3, ya, C.accent2);
    s += code((a + b) / 2, ya + 24, "advance", { anchor: "middle", color: C.accent2, weight: 600 });
  }
  s += ext(O1, BASE + 34, O1, ya + 10);
  return svg(height, s);
}
