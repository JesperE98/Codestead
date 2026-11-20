// Shared by the pictures of the part "The system" (miljo, rattigheter, lankar, processer, arkiv): the words for the three
// permission sets, a command in a dark strip as the terminal shows it, a row of permission bits and a file chip.
import { C, FS, MONO, esc, file, folder, textWidth } from "./style.mjs";

export const words = {
  type: { en: "type", sv: "typ", de: "Typ", fr: "type", es: "tipo", pt: "tipo", ru: "тип", zh: "类型", ja: "種類", ar: "النوع", hi: "type" },
  owner: { en: "owner", sv: "ägaren", de: "Besitzer", fr: "propriétaire", es: "propietario", pt: "dono", ru: "владелец", zh: "所有者", ja: "所有者", ar: "المالك", hi: "owner" },
  group: { en: "group", sv: "gruppen", de: "Gruppe", fr: "groupe", es: "grupo", pt: "grupo", ru: "группа", zh: "所属组", ja: "グループ", ar: "المجموعة", hi: "group" },
  shell: { en: "your shell", sv: "ditt skal", de: "deine Shell", fr: "votre shell", es: "tu shell", pt: "seu shell", ru: "ваш shell", zh: "你的 shell", ja: "あなたのシェル", ar: "الـ shell الخاص بك", hi: "आपका shell" },
  others: { en: "others", sv: "övriga", de: "Andere", fr: "autres", es: "otros", pt: "outros", ru: "остальные", zh: "其他人", ja: "その他", ar: "الآخرون", hi: "others" },
};

/** The terminal's colours (ts/apps/linux/src/Terminal), as style.mjs's TERM. */
const TERM_BG = "#0f1318", TERM_TEXT = "#e6edf3", TERM_DIM = "#8b949e";

/**
 * A command in a dark strip, as the terminal shows it after its prompt ("$ " dimmed): (x, y) is the strip's left middle.
 * Options: w (the width; by default the text's), h (40), size (FS), prompt (true). Returns { svg, w }.
 */
export function cmdStrip(x, y, cmd, o = {}) {
  const size = o.size ?? FS;
  const prompt = o.prompt === false ? "" : "$ ";
  const w = o.w ?? Math.round(textWidth(prompt + cmd, size, true) + 28);
  const h = o.h ?? 40;
  let s = `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${TERM_BG}"/>`;
  s += `<text x="${x + 14}" y="${y}" font-size="${size}" font-weight="500" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre" data-fit="${w - 20}">` +
    (prompt ? `<tspan fill="${TERM_DIM}">${esc(prompt)}</tspan>` : "") + `<tspan fill="${TERM_TEXT}">${esc(cmd)}</tspan></text>`;
  return { svg: s, w };
}

/**
 * A file (or a directory with `dir`) as a chip: its symbol and name in a box; (x, y) is the left middle. Options: dir,
 * fill, stroke, ink, dash, strike (the name crossed out), h (36), w. Returns { svg, w }.
 */
export function fileChip(x, y, name, o = {}) {
  const h = o.h ?? 36;
  const w = o.w ?? Math.round(36 + textWidth(name, FS, true) + 12);
  const fill = o.fill ?? (o.dir ? "#fff8e6" : "#ffffff");
  const stroke = o.stroke ?? (o.dir ? "#c99a2e" : C.boxStroke);
  let s = `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${o.strokeWidth ?? 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
  s += o.dir ? folder(x + 8, y - 9, o.ghost ? { fill: C.card, stroke: C.line } : {}) : file(x + 10, y - 10, o.ghost ? { fill: C.card, stroke: C.line } : {});
  s += `<text x="${x + 36}" y="${y}" font-size="${FS}" font-weight="600" fill="${o.ink ?? C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre"${o.strike ? ` text-decoration="line-through"` : ""}>${esc(name)}</text>`;
  return { svg: s, w };
}

/** A tick (✓, good) or a cross (✗, bad) drawn as lines, centred at (x, y). */
export function mark(x, y, good, o = {}) {
  const r = o.r ?? 8;
  const color = o.color ?? (good ? C.good : C.bad);
  return good
    ? `<path d="M${x - r},${y} l${r * 0.7},${r * 0.75} l${r * 1.3},${-r * 1.5}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M${x - r * 0.8},${y - r * 0.8} l${r * 1.6},${r * 1.6} M${x + r * 0.8},${y - r * 0.8} l${-r * 1.6},${r * 1.6}" stroke="${color}" stroke-width="3.2" stroke-linecap="round"/>`;
}

/** A user as a small person symbol and the name on a pill (root in red, others green); (x, y) is the left middle. */
export function userTag(x, y, name, o = {}) {
  const color = o.color ?? (name === "root" ? C.x : C.y);
  const w = Math.round(textWidth(name, FS, true) + 44);
  return `<rect x="${x}" y="${y - 16}" width="${w}" height="32" rx="16" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>` +
    `<circle cx="${x + 17}" cy="${y - 5}" r="5" fill="${color}"/><path d="M${x + 8},${y + 10} q0,-9 9,-9 q9,0 9,9 z" fill="${color}"/>` +
    `<text x="${x + 32}" y="${y}" font-size="${FS}" font-weight="700" fill="${color}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${esc(name)}</text>`;
}
export const userTagWidth = (name) => Math.round(textWidth(name, FS, true) + 44);
