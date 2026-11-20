// The look of Codestead Linux's chapter pictures: Codestead GP's style (the palette C, the card, box, arrow, pill,
// badge … – src/GP/content/images/diagrams/style.mjs, used as it is) and what Linux adds: eleven languages (the
// translation tables, right-to-left Arabic), the learner's world (user and file names per language), terminal panels
// with the simulator's real output, file-system trees and neutral family badges. See "Bilder i Codestead Linux" in
// docs/DEVELOPMENT.md. Coordinates are CSS pixels of the finished picture: 720 wide, rendered at 2× by make.mjs.
//
// Linux pictures are shown about 526 px wide in the app's default window (0.73 × the drawing), so all text is at least
// 19 px (FS) in drawing units – make.mjs reports anything smaller.
import { readFileSync } from "node:fs";
import { C, MONO, esc, text } from "../../../../GP/content/images/diagrams/style.mjs";

export * from "../../../../GP/content/images/diagrams/style.mjs";

/** The course's languages; English is the source, a missing language falls back to English. */
export const LANGS = ["en", "sv", "de", "fr", "es", "pt", "ru", "zh", "ja", "ar", "hi"];
/** Languages written right to left. */
export const RTL = new Set(["ar"]);

/** The smallest text size (labels, terminal text) and the size of titles, in drawing units. */
export const FS = 19;
export const FS_TITLE = 21;
/** JetBrains Mono's advance is 0.6 em: the width of one terminal column at size `size`. */
export const monoWidth = (size = FS) => size * 0.6;
/** The app's terminal: background and text colour (ts/apps/linux/src/Terminal). */
export const TERM = { bg: "#0f1318", text: "#e6edf3", dim: "#8b949e", border: "#30363d" };
/** The family badges' colours, as the chapter text's family blocks (MarkdownView's familyColors). */
export const FAMILY = { debian: "#c7254e", arch: "#1793d1", redhat: "#3c6eb4" };

/** One variant per language: <lang>/<name>.webp. make.mjs leaves out a language whose picture is the same as English. */
export function perLanguage(name, extra = {}) {
  return LANGS.map((lang) => ({ out: `${lang}/${name}.webp`, lang, ...extra }));
}

/** One picture for every language (no words, no names): <name>.webp. */
export function shared(name, extra = {}) {
  return [{ out: `${name}.webp`, lang: "en", ...extra }];
}

/**
 * The text for a variant's language from a translation table entry { en: "…", sv: "…", … } (every language of
 * LANGS; make.mjs checks a source's `words`). `{{name}}` placeholders are filled in from the learner's world.
 */
export function tr(v, entry) {
  const s = entry?.[v.lang];
  if (typeof s !== "string" || s === "") throw new Error(`no ${v.lang} text in ${JSON.stringify(entry)}`);
  return fill(v, s);
}

const worlds = new Map();
/** The learner's world in a language: { names, words, files } (src/Linux/Codestead.Shell/world/<lang>.json). */
export function world(lang) {
  if (!worlds.has(lang)) worlds.set(lang, JSON.parse(readFileSync(new URL(`../../../Codestead.Shell/world/${lang}.json`, import.meta.url), "utf8")));
  return worlds.get(lang);
}

/** Fills in {{name}} and {{word}} placeholders as the chapter texts do: fill(v, "~/{{documents}}/{{fruits}}"). */
export function fill(v, s) {
  const w = world(v.lang);
  return s.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (m, key) => w.names[key] ?? w.words[key] ?? m);
}

export const isRtl = (v) => RTL.has(v.lang);

/** Where text that starts a row goes: `left` in a left-to-right language, `right` in a right-to-left one (with label()). */
export const startX = (v, left, right) => (isRtl(v) ? right : left);

/**
 * Text in the variant's language: GP's text() at FS (19) px, and in a right-to-left language written right to left.
 * There "start" is the text's right end, so a row that starts at startX(v, left, right) mirrors by itself. A label that
 * must stay on one side of what it labels whatever the language (to the right of an arrow …) passes `visual: true`:
 * then "start" is always the left end and "end" the right end. Options as text(); `mono` for code.
 */
export function label(v, x, y, s, o = {}) {
  const rtl = isRtl(v) && !o.ltr;
  const anchor = o.anchor ?? "start";
  const flip = rtl && o.visual && anchor !== "middle";
  const svgText = text(x, y, s, { size: FS, ...o, anchor: flip ? (anchor === "start" ? "end" : "start") : anchor });
  return rtl ? svgText.replace("<text ", `<text direction="rtl" unicode-bidi="embed" `) : svgText;
}

