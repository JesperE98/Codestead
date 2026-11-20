// Reading text: how cut splits the learner's CSV file (the simulator's, in their language) into fields at the commas
// (-d,) and keeps field 2 (-f2). In Arabic the lines run right to left, as the terminal shows them, so field 1 is on
// the right. No words.
import { C, FS, PAD, W, arrow, code, isRtl, perLanguage, svg, textWidth } from "./style.mjs";

export const variants = perLanguage("cut-fields");

export const terminals = { cut: { commands: ["cat {{documents}}/{{grades}}", "cut -d, -f2 {{documents}}/{{grades}}"] } };

const ROW = 32;
const TOP = PAD + 44;
const COMMA = 22;
export const height = (v, R) => TOP + R.cut.lines[0].output.length * ROW + PAD;

export function draw(v, R) {
  const [rows, cut] = R.cut.lines.map((l) => l.output.map((row) => row.map((r) => r.text).join("")));
  const fields = rows.map((r) => r.split(","));
  const widths = [0, 1, 2].map((f) => Math.max(...fields.map((r) => textWidth(r[f], FS, true))) + 22);
  const outW = Math.max(textWidth("cut -d, -f2", FS, true), ...cut.map((c) => textWidth(c, FS, true))) + 28;
  const gridW = widths[0] + widths[1] + widths[2] + 2 * COMMA;
  const total = gridW + 70 + outW;
  const x0 = (W - total) / 2;
  // The order the fields are seen in: left to right, or right to left in Arabic.
  const order = isRtl(v) ? [2, 1, 0] : [0, 1, 2];
  const colX = [];
  let x = x0;
  order.forEach((f, i) => {
    colX[f] = x;
    x += widths[f] + (i < 2 ? COMMA : 0);
  });
  let s = "";
  // Field 2, the one cut keeps.
  s += `<rect x="${colX[1] - 2}" y="${TOP - 4}" width="${widths[1] + 4}" height="${rows.length * ROW + 6}" rx="6" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="1.5"/>`;
  fields.forEach((r, i) => {
    const y = TOP + i * ROW + ROW / 2;
    r.forEach((text, f) => (s += code(colX[f] + widths[f] / 2, y, text, { anchor: "middle", color: f === 1 ? C.ink : C.muted, weight: f === 1 ? 650 : 500 })));
    // The commas between the fields.
    for (const f of [0, 1]) {
      const between = isRtl(v) ? colX[f] - COMMA / 2 : colX[f] + widths[f] + COMMA / 2;
      s += code(between, y, ",", { anchor: "middle", color: C.accent, weight: 800 });
    }
  });
  // -f1 -f2 -f3 over the fields, -d, over a comma.
  for (const f of [0, 1, 2]) s += code(colX[f] + widths[f] / 2, PAD + 14, `-f${f + 1}`, { anchor: "middle", weight: 700, color: f === 1 ? C.accent2 : C.line });
  const comma = isRtl(v) ? colX[0] - COMMA / 2 : colX[0] + widths[0] + COMMA / 2;
  s += `<line x1="${comma}" y1="${PAD + 26}" x2="${comma}" y2="${TOP + 4}" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  s += `<rect x="${comma - 22}" y="${PAD - 1}" width="44" height="30" rx="5" fill="#ffffff" stroke="${C.accent}"/>` + code(comma, PAD + 14, "-d,", { anchor: "middle", weight: 700, color: C.accent });
  // What cut prints.
  const ox = x0 + gridW + 70;
  const midY = TOP + (rows.length * ROW) / 2;
  s += arrow(x0 + gridW + 12, midY, ox - 12, midY, { color: C.accent2, width: 2.5 });
  s += `<rect x="${ox}" y="${TOP - 4}" width="${outW}" height="${rows.length * ROW + 6}" rx="6" fill="#0f1318"/>`;
  s += code(ox + outW / 2, PAD + 14, "cut -d, -f2", { anchor: "middle", weight: 700, color: C.accent2 });
  cut.forEach((c, i) => (s += code(ox + 14, TOP + i * ROW + ROW / 2, c, { color: "#e6edf3" })));
  return svg(height(v, R), s);
}
