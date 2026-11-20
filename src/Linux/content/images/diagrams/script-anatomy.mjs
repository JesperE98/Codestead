// Shell scripts: the parts of the chapter's complete example, backup.sh – the script as the chapter has it in the
// variant's language, with the shebang, the comment, $#, exit 1, the loop over "$@", the test -f and >&2 marked and
// numbered, and what each is in a legend under it.
import { C, FS, MONO, PAD, W, esc, isRtl, label, perLanguage, svg, text, tr } from "./style.mjs";
import { chapterBlock } from "./_admin.mjs";

export const variants = perLanguage("script-anatomy");

export const words = {
  shebang: { en: "shebang", sv: "shebang", de: "Shebang", fr: "shebang", es: "shebang", pt: "shebang", ru: "shebang", zh: "shebang", ja: "シバン", ar: "shebang", hi: "shebang" },
  comment: { en: "comment", sv: "kommentar", de: "Kommentar", fr: "commentaire", es: "comentario", pt: "comentário", ru: "комментарий", zh: "注释", ja: "コメント", ar: "تعليق", hi: "comment" },
  argc: { en: "the number of arguments", sv: "antal argument", de: "die Anzahl der Argumente", fr: "le nombre d'arguments", es: "el número de argumentos", pt: "o número de argumentos", ru: "число аргументов", zh: "参数的个数", ja: "引数の数", ar: "عدد الوسائط", hi: "arguments की संख्या" },
  exit: { en: "exit code 1", sv: "slutkod 1", de: "Exit-Code 1", fr: "code de retour 1", es: "código de salida 1", pt: "código de saída 1", ru: "код возврата 1", zh: "退出码 1", ja: "終了コード 1", ar: "رمز الخروج 1", hi: "exit code 1" },
  each: { en: "one argument at a time", sv: "ett argument i taget", de: "jedes Argument einzeln", fr: "un argument à la fois", es: "un argumento cada vez", pt: "um argumento de cada vez", ru: "по одному аргументу", zh: "每次一个参数", ja: "引数を 1 つずつ", ar: "وسيط واحد في كل مرة", hi: "एक बार में एक argument" },
  exists: { en: "does the file exist?", sv: "finns filen?", de: "existiert die Datei?", fr: "le fichier existe-t-il ?", es: "¿existe el archivo?", pt: "o arquivo existe?", ru: "существует ли файл?", zh: "文件存在吗？", ja: "ファイルはある？", ar: "هل الملف موجود؟", hi: "क्या file मौजूद है?" },
  stderr: { en: "to stderr", sv: "till stderr", de: "nach stderr", fr: "vers stderr", es: "a stderr", pt: "para stderr", ru: "в stderr", zh: "写到 stderr", ja: "stderr へ", ar: "إلى stderr", hi: "stderr पर" },
};

/** The marks: what to find in which line, the word and the colour. */
const MARKS = [
  { line: (l) => l === "#!/bin/bash", find: "#!/bin/bash", word: "shebang", color: C.accent2 },
  { line: (l) => l.startsWith("# "), find: null, word: "comment", color: C.muted },
  { line: (l) => l.includes("$#"), find: "$#", word: "argc", color: C.z },
  { line: (l) => l.trim() === "exit 1", find: "exit 1", word: "exit", color: C.x },
  { line: (l) => l.includes('"$@"'), find: '"$@"', word: "each", color: C.y },
  { line: (l) => l.includes("[ -f"), find: "-f", word: "exists", color: C.accent },
  { line: (l) => l.includes(">&2"), find: ">&2", word: "stderr", color: C.x },
];

const ROW = 30, BLANK = 12;

/** A numbered mark: a filled circle with the number at the smallest text size. */
const badge = (x, y, n, o) => `<circle cx="${x}" cy="${y}" r="14" fill="${o.color}"/>` + text(x, y + 0.5, String(n), { size: FS, weight: 700, color: "#ffffff", anchor: "middle" });
const CODE_X = PAD + 50; // the code, after the badges' gutter
const LEGEND_ROW = 32;
const lineHeight = (l) => (l === "" ? BLANK : ROW);
const codeOf = (v) => chapterBlock(v, "skript", ["#!/bin/bash", '"$@"', "exit 1"]);
const legendRows = Math.ceil(MARKS.length / 2);
export const height = (v) => PAD + 14 + codeOf(v).reduce((h, l) => h + lineHeight(l), 0) + 14 + 18 + legendRows * LEGEND_ROW + PAD - 6;

export function draw(v) {
  const lines = codeOf(v);
  const rtl = isRtl(v);
  const cw = FS * 0.6;
  let s = "";
  const codeH = lines.reduce((h, l) => h + lineHeight(l), 0) + 28;
  s += `<rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${codeH}" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += `<line x1="${CODE_X - 12}" y1="${PAD + 1}" x2="${CODE_X - 12}" y2="${PAD + codeH - 1}" stroke="${C.grid}" stroke-width="1.5"/>`;
  let y = PAD + 14;
  const used = new Set();
  for (const l of lines) {
    const h = lineHeight(l), cy = y + h / 2;
    // The mark on this line, if any: a soft band behind what it marks and its number in the gutter.
    const i = MARKS.findIndex((m, j) => !used.has(j) && m.line(l));
    if (i >= 0) {
      used.add(i);
      const m = MARKS[i];
      // The band under what is marked (the comment, in the variant's language, is only greyed).
      if (m.find) {
        const at = l.indexOf(m.find), len = m.find.length;
        s += `<rect x="${CODE_X + at * cw - 3}" y="${cy - 13}" width="${len * cw + 6}" height="26" rx="4" fill="${m.color}" opacity="0.16"/>`;
        s += `<rect x="${CODE_X + at * cw - 3}" y="${cy + 11}" width="${len * cw + 6}" height="2.5" fill="${m.color}"/>`;
      }
      s += badge(PAD + 19, cy, i + 1, { color: m.color });
    }
    if (l !== "") s += `<text x="${CODE_X}" y="${cy}" font-size="${FS}" font-weight="500" fill="${l.trim().startsWith("#") ? C.muted : C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${esc(l)}</text>`;
    y += h;
  }
  if (used.size !== MARKS.length) throw new Error(`${v.lang}: not every part was found in the script`);
  // The legend: two columns, in the order of the numbers (in Arabic the first column on the right).
  const top = PAD + codeH + 18 + LEGEND_ROW / 2;
  const colW = (W - 2 * PAD) / 2;
  MARKS.forEach((m, i) => {
    const col = Math.floor(i / legendRows), row = i % legendRows;
    const x0 = rtl ? W - PAD - col * colW : PAD + col * colW;
    const ly = top + row * LEGEND_ROW;
    const bx = rtl ? x0 - 19 : x0 + 19;
    s += badge(bx, ly, i + 1, { color: m.color });
    s += label(v, rtl ? bx - 22 : bx + 22, ly, tr(v, words[m.word]), { weight: 600, fit: colW - 50 });
  });
  return svg(height(v), s);
}
