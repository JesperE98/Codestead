// Files and directories: what cp, mv (rename and move into a directory) and rm do to a file – before and after, with the
// chapter's own names (a.txt, b.txt and the learner's documents directory). No words, only names.
import { C, FS, PAD, W, arrow, file, folder, perLanguage, svg, textWidth, world } from "./style.mjs";

export const variants = perLanguage("file-ops");

const CHIP = 36; // a file's height
const GAP = 10;
const STRIP_W = 256; // the commands
const BEFORE_X = PAD + STRIP_W + 18;

/** The rows: the command, and the items before and after (a file, a new or changed file, a deleted one, a directory). */
function rows(dir) {
  return [
    { cmd: "cp a.txt b.txt", before: [["file", "a.txt"]], after: [["file", "a.txt"], ["new", "b.txt"]] },
    { cmd: "mv a.txt b.txt", before: [["file", "a.txt"]], after: [["new", "b.txt"]] },
    { cmd: `mv a.txt ${dir}/`, before: [["file", "a.txt"], ["dir", dir]], after: [["dir", dir, "a.txt"]] },
    { cmd: "rm a.txt", before: [["file", "a.txt"]], after: [["gone", "a.txt"]] },
  ];
}

const itemHeight = (it) => (it[0] === "dir" ? (it[2] ? 34 + CHIP + 10 : 34) : CHIP);
const stackHeight = (items) => items.reduce((h, it) => h + itemHeight(it), 0) + GAP * (items.length - 1);
const rowHeight = (r) => Math.max(stackHeight(r.before), stackHeight(r.after), 44);

export function height(v) {
  return PAD * 2 + rows(world(v.lang).names.documents).reduce((h, r) => h + rowHeight(r) + 18, -18);
}

function chip(x, y, kind, name) {
  const w = 34 + textWidth(name, FS, true) + 12;
  const [fill, stroke, ink, dash] =
    kind === "new" ? [C.accentSoft, C.accent, C.ink, ""] : kind === "gone" ? [C.card, C.line, C.line, ` stroke-dasharray="5 4"`] : ["#ffffff", C.boxStroke, C.ink, ""];
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${CHIP}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${kind === "new" ? 2 : 1.5}"${dash}/>`;
  s += file(x + 10, y + 8, kind === "gone" ? { stroke: C.line, fill: C.card } : {});
  s += `<text x="${x + 34}" y="${y + CHIP / 2}" font-size="${FS}" font-weight="600" fill="${ink}" dominant-baseline="central" font-family="'JetBrains Mono', monospace"${kind === "gone" ? ` text-decoration="line-through"` : ""}>${name}</text>`;
  if (kind === "gone") s += `<path d="M${x + w + 10},${y + 8} l20,20 M${x + w + 30},${y + 8} l-20,20" stroke="${C.bad}" stroke-width="3" stroke-linecap="round"/>`;
  return s;
}

function dirBox(x, y, name, inside) {
  const w = Math.max(34 + textWidth(name, FS, true) + 14, inside ? 34 + textWidth(inside, FS, true) + 12 + 24 : 0);
  const h = inside ? 34 + CHIP + 10 : 34;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#fff8e6" stroke="#c99a2e" stroke-width="1.5"/>`;
  s += folder(x + 8, y + 8) + `<text x="${x + 38}" y="${y + 17}" font-size="${FS}" font-weight="600" fill="${C.ink}" dominant-baseline="central" font-family="'JetBrains Mono', monospace">${name}</text>`;
  if (inside) s += chip(x + 12, y + 34, "new", inside);
  return s;
}

function stack(x, y, items) {
  let s = "";
  for (const it of items) {
    s += it[0] === "dir" ? dirBox(x, y, it[1], it[2]) : chip(x, y, it[0], it[1]);
    y += itemHeight(it) + GAP;
  }
  return s;
}

export function draw(v) {
  const dir = world(v.lang).names.documents;
  let s = "";
  let y = PAD;
  const widest = Math.max(...rows(dir).flatMap((r) => r.before.map((it) => (it[0] === "dir" ? 34 + textWidth(it[1], FS, true) + 14 : 34 + textWidth(it[1], FS, true) + 12))));
  const afterX = BEFORE_X + widest + 70;
  for (const r of rows(dir)) {
    const h = rowHeight(r);
    const mid = y + h / 2;
    s += `<rect x="${PAD}" y="${mid - 21}" width="${STRIP_W}" height="42" rx="6" fill="#0f1318"/>`;
    s += `<text x="${PAD + 14}" y="${mid}" font-size="${FS}" font-weight="500" fill="#e6edf3" dominant-baseline="central" font-family="'JetBrains Mono', monospace" style="white-space:pre" data-fit="${STRIP_W - 24}">${r.cmd}</text>`;
    s += stack(BEFORE_X, mid - stackHeight(r.before) / 2, r.before);
    s += arrow(BEFORE_X + widest + 16, mid, afterX - 16, mid, { color: C.accent, width: 2.5 });
    s += stack(afterX, mid - stackHeight(r.after) / 2, r.after);
    y += h + 18;
    if (y < height(v) - PAD) s += `<line x1="${PAD}" y1="${y - 9}" x2="${W - PAD}" y2="${y - 9}" stroke="${C.grid}" stroke-width="1"/>`;
  }
  return svg(height(v), s);
}
