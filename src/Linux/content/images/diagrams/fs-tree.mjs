// Navigating: the one tree of directories, from the root / down to the learner's home directory (~) – the directories of
// the chapter's table, with the learner's own user and documents directory.
import { C, PAD, W, arrow, isRtl, perLanguage, svg, tag, tr, tree, world } from "./style.mjs";

export const variants = perLanguage("fs-tree");

export const words = {
  root: {
    en: "the root – the top of the tree",
    sv: "roten – toppen av trädet",
    de: "die Wurzel – die Spitze des Baums",
    fr: "la racine – le sommet de l'arborescence",
    es: "la raíz: lo más alto del árbol",
    pt: "a raiz – o topo da árvore",
    ru: "корень – вершина дерева",
    zh: "根目录——整棵树的顶端",
    ja: "ルート（ツリーのいちばん上）",
    ar: "الجذر – قمة الشجرة",
    hi: "root – tree का सबसे ऊपरी हिस्सा",
  },
  home: {
    en: "~ your home directory",
    sv: "~ din hemkatalog",
    de: "~ dein Home-Verzeichnis",
    fr: "~ votre répertoire personnel",
    es: "~ tu directorio personal",
    pt: "~ o seu diretório pessoal",
    ru: "~ ваш домашний каталог",
    zh: "~ 你的主目录",
    ja: "~ あなたのホームディレクトリ",
    ar: "~ مجلد المنزل الخاص بك",
    hi: "~ आपकी home directory",
  },
  rootHome: {
    en: "the home directory of root",
    sv: "hemkatalogen för root",
    de: "Home-Verzeichnis von root",
    fr: "répertoire personnel de root",
    es: "directorio personal de root",
    pt: "diretório pessoal do root",
    ru: "домашний каталог root",
    zh: "root 的主目录",
    ja: "root のホームディレクトリ",
    ar: "مجلد المنزل الخاص بـ root",
    hi: "root की home directory",
  },
};

const ROW = 34;
export const height = PAD + 14 * ROW + PAD - 4;

export function draw(v) {
  const n = world(v.lang).names;
  const path = C.accent;
  const items = [
    { name: "/", depth: 0, color: path },
    { name: "boot", depth: 1 },
    { name: "dev", depth: 1 },
    { name: "etc", depth: 1 },
    { name: "home", depth: 1, color: path, edge: path },
    { name: n.user, depth: 2, color: path, edge: path },
    { name: n.documents, depth: 3 },
    { name: "proc", depth: 1 },
    { name: "root", depth: 1 },
    { name: "tmp", depth: 1 },
    { name: "usr", depth: 1 },
    { name: "bin", depth: 2 },
    { name: "var", depth: 1 },
    { name: "log", depth: 2 },
  ];
  const x0 = isRtl(v) ? 60 : 40;
  const t = tree(x0, PAD - 2, items, { row: ROW });
  let s = t.svg;
  // The labels: on a pill to the right of the tree, with an arrow back to the row.
  const note = (i, key, color) => {
    const r = t.rows[i];
    const lx = 300;
    return arrow(lx - 8, r.y, r.end + 10, r.y, { color, width: 1.5 }) + tag(v, lx, r.y, tr(v, words[key]), { color, stroke: color });
  };
  s += note(0, "root", path);
  s += note(5, "home", path);
  s += note(8, "rootHome", C.muted);
  return svg(height, s, W);
}
