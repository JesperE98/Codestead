// Archives and compression: where the names in an archive start. Packing ~/documents stores home/<user>/documents/…
// (tar removes the leading /); with -C ~ tar first changes to the home directory, and the names start at documents/.
// The simulator's output, with the part that differs marked: orange for the first way, purple for -C ~.
import { C, PAD, W, perLanguage, rowsOf, svg, terminal } from "./style.mjs";

export const variants = perLanguage("tar-paths");

export const terminals = {
  paths: {
    commands: [
      "tar -czf backup.tar.gz ~/{{documents}}",
      "tar -tzf backup.tar.gz",
      "tar -czf backup.tar.gz -C ~ {{documents}}",
      "tar -tzf backup.tar.gz",
    ],
  },
};

const termHeight = (R) => terminal(0, 0, W, R.paths.lines).height;
export const height = (v, R) => PAD + termHeight(R) + PAD;

export function draw(v, R) {
  const rows = rowsOf(R.paths.lines);
  const marks = [];
  const mark = (row, text, color) => {
    const col = rows[row].indexOf(text);
    if (col < 0) throw new Error(`no "${text}" in "${rows[row]}"`);
    marks.push({ row, col, len: text.length, color, opacity: 0.5 });
  };
  // The first way: ~/documents, and every name starting with home/<user>/.
  const first = rows.findIndex((r) => r.includes("tar -czf") && !r.includes("-C ~"));
  const second = rows.findIndex((r) => r.includes("-C ~"));
  const prefix = rows[first + 3].slice(0, rows[first + 3].indexOf("/", rows[first + 3].indexOf("/") + 1) + 1); // home/<user>/
  mark(first, rows[first].slice(rows[first].indexOf("~/")), C.accent);
  for (let i = first + 3; i < second; i++) if (rows[i].startsWith(prefix)) mark(i, prefix, C.accent);
  // The second way: -C ~, and the names starting at documents/.
  mark(second, "-C ~", C.accent2);
  for (let i = second + 2; i < rows.length; i++) mark(i, rows[i].slice(0, rows[i].indexOf("/") + 1), C.accent2);
  const t = terminal(PAD, PAD, W - 2 * PAD, R.paths.lines, { marks });
  let s = t.svg;
  // A line between the two ways.
  const y = (t.rowY(second - 1) + t.rowY(second)) / 2;
  s += `<line x1="${PAD + 10}" y1="${y}" x2="${W - PAD - 10}" y2="${y}" stroke="#30363d" stroke-width="1.5"/>`;
  return svg(height(v, R), s);
}
