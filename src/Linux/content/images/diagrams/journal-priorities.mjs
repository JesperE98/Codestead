// systemd: the journal's eight priorities, and what -p err and -p warning show – the priority chosen and everything
// more severe (a lower number). Coloured as the journal shows them: err and worse red, warning yellow. No words.
// (After the question in the text: it shows the answer.)
import { C, FS, PAD, code, shared, svg } from "./style.mjs";

export const variants = shared("journal-priorities");

const LEVELS = ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"];
const ROW = 40;
const TOP = PAD + 8;
const X = PAD + 74; // the levels' column
const LW = 200;
export const height = TOP + LEVELS.length * ROW + PAD + 4;

const colorOf = (i) => (i <= 3 ? C.x : i === 4 ? "#b7791f" : C.muted);
const fillOf = (i) => (i <= 3 ? C.xSoft : i === 4 ? "#fdf1d6" : "#ffffff");
const y = (i) => TOP + i * ROW + ROW / 2;

/** A bracket over the levels from..to at x, and the command at the height of row `at`, with a line to it. */
function bracket(from, to, x, at, cmd, color) {
  const a = y(from) - ROW / 2 + 5, b = y(to) + ROW / 2 - 5;
  const ly = y(at);
  const lx = X + LW + 72;
  return `<path d="M${x},${a} h10 V${b} h-10" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M${x + 10},${ly} H${lx}" stroke="#f7f8fa" stroke-width="7"/>` +
    `<path d="M${x + 10},${ly} H${lx}" stroke="${color}" stroke-width="2.5"/>` +
    `<rect x="${lx}" y="${ly - 19}" width="${cmd.length * FS * 0.6 + 26}" height="38" rx="6" fill="#0f1318" stroke="${color}" stroke-width="2"/>` +
    code(lx + 13, ly, cmd, { color: "#e6edf3" });
}

export function draw() {
  let s = "";
  LEVELS.forEach((name, i) => {
    s += `<rect x="${X}" y="${y(i) - ROW / 2 + 3}" width="${LW}" height="${ROW - 6}" rx="6" fill="${fillOf(i)}" stroke="${colorOf(i)}" stroke-width="1.5"/>`;
    s += code(X + 18, y(i), String(i), { color: colorOf(i), weight: 800 });
    s += code(X + 54, y(i), name, { color: i <= 4 ? colorOf(i) : C.ink, weight: i <= 4 ? 700 : 500 });
  });
  // An arrow up the left side: towards the top, more severe.
  s += `<path d="M${X - 30},${y(7) + 6} V${y(0) + 6}" fill="none" stroke="${C.line}" stroke-width="2.5"/>` +
    `<path d="M${X - 30},${y(0) - 12} l-8,16 h16 z" fill="${C.line}"/>`;
  // The two commands, -p warning outside -p err.
  s += bracket(0, 4, X + LW + 40, 4, "journalctl -p warning", "#b7791f");
  s += bracket(0, 3, X + LW + 14, 1.5, "journalctl -p err", C.x);
  return svg(height, s);
}
