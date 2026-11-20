// Reading text: which lines of the practice log head, tail and grep pick – the log as the simulator has it (the same in
// every language: programs write English), cut to fit, with head -n 5, tail -n 3 and grep WARN marked. No words.
import { C, FS, PAD, W, code, shared, svg } from "./style.mjs";

export const variants = shared("log-lines");

export const terminals = {
  log: { commands: ["cat -n {{documents}}/server.log", "head -n 5 {{documents}}/server.log", "tail -n 3 {{documents}}/server.log", "grep WARN {{documents}}/server.log"] },
};

const ROW = 27;
const CUT = 37; // characters of a line that are shown
const TEXT_X = PAD + 50;
export const height = (v, R) => PAD + 12 + R.log.lines[0].output.length * ROW + 12 + PAD;

export function draw(v, R) {
  const text = (rows) => rows.map((row) => row.map((r) => r.text).join(""));
  const [all, head, tail, grep] = R.log.lines.map((l) => text(l.output));
  const lines = all.map((l) => l.replace(/^\s*\d+\t/, ""));
  const rowOf = (line) => lines.indexOf(line);
  const top = PAD + 12;
  const y = (i) => top + i * ROW + ROW / 2;
  const right = TEXT_X + CUT * FS * 0.6 + 12;
  let s = `<rect x="${PAD}" y="${PAD}" width="${right - PAD + 4}" height="${lines.length * ROW + 24}" rx="6" fill="#ffffff" stroke="${C.boxStroke}"/>`;
  // grep's lines: a purple band.
  for (const l of grep) s += `<rect x="${TEXT_X - 6}" y="${y(rowOf(l)) - ROW / 2 + 2}" width="${right - TEXT_X}" height="${ROW - 4}" rx="4" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="1.2"/>`;
  lines.forEach((l, i) => {
    s += code(TEXT_X - 14, y(i), String(i + 1), { anchor: "end", color: C.line });
    s += code(TEXT_X, y(i), l.length > CUT ? l.slice(0, CUT - 1) + "…" : l, { color: C.ink });
  });
  // head and tail: a bracket over their lines with the command.
  const bracket = (rows, cmd, color) => {
    const a = y(rowOf(rows[0])) - ROW / 2 + 3, b = y(rowOf(rows.at(-1))) + ROW / 2 - 3;
    const x = right + 14;
    return `<path d="M${x},${a} h8 V${b} h-8" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` +
      code(x + 18, (a + b) / 2, cmd, { color, weight: 700 });
  };
  s += bracket(head, "head -n 5", C.accent);
  s += bracket(tail, "tail -n 3", C.z);
  // grep: its name beside its last line, in the band's colour.
  const g = y(rowOf(grep.at(-1)));
  const gx = right + 14;
  s += `<path d="M${right - 2},${g} H${gx + 8}" stroke="${C.accent2}" stroke-width="2"/>`;
  s += `<rect x="${gx + 10}" y="${g - 16}" width="${"grep WARN".length * FS * 0.6 + 16}" height="32" rx="6" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="1.2"/>`;
  s += code(gx + 18, g, "grep WARN", { color: C.accent2, weight: 700 });
  return svg(height(v, R), s);
}
