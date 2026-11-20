// Text processing: how the chapter's awk program adds up a column. The program in { } runs for every line of the
// grades file (the simulator's, in the learner's language) where NR > 1 – the header is skipped – and adds field 3 to
// the variable; END runs once, after the last line, and prints the sum (the simulator's answer).
import { C, FS, PAD, W, arrow, code, label, perLanguage, svg, tr, world } from "./style.mjs";
import { chip, strip } from "./_admin.mjs";

export const variants = perLanguage("awk-sum");

export const words = {
  everyLine: { en: "for every line", sv: "för varje rad", de: "für jede Zeile", fr: "pour chaque ligne", es: "para cada línea", pt: "para cada linha", ru: "для каждой строки", zh: "对每一行", ja: "各行で", ar: "لكل سطر", hi: "हर line के लिए" },
  afterLast: { en: "once, after the last line", sv: "en gång, efter sista raden", de: "einmal, nach der letzten Zeile", fr: "une fois, après la dernière ligne", es: "una vez, después de la última línea", pt: "uma vez, depois da última linha", ru: "один раз, после последней строки", zh: "在最后一行之后运行一次", ja: "最後の行のあとに 1 回", ar: "مرة واحدة، بعد السطر الأخير", hi: "एक बार, आख़िरी line के बाद" },
};

export function terminals(v) {
  const n = world(v.lang).names;
  return { sum: { commands: [`cat ${n.documents}/${n.grades}`, `awk -F, 'NR > 1 {${n.sumVar} += $3} END {print ${n.sumVar}}' ${n.documents}/${n.grades}`] } };
}

const ROW = 32;
const TOP = PAD + 88; // the first line's middle
const FILE_X = PAD + 16;
const SUM_X = 336; // the running sum's column
export const height = (v, R) => TOP + (R.sum.lines[0].output.length - 1) * ROW + 30 + 104 + PAD;

export function draw(v, R) {
  const n = world(v.lang).names;
  const rows = R.sum.lines[0].output.map((row) => row.map((r) => r.text).join(""));
  const printed = R.sum.lines[1].output.map((row) => row.map((r) => r.text).join("")).join("");
  let s = "";
  // The program for every line, at the top of the sums' column.
  s += strip(SUM_X - 14, PAD + 22, `NR > 1 {${n.sumVar} += $3}`).svg;
  s += label(v, SUM_X - 12, PAD + 58, tr(v, words.everyLine), { color: C.muted, weight: 600, visual: true });
  // The file, line by line, and the sum after each line.
  const fileH = rows.length * ROW + 16;
  s += `<rect x="${PAD}" y="${TOP - ROW / 2 - 8}" width="${SUM_X - PAD - 40}" height="${fileH}" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += code(FILE_X, TOP - ROW / 2 - 24, n.grades, { weight: 700, color: C.muted });
  let sum = 0;
  rows.forEach((row, i) => {
    const y = TOP + i * ROW;
    const header = i === 0;
    s += code(FILE_X, y, row, { color: header ? C.line : C.ink });
    s += `<path d="M${SUM_X - 48},${y} H${SUM_X - 8}" stroke="${header ? C.grid : C.line}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    if (header) {
      s += code(SUM_X, y, "NR = 1", { color: C.line });
      s += `<path d="M${SUM_X + 84},${y - 9} l18,18 M${SUM_X + 102},${y - 9} l-18,18" stroke="${C.x}" stroke-width="2.5" stroke-linecap="round"/>`;
      return;
    }
    const value = Number(row.split(",").at(-1));
    sum += value;
    s += code(SUM_X, y, `${n.sumVar} = ${sum}`, { weight: 600 }) + code(SUM_X + (n.sumVar.length + 3 + String(sum).length) * FS * 0.6 + 14, y, `(+${value})`, { color: C.y });
  });
  if (String(sum) !== printed.trim()) throw new Error(`awk printed ${printed}, the rows add up to ${sum}`);
  // END: once, after the last line – it prints the sum.
  const ey = TOP + (rows.length - 1) * ROW + 30 + 40;
  const st = strip(SUM_X - 14, ey, `END {print ${n.sumVar}}`);
  s += st.svg;
  s += arrow(SUM_X - 14 + st.w + 8, ey, SUM_X - 14 + st.w + 46, ey, { color: C.accent, width: 2.5 });
  s += chip(SUM_X - 14 + st.w + 52, ey, printed.trim(), { style: "accent", weight: 800 });
  s += label(v, SUM_X - 12, ey + 36, tr(v, words.afterLast), { color: C.muted, weight: 600, fit: W - PAD - SUM_X, visual: true });
  return svg(height(v, R), s);
}
