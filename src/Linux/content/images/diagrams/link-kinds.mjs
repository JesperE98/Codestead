// Links and file information: names, inodes and contents. A hard link (ln) is one more name for the same inode – the
// link count goes up to 2; a symbolic link (ln -s) has an inode of its own whose contents are a name. After
// rm notes.txt the file lives on through its other name (link count 1), but the symbolic link points at a name that is
// gone. The inode numbers and link counts are the simulator's (ls -li).
import { C, FS, FS_TITLE, MONO, PAD, W, arrow, arrowPath, code, esc, file, isRtl, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { cmdStrip, mark } from "./_system.mjs";

export const variants = perLanguage("link-kinds");

export const words = {
  names: { en: "names", sv: "namn", de: "Namen", fr: "noms", es: "nombres", pt: "nomes", ru: "имена", zh: "名字", ja: "名前", ar: "الأسماء", hi: "नाम" },
  inode: { en: "inode", sv: "inod", de: "Inode", fr: "inode", es: "inodo", pt: "inode", ru: "inode", zh: "inode", ja: "inode", ar: "inode", hi: "inode" },
  contents: { en: "contents", sv: "innehåll", de: "Inhalt", fr: "contenu", es: "contenido", pt: "conteúdo", ru: "содержимое", zh: "内容", ja: "中身", ar: "المحتوى", hi: "content" },
  count: { en: "link count", sv: "antalet länkar", de: "Linkzähler", fr: "compteur de liens", es: "contador de enlaces", pt: "contador de links", ru: "счётчик ссылок", zh: "链接计数", ja: "リンク数", ar: "عدد الروابط", hi: "link count" },
};

export const terminals = {
  before: { setup: ["ln {{notes}} {{todo}}", "ln -s {{notes}} link"], commands: ["ls -li {{notes}} {{todo}} link"] },
  after: { setup: ["ln {{notes}} {{todo}}", "ln -s {{notes}} link", "rm {{notes}}"], commands: ["ls -li {{todo}} link"] },
};

const LINK = "#1b9aaa"; // ls colours a link cyan
const N0 = PAD + 38; // the names
const IX = 314, IW = 142; // the inodes
const CX = 494, CW = W - PAD - CX; // the contents
const ROW = 50;
const STRIP = 44;
const P1 = PAD + 2 * STRIP + 82; // panel 1's first row (middle)
const SEP = P1 + 2 * ROW + 54; // the line between the panels
const P2 = SEP + 102; // panel 2's first row
const LEGEND = P2 + 2 * ROW + 58;
export const height = LEGEND + 16 + PAD;

/** The rows of ls -li: { name: [inode, permissions, count] }. */
function inodes(R, id) {
  const out = {};
  for (const row of R[id].lines[0].output) {
    const m = /^(\d+) (\S+) +(\d+) +\S+ +\S+ +\d+ +\S+ +\d+ +[\d:]+ (\S+)/.exec(row.map((r) => r.text).join(""));
    if (m) out[m[4]] = [m[1], m[2], m[3]];
  }
  return out;
}

function nameChip(x, y, name, o = {}) {
  const w = 36 + textWidth(name, FS, true) + 12;
  let s = `<rect x="${x}" y="${y - 18}" width="${w}" height="36" rx="6" fill="${o.ghost ? C.card : "#ffffff"}" stroke="${o.ghost ? C.line : o.link ? LINK : C.boxStroke}" stroke-width="${o.link ? 2 : 1.5}"${o.ghost ? ` stroke-dasharray="5 4"` : ""}/>`;
  s += file(x + 10, y - 10, o.ghost ? { fill: C.card, stroke: C.line } : o.link ? { stroke: LINK } : {});
  if (o.link) s += `<path d="M${x + 14},${y + 6} q0,-7 7,-7 h3 m-3,-3 l3,3 l-3,3" fill="none" stroke="${LINK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<text x="${x + 36}" y="${y}" font-size="${FS}" font-weight="600" fill="${o.ghost ? C.line : o.link ? LINK : C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre"${o.ghost ? ` text-decoration="line-through"` : ""}>${esc(name)}</text>`;
  return { svg: s, w };
}

function inodeBox(y, [num, perms, count], color) {
  let s = `<rect x="${IX}" y="${y - 34}" width="${IW}" height="68" rx="6" fill="#ffffff" stroke="${color}" stroke-width="2"/>`;
  s += code(IX + 11, y - 15, num, { weight: 700 });
  s += code(IX + 11, y + 15, perms, { color: C.muted, weight: 600 });
  const cx = IX + IW - 22;
  s += `<circle cx="${cx}" cy="${y - 15}" r="14" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2"/>` + code(cx, y - 15, count, { anchor: "middle", weight: 800, color: C.accent });
  return s;
}

/** A text file's contents: a page with lines. */
function page(y) {
  let s = `<rect x="${CX}" y="${y - 34}" width="${CW}" height="68" rx="6" fill="#ffffff" stroke="${C.accent}" stroke-width="2"/>`;
  [0.8, 0.62, 0.72].forEach((f, i) => (s += `<rect x="${CX + 16}" y="${y - 20 + i * 15}" width="${(CW - 32) * f}" height="7" rx="3" fill="${C.grid}"/>`));
  return s;
}

function panel(v, y0, ino, notesGone) {
  const n = world(v.lang).names;
  let s = "";
  const rLink = y0, rNotes = y0 + ROW, rTodo = y0 + 2 * ROW, rA = (rNotes + rTodo) / 2;
  // The names, as the directory lists them.
  const link = nameChip(N0, rLink, "link", { link: true });
  const notes = nameChip(N0, rNotes, n.notes, { ghost: notesGone });
  const todo = nameChip(N0, rTodo, n.todo);
  s += link.svg + notes.svg + todo.svg;
  // The hard links: both names lead to the same inode, which holds the file's contents.
  if (!notesGone) s += arrow(N0 + notes.w + 6, rNotes, IX - 6, rA - 10, { color: C.accent, width: 2.5 });
  s += arrow(N0 + todo.w + 6, rTodo, IX - 6, rA + 10, { color: C.accent, width: 2.5 });
  s += inodeBox(rA, ino[n.todo], C.accent);
  s += arrow(IX + IW + 6, rA, CX - 6, rA, { color: C.accent, width: 2.5 });
  s += page(rA);
  if (notesGone) s += mark(CX + CW - 22, rA + 16, true);
  // The symbolic link: an inode of its own, whose contents are the name notes.txt.
  s += arrow(N0 + link.w + 6, rLink, IX - 6, rLink, { color: LINK, width: 2.5 });
  s += `<rect x="${IX}" y="${rLink - 20}" width="${IW}" height="40" rx="6" fill="#ffffff" stroke="${LINK}" stroke-width="2"/>`;
  s += code(IX + 11, rLink, ino.link[0], { weight: 700 });
  s += arrow(IX + IW + 6, rLink, CX - 6, rLink, { color: LINK, width: 2.5 });
  s += `<rect x="${CX}" y="${rLink - 20}" width="${CW}" height="40" rx="6" fill="#e3f4f6" stroke="${LINK}" stroke-width="2"/>`;
  s += code(CX + CW / 2, rLink, n.notes, { anchor: "middle", weight: 700, color: C.ink, fit: CW - 10 });
  // … which is looked up again among the names: there (before rm), or gone – a broken link.
  const top = rLink - 34, left = PAD + 8;
  const color = notesGone ? C.bad : LINK;
  const d = `M${CX + CW / 2},${rLink - 20} V${top + 8} Q${CX + CW / 2},${top} ${CX + CW / 2 - 8},${top} H${left + 8} Q${left},${top} ${left},${top + 8} V${rNotes - 8} Q${left},${rNotes} ${left + 8},${rNotes} H${N0 - 4}`;
  s += arrowPath(d, N0 - 4, rNotes, 1, 0, { color, width: 2, dash: "5 4" });
  if (notesGone) s += mark(N0 + notes.w + 16, rNotes, false);
  return s;
}

export function draw(v, R) {
  const n = world(v.lang).names;
  let s = "";
  // Panel 1: ln and ln -s.
  s += cmdStrip(PAD, PAD + 20, `ln ${n.notes} ${n.todo}`).svg;
  s += cmdStrip(PAD, PAD + 20 + STRIP, `ln -s ${n.notes} link`).svg;
  // The columns' headers.
  const hy = P1 - 64;
  s += label(v, IX + IW / 2, hy, tr(v, words.inode), { anchor: "middle", size: FS_TITLE, weight: 700, color: C.muted });
  s += label(v, CX + CW / 2, hy, tr(v, words.contents), { anchor: "middle", size: FS_TITLE, weight: 700, color: C.muted, fit: CW });
  s += label(v, N0 + 70, hy, tr(v, words.names), { anchor: "middle", size: FS_TITLE, weight: 700, color: C.muted, fit: IX - N0 });
  s += panel(v, P1, inodes(R, "before"), false);
  // Panel 2: rm notes.txt.
  const sep = SEP;
  s += `<line x1="${PAD}" y1="${sep}" x2="${W - PAD}" y2="${sep}" stroke="${C.grid}" stroke-width="1"/>`;
  s += cmdStrip(PAD, sep + 34, `rm ${n.notes}`).svg;
  s += panel(v, P2, inodes(R, "after"), true);
  // The legend: the number in the circle is the link count.
  const lx = isRtl(v) ? W - PAD - 18 : PAD + 18;
  s += `<circle cx="${lx}" cy="${LEGEND}" r="14" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2"/>` + code(lx, LEGEND, "2", { anchor: "middle", weight: 800, color: C.accent });
  s += label(v, isRtl(v) ? lx - 26 : lx + 26, LEGEND, tr(v, words.count), { weight: 600 });
  return svg(height, s);
}
