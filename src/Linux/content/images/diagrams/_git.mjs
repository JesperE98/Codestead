// Shared by the pictures of "Git in the terminal": the three places a change passes through – the working tree, the
// index and the history (.git) – as three rows, with the chapter's files and commit ids, and the words for them. make.mjs
// skips this file (it starts with _).
import { C, FS, MONO, PAD, W, box, code, esc, folder, isRtl, label, textWidth, tr, world } from "./style.mjs";
import { fileChip } from "./_distro.mjs";

export const words = {
  workingTree: { en: "Working tree", sv: "Arbetskatalogen", de: "Arbeitsverzeichnis", fr: "Répertoire de travail", es: "Árbol de trabajo", pt: "Diretório de trabalho", ru: "Рабочий каталог", zh: "工作区", ja: "作業ツリー", ar: "شجرة العمل", hi: "Working tree" },
  index: { en: "Index", sv: "Indexet", de: "Index", fr: "Index", es: "Índice", pt: "Índice", ru: "Индекс", zh: "暂存区（index）", ja: "インデックス", ar: "الفهرس", hi: "Index" },
  history: { en: "History", sv: "Historiken", de: "Geschichte", fr: "Historique", es: "Historial", pt: "Histórico", ru: "История", zh: "历史", ja: "履歴", ar: "التاريخ", hi: "History" },
};

export const ROWH = 84, GAPH = 60;
export const TOP = PAD;
export const rowY = (i) => TOP + i * (ROWH + GAPH);
export const areasHeight = TOP + 3 * ROWH + 2 * GAPH + PAD;

/** A commit: a circle and its id. (x, y) the circle's middle; returns the svg and the right end. */
export function commit(x, y, id, o = {}) {
  const color = o.color ?? C.muted;
  const w = textWidth(id, FS, true);
  return {
    svg: `<circle cx="${x}" cy="${y}" r="11" fill="${o.fill ?? "#ffffff"}" stroke="${color}" stroke-width="3"/>` +
      `<text x="${x + 20}" y="${y}" font-size="${FS}" font-weight="650" fill="${o.ink ?? C.ink}" dominant-baseline="central" font-family="${MONO}">${esc(id)}</text>`,
    end: x + 20 + w,
  };
}

/**
 * The three rows: the working tree (the web project's three files, README.md changed), the index (README.md, added)
 * and the history (the first commit, and the new one when `newCommit`). `end` is room kept free at the end side (for
 * brackets; `short` leaves index.html out to make room). Returns the svg and helpers: at(dx, w) (x of something w wide dx from the start side), rowY, mid(i).
 */
export function areas(v, o = {}) {
  const rtl = isRtl(v);
  const reserve = o.end ?? 0;
  const at = (dx, w = 0) => (rtl ? W - PAD - dx - w : PAD + dx);
  const rowW = W - 2 * PAD - reserve;
  const rowX = rtl ? PAD + reserve : PAD;
  const n = world(v.lang).names;
  let s = "";
  const head = (i, key, style, extra) => {
    const y = rowY(i);
    s += box(rowX, y, rowW, ROWH, { style, ...(style ? {} : { fill: "#ffffff" }) });
    const title = tr(v, words[key]);
    s += label(v, at(16), y + 22, title, { weight: 700, size: 21, fit: rowW - 32 - (extra ? 90 : 0) });
    if (extra) s += code(rtl ? at(16) - textWidth(title, 21) - 12 - textWidth(extra, FS, true) : at(16) + textWidth(title, 21) + 12, y + 22, extra, { color: C.muted, weight: 600 });
  };
  const chips = (i, items) => {
    let dx = 16;
    for (const [name, style] of items) {
      const w = Math.round(textWidth(name, FS, true) + 46);
      s += fileChip(at(dx, w), rowY(i) + 58, name, { style, w, h: 34 }).svg;
      dx += w + 10;
    }
  };
  // 1. The working tree: the project's files, README.md changed.
  head(0, "workingTree", null, null);
  const dir = `~/${n.webProject}/`;
  const tw = textWidth(tr(v, words.workingTree), 21);
  if (tw + 40 + textWidth(dir, FS, true) < rowW - 32) {
    const dx = rtl ? at(16) - tw - 16 - 24 : at(16) + tw + 16;
    s += folder(dx, rowY(0) + 13) + code(rtl ? dx - 6 - textWidth(dir, FS, true) : dx + 30, rowY(0) + 22, dir, { color: C.muted, weight: 600 });
  }
  chips(0, [...(o.short ? [] : [["index.html", null]]), ["style.css", null], ["README.md", "accent"]]);
  // 2. The index: README.md, added.
  head(1, "index", null, null);
  chips(1, [["README.md", "accent"]]);
  // 3. The history: the first commit and (after git commit) the new one.
  head(2, "history", null, ".git");
  const cy = rowY(2) + 58;
  const gw = 31 + textWidth("3f2a9c1", FS, true); // a commit: its circle and its id
  const l1 = at(18, gw), l2 = at(18 + gw + 50, gw);
  s += commit(l1 + 11, cy, "3f2a9c1").svg;
  if (o.newCommit) {
    const [a, b] = l1 < l2 ? [l1, l2] : [l2, l1];
    s += `<line x1="${a + gw + 8}" y1="${cy}" x2="${b - 4}" y2="${cy}" stroke="${C.line}" stroke-width="2"/>`;
    s += commit(l2 + 11, cy, "8d41b7e", { color: C.accent, fill: C.accentSoft }).svg;
  }
  return { svg: s, at, rtl, rowX, rowW };
}
