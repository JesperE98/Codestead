// Text processing: how awk splits a line into fields – a line of the practice log (the simulator's server.log, the
// same in every language) with $0, $1 … $6, $NF and NF marked; two spaces after INFO are still one separator. No words.
import { C, FS, MONO, PAD, W, code, esc, shared, svg } from "./style.mjs";
import { chip } from "./_admin.mjs";

export const variants = shared("awk-fields");

export const terminals = { log: { commands: ["grep index.html {{documents}}/server.log"] } };

const CW = FS * 0.6;
const LINE_Y = PAD + 66;
const X0 = PAD + 22;
export const height = LINE_Y + 96 + PAD;
const COLORS = [C.z, C.y, C.accent, C.accent2, C.x, C.z];

export function draw(v, R) {
  const line = R.log.lines[0].output[0].map((r) => r.text).join("");
  const fields = [...line.matchAll(/\S+/g)].map((m) => ({ text: m[0], at: m.index }));
  if (fields.length !== 6) throw new Error(`expected 6 fields in ${line}`);
  let s = "";
  const x = (col) => X0 + col * CW;
  const end = x(line.length);
  // $0: the whole line.
  s += `<path d="M${x(0)},${LINE_Y - 22} v-8 H${end} v8" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  s += code((x(0) + end) / 2, LINE_Y - 46, "$0", { anchor: "middle", weight: 800 });
  // The line, each field on its colour.
  s += `<rect x="${X0 - 12}" y="${LINE_Y - 20}" width="${end - X0 + 24}" height="40" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  fields.forEach((f, i) => {
    s += `<rect x="${x(f.at) - 2}" y="${LINE_Y - 15}" width="${f.text.length * CW + 4}" height="30" rx="4" fill="${COLORS[i]}" opacity="0.18"/>`;
  });
  s += `<text x="${X0}" y="${LINE_Y}" font-size="${FS}" font-weight="500" fill="${C.ink}" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(line)}</text>`;
  // The spaces between the fields: separators, however many there are.
  fields.slice(1).forEach((f, i) => {
    const a = x(fields[i].at + fields[i].text.length), b = x(f.at);
    s += `<path d="M${a + 2},${LINE_Y + 12} v4 H${b - 2} v-4" fill="none" stroke="${C.line}" stroke-width="1.5"/>`;
  });
  // $1 … $6 under the fields, and $NF under the last one.
  fields.forEach((f, i) => {
    const cx = x(f.at + f.text.length / 2);
    s += `<line x1="${cx}" y1="${LINE_Y + 22}" x2="${cx}" y2="${LINE_Y + 36}" stroke="${COLORS[i]}" stroke-width="2"/>`;
    s += code(cx, LINE_Y + 50, `$${i + 1}`, { anchor: "middle", weight: 800, color: COLORS[i] });
  });
  const last = fields.at(-1);
  s += code(x(last.at + last.text.length / 2), LINE_Y + 80, "$NF", { anchor: "middle", weight: 800, color: COLORS[5] });
  s += chip(W - PAD - 6, LINE_Y + 50, `NF = ${fields.length}`, { anchor: "end", style: "z" });
  return svg(height, s);
}