/**
 * About how wide text is at `size` (for pills and layout; make.mjs measures the real text and reports text that does not
 * fit): CJK characters are 1 em, others about 0.56 em in Inter (0.6 em in JetBrains Mono).
 */
export function textWidth(s, size = FS, mono = false) {
  let w = 0;
  for (const ch of s) w += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 1 : mono ? 0.6 : 0.56;
  return w * size;
}

/**
 * A label on a pill (GP's pill() in the variant's language): at (x, y), anchor start | middle | end as label() with
 * `visual` (start: the pill's left end at x). The width comes from the text's length; `w` sets it.
 */
export function tag(v, x, y, s, o = {}) {
  const size = o.size ?? FS;
  const w = o.w ?? Math.round(textWidth(s.replace(/[*`]/g, ""), size, o.mono) + 28);
  const h = size + 12;
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${o.fill ?? "#ffffff"}" stroke="${o.stroke ?? C.boxStroke}" stroke-width="${o.strokeWidth ?? 1.2}"/>` +
    label(v, x0 + w / 2, y, s, { size, anchor: "middle", weight: o.weight ?? 600, color: o.color ?? C.ink, mono: o.mono, fit: w - 6 });
}

/** Code or a path (always left to right, mono, at least FS px). */
export function code(x, y, s, o = {}) {
  return `<text x="${x}" y="${y}" font-size="${o.size ?? FS}" font-weight="${o.weight ?? 500}" fill="${o.color ?? C.ink}" text-anchor="${o.anchor ?? "start"}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre"${o.fit ? ` data-fit="${o.fit}"` : ""}>${esc(s)}</text>`;
}

/**
 * A terminal panel with the simulator's output (make.mjs gives a source's `terminals` to the simulator; `lines` is
 * R[id].lines): every shown command after its prompt and what it printed, in the app's terminal colours.
 * Options: size (FS), lineHeight (size × 1.42), pad (14), from/to (the rows to show: prompt rows and output rows
 * counted together), hidePrompt (only the output), cut (columns: longer rows end in "…"), marks ([{ row, col, len,
 * color }]: a coloured background behind columns of a row), dimRows (rows drawn dimmed). Returns { svg, height,
 * rowY(i), colX(c) } so labels can point at rows and columns.
 */
export function terminal(x, y, w, lines, o = {}) {
  const size = o.size ?? FS;
  const lh = o.lineHeight ?? Math.round(size * 1.42);
  const pad = o.pad ?? 14;
  const cw = monoWidth(size);
  const rows = [];
  for (const l of lines) {
    if (!o.hidePrompt) rows.push([...l.prompt, { text: l.typed, color: null }]);
    rows.push(...l.output);
  }
  const shown = rows.slice(o.from ?? 0, o.to ?? rows.length);
  const height = shown.length * lh + pad * 2 - (lh - size) + 6;
  const rowY = (i) => y + pad + 3 + i * lh + size / 2;
  const colX = (c) => x + pad + c * cw;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="6" fill="${TERM.bg}"/>`;
  for (const m of o.marks ?? []) s += `<rect x="${colX(m.col) - 2}" y="${rowY(m.row) - lh / 2 + 1}" width="${m.len * cw + 4}" height="${lh - 2}" rx="3" fill="${m.color}" opacity="${m.opacity ?? 0.35}"/>`;
  shown.forEach((runs, i) => {
    let col = 0;
    let spans = "";
    for (const r of runs) {
      let t = r.text;
      if (o.cut !== undefined && col + t.length > o.cut) t = t.slice(0, Math.max(0, o.cut - col - 1)) + "…";
      if (o.cut !== undefined && col >= o.cut) break;
      const style = [`fill="${r.color ?? TERM.text}"`];
      if (r.bold) style.push(`font-weight="700"`);
      if (r.opacity !== undefined || (o.dimRows ?? []).includes(i)) style.push(`opacity="${r.opacity ?? 0.45}"`);
      if (r.background) s += `<rect x="${colX(col)}" y="${rowY(i) - lh / 2 + 2}" width="${[...t].length * cw}" height="${lh - 4}" fill="${r.background}"/>`;
      spans += `<tspan ${style.join(" ")}>${esc(t)}</tspan>`;
      col += [...t].length;
    }
    s += `<text x="${colX(0)}" y="${rowY(i)}" font-size="${size}" font-weight="500" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${spans}</text>`;
  });
  return { svg: s, height, rowY, colX, lh };
}

/** The plain text of a terminal row (prompt rows and output rows counted together, as terminal() does). */
export function rowsOf(lines, o = {}) {
  const rows = [];
  for (const l of lines) {
    if (!o.hidePrompt) rows.push(l.prompt.map((r) => r.text).join("") + l.typed);
    for (const r of l.output) rows.push(r.map((x) => x.text).join(""));
  }
  return rows;
}

/** A small folder symbol (24 × 18 at scale 1) with its top left corner at (x, y). */
export function folder(x, y, o = {}) {
  const s = o.scale ?? 1;
  const fill = o.fill ?? "#f6d58e";
  const stroke = o.stroke ?? "#c99a2e";
  return `<path d="M${x},${y + 3 * s} q0,-3 3,-3 h${6 * s} l${3 * s},${3 * s} h${9 * s} q3,0 3,3 v${12 * s} q0,3 -3,3 h${-18 * s} q-3,0 -3,-3 z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
}

/** A small file symbol (16 × 20 at scale 1) with its top left corner at (x, y). */
export function file(x, y, o = {}) {
  const s = o.scale ?? 1;
  return `<path d="M${x},${y} h${11 * s} l${5 * s},${5 * s} v${15 * s} h${-16 * s} z" fill="${o.fill ?? "#ffffff"}" stroke="${o.stroke ?? C.line}" stroke-width="1.2"/>` +
    `<path d="M${x + 11 * s},${y} v${5 * s} h${5 * s}" fill="none" stroke="${o.stroke ?? C.line}" stroke-width="1.2"/>`;
}

/**
 * A neutral badge with a distribution family's name (never a distribution's logo): for pictures inside a :::debian,
 * :::arch or :::redhat block. The colours are the text's family blocks'.
 */
export function familyBadge(x, y, family, name, o = {}) {
  const size = o.size ?? FS;
  const w = o.w ?? Math.round(name.length * size * 0.6 + 24);
  const h = size + 12;
  return `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${FAMILY[family] ?? C.muted}"/>` +
    text(x + w / 2, y, name, { size, weight: 700, color: "#ffffff", anchor: "middle" });
}

/**
 * A directory tree drawn like `tree` prints it: one row per item, children indented under their parent, joined by
 * lines. items: [{ name, depth, file?, color?, edge?, bold? }] in order (depth 0 is the top). `color` colours the name,
 * `edge` the line that joins the item to its parent (a path through the tree). Options: row (36), indent (32), size (FS).
 * Returns { svg, rows: [{ x (the icon's left), y (the row's middle), end (the name's right end) }], height }.
 */
export function tree(x, y, items, o = {}) {
  const row = o.row ?? 36, indent = o.indent ?? 32, size = o.size ?? FS;
  const rows = items.map((it, i) => {
    const ix = x + it.depth * indent;
    const cy = y + row / 2 + i * row;
    return { x: ix, y: cy, end: ix + 32 + textWidth(it.name, size, true) };
  });
  let lines = "", coloured = "", icons = "", names = "";
  items.forEach((it, i) => {
    if (it.depth > 0) {
      let p = i - 1;
      while (p >= 0 && items[p].depth >= it.depth) p--;
      if (p >= 0) {
        const px = rows[p].x + 11, color = it.edge ?? C.line, width = it.edge ? 2.5 : 1.5;
        const path = `<path d="M${px},${rows[p].y + 11} V${rows[i].y} H${rows[i].x - 4}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
        if (it.edge) coloured += path;
        else lines += path;
      }
    }
    icons += it.file ? file(rows[i].x + 3, rows[i].y - 10) : folder(rows[i].x, rows[i].y - 9);
    names += `<text x="${rows[i].x + 32}" y="${rows[i].y}" font-size="${size}" font-weight="${it.bold || it.color ? 650 : 500}" fill="${it.color ?? C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${esc(it.name)}</text>`;
  });
  // Coloured lines last, so that they lie on top of the grey ones they share a trunk with.
  return { svg: lines + coloured + icons + names, rows, height: items.length * row };
}
