// Navigating: an absolute and a relative path to the same directory, as in the chapter's question – from /home to
// /home/<user>/<documents>: the absolute path starts at the root, the relative one where you are.
import { C, FS, FS_TITLE, PAD, W, box, code, isRtl, label, perLanguage, svg, tag, tr, tree, world } from "./style.mjs";

export const variants = perLanguage("paths");

export const words = {
  absolute: { en: "Absolute path", sv: "Absolut sökväg", de: "Absoluter Pfad", fr: "Chemin absolu", es: "Ruta absoluta", pt: "Caminho absoluto", ru: "Абсолютный путь", zh: "绝对路径", ja: "絶対パス", ar: "مسار مطلق", hi: "Absolute path" },
  absoluteFrom: {
    en: "starts at the root /",
    sv: "utgår från roten /",
    de: "beginnt bei der Wurzel /",
    fr: "part de la racine /",
    es: "parte de la raíz /",
    pt: "parte da raiz /",
    ru: "отсчитывается от корня /",
    zh: "从根目录 / 出发",
    ja: "ルート / から始まる",
    ar: "ينطلق من الجذر /",
    hi: "root / से शुरू होता है",
  },
  relative: { en: "Relative path", sv: "Relativ sökväg", de: "Relativer Pfad", fr: "Chemin relatif", es: "Ruta relativa", pt: "Caminho relativo", ru: "Относительный путь", zh: "相对路径", ja: "相対パス", ar: "مسار نسبي", hi: "Relative path" },
  relativeFrom: {
    en: "starts where you are",
    sv: "utgår från där du står",
    de: "beginnt dort, wo du bist",
    fr: "part de là où vous êtes",
    es: "parte de donde estás",
    pt: "parte de onde você está",
    ru: "от текущего каталога",
    zh: "从你所在的目录出发",
    ja: "今いる場所から始まる",
    ar: "ينطلق من حيث أنت",
    hi: "जहाँ आप हैं, वहाँ से शुरू होता है",
  },
  here: { en: "you are here", sv: "du står här", de: "hier bist du", fr: "vous êtes ici", es: "estás aquí", pt: "você está aqui", ru: "вы здесь", zh: "你在这里", ja: "今ここ", ar: "أنت هنا", hi: "आप यहाँ हैं" },
};

const PW = (W - 2 * PAD - 8) / 2; // a panel's width
const TREE_Y = PAD + 76;
const ROW = 38;
export const height = TREE_Y + 5 * ROW + 70 + PAD;

function panel(v, x, kind, n) {
  const color = kind === "absolute" ? C.accent : C.accent2;
  const style = kind === "absolute" ? "accent" : "accent2";
  let s = box(x, PAD, PW, height - 2 * PAD, { style, fill: "#ffffff" });
  const tx = isRtl(v) ? x + PW - 16 : x + 16;
  s += label(v, tx, PAD + 24, tr(v, words[kind]), { size: FS_TITLE, weight: 700, color });
  s += label(v, tx, PAD + 52, tr(v, words[kind + "From"]), { color: C.muted, fit: PW - 32 });
  // The tree, with the path in the panel's colour: from / (absolute) or from home, where you are (relative).
  const abs = kind === "absolute";
  const items = [
    { name: "/", depth: 0, color: abs ? color : undefined },
    { name: "home", depth: 1, color: color, edge: abs ? color : undefined },
    { name: n.user, depth: 2, color, edge: color },
    { name: n.documents, depth: 3, color, edge: color },
    { name: "var", depth: 1 },
  ];
  const t = tree(x + 22, TREE_Y, items, { row: ROW });
  s += t.svg;
  // Where you are: /home.
  const home = t.rows[1];
  s += tag(v, x + PW - 14, home.y, tr(v, words.here), { anchor: "end", size: FS, color: C.ink, fill: "#fff6d6", stroke: "#c99a2e" });
  // The start of the path: a dot on / or on home.
  const start = abs ? t.rows[0] : home;
  s += `<circle cx="${start.x + 12}" cy="${start.y}" r="15" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  // The command.
  const cmd = abs ? `cd /home/${n.user}/${n.documents}` : `cd ${n.user}/${n.documents}`;
  const cy = TREE_Y + 5 * ROW + 32;
  s += `<rect x="${x + 6}" y="${cy - 20}" width="${PW - 12}" height="40" rx="6" fill="#0f1318"/>`;
  s += code(x + 13, cy, cmd, { color: "#e6edf3", fit: PW - 26 });
  return s;
}

export function draw(v) {
  const n = world(v.lang).names;
  // Absolute first in reading order (on the right in a right-to-left language).
  const [first, second] = isRtl(v) ? [PAD + PW + 8, PAD] : [PAD, PAD + PW + 8];
  return svg(height, panel(v, first, "absolute", n) + panel(v, second, "relative", n));
}
