// Redirection and pipes: the chapter's pipeline sort | uniq -c | sort -rn on the learner's fruit list, with what each
// step passes on to the next (the simulator's output after each step, in the learner's language). No words.
import { C, FS, PAD, W, code, perLanguage, svg, textWidth, world } from "./style.mjs";
import { STREAM, pipe } from "./_pipes.mjs";

export const variants = perLanguage("pipeline");

const steps = (n) => [`sort ${n.documents}/${n.fruits}`, "uniq -c", "sort -rn"];

export function terminals(v) {
  const n = world(v.lang).names;
  const [a, b, c] = steps(n);
  return { steps: { commands: [a, `${a} | ${b}`, `${a} | ${b} | ${c}`] } };
}

const ROW = 28;
const STRIP_Y = PAD + 22;
const COL_Y = STRIP_Y + 92;
const GAP = 56;
const COL = (W - 2 * PAD - 2 * GAP) / 3;
export const height = COL_Y + 10 * ROW + 8 + PAD;

export function draw(v, R) {
  const n = world(v.lang).names;
  const parts = steps(n);
  const line = parts.join(" | ");
  const outputs = R.steps.lines.map((l) => {
    const rows = l.output.map((row) => row.map((r) => r.text).join(""));
    const indent = Math.min(...rows.map((r) => r.length - r.trimStart().length));
    return rows.map((r) => r.slice(indent));
  });
  let s = "";
  // The whole command line, with a bracket under each command.
  const lineW = textWidth(line, FS, true) + 28;
  const lx = (W - lineW) / 2;
  s += `<rect x="${lx}" y="${STRIP_Y - 21}" width="${lineW}" height="42" rx="6" fill="#0f1318"/>` + code(lx + 14, STRIP_Y, line, { color: "#e6edf3" });
  const colX = (i) => PAD + i * (COL + GAP);
  let at = 0;
  parts.forEach((p, i) => {
    const a = lx + 14 + textWidth(line.slice(0, at), FS, true), b = a + textWidth(p, FS, true);
    at += p.length + 3;
    const mid = (a + b) / 2, cx = colX(i) + COL / 2;
    s += `<path d="M${a},${STRIP_Y + 26} v6 H${b} v-6" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<path d="M${mid},${STRIP_Y + 32} C${mid},${STRIP_Y + 56} ${cx},${STRIP_Y + 50} ${cx},${COL_Y - 14}" fill="none" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  });
  // Each step's output, and the pipe that carries it to the next step's stdin.
  outputs.forEach((rows, i) => {
    const x = colX(i);
    s += `<rect x="${x}" y="${COL_Y - 8}" width="${COL}" height="${rows.length * ROW + 16}" rx="6" fill="#0f1318"/>`;
    rows.forEach((r, j) => {
      const m = /^(\d+)( +)(.*)$/.exec(r);
      const y = COL_Y + j * ROW + ROW / 2;
      if (m === null) s += code(x + 14, y, r, { color: "#e6edf3", fit: COL - 24 });
      else s += code(x + 14, y, m[1], { color: "#e3b341", weight: 700 }) + code(x + 14 + textWidth(m[1] + m[2], FS, true), y, m[3], { color: "#e6edf3" });
    });
    if (i < 2) {
      const py = COL_Y + 40;
      s += pipe(`M${x + COL + 4},${py} H${x + COL + GAP - 4}`, 1, x + COL + GAP - 4, py, 1, 0);
      s += code(x + COL + GAP / 2, py - 24, "|", { anchor: "middle", weight: 800, color: STREAM[1], size: FS + 6 });
    }
  });
  return svg(height, s);
}
