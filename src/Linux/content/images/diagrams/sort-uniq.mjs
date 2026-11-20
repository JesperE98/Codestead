// Reading text: why uniq comes after sort. The learner's fruit list (the simulator's, in their language) in the middle;
// uniq alone (to the left) removes nothing, because equal lines are not next to each other; sort (to the right) puts
// them together, and uniq then keeps one of each. The same fruit has the same colour everywhere. No words.
import { C, PAD, W, arrow, code, perLanguage, svg, world } from "./style.mjs";

export const variants = perLanguage("sort-uniq");

export const terminals = {
  fruits: { commands: ["cat {{documents}}/{{fruits}}", "uniq {{documents}}/{{fruits}}", "sort {{documents}}/{{fruits}}", "sort {{documents}}/{{fruits}} | uniq"] },
};

const ROW = 32;
const GAP = 34;
const COL = (W - 2 * PAD - 3 * GAP) / 4;
const TOP = PAD + 92;
export const height = TOP + 10 * ROW + PAD - 4;
const COLORS = [
  [C.xSoft, C.x],
  [C.ySoft, C.y],
  [C.zSoft, C.z],
  [C.accentSoft, C.accent],
  [C.accent2Soft, C.accent2],
  ["#fdf3c4", "#b88a00"],
];

export function draw(v, R) {
  const [file, uniq, sorted, unique] = R.fruits.lines.map((l) => l.output.map((row) => row.map((r) => r.text).join("")));
  const colour = new Map();
  for (const f of file) if (!colour.has(f)) colour.set(f, COLORS[colour.size % COLORS.length]);
  const x = (i) => PAD + i * (COL + GAP);
  let s = "";
  const column = (i, list) => {
    let c = "";
    list.forEach((f, r) => {
      const [fill, stroke] = colour.get(f) ?? ["#ffffff", C.boxStroke];
      const y = TOP + r * ROW;
      c += `<rect x="${x(i) + 4}" y="${y + 2}" width="${COL - 8}" height="${ROW - 5}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
      c += code(x(i) + COL / 2, y + ROW / 2, f, { anchor: "middle", weight: 600, color: C.ink, fit: COL - 14 });
    });
    return c;
  };
  // The columns: uniq alone | the file | sorted | sorted, then uniq.
  s += column(0, uniq) + column(1, file) + column(2, sorted) + column(3, unique);
  s += `<rect x="${x(1) - 2}" y="${TOP - 4}" width="${COL + 4}" height="${file.length * ROW + 6}" rx="7" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += code(x(1) + COL / 2, PAD + 16, world(v.lang).names.fruits, { anchor: "middle", weight: 700, color: C.muted, fit: COL + 20 });
  // The commands, on arrows between the columns' tops.
  const arrowY = PAD + 74;
  const step = (from, to, cmd, color) =>
    arrow(from, arrowY, to, arrowY, { color, width: 2.5 }) + code((from + to) / 2, arrowY - 22, cmd, { anchor: "middle", weight: 700, color });
  s += step(x(1) + 10, x(0) + COL - 10, "uniq", C.bad);
  s += step(x(1) + COL - 10, x(2) + 10, "sort", C.z);
  s += step(x(2) + COL - 10, x(3) + 10, "uniq", C.good);
  return svg(height, s);
}
