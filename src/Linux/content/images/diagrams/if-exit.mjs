// Shell scripts: what if looks at – it runs the command [ -f ~/.bashrc ] and takes its exit code; 0 (true) runs the
// then part, anything else (false) the else part. The two echo commands are the chapter's, in the variant's language,
// and the exit codes are what the simulator's [ gives for a file that exists and one that does not.
import { C, FS, PAD, W, arrowPath, code, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { chapterBlock, chip, strip } from "./_admin.mjs";

export const variants = perLanguage("if-exit");

export const words = {
  exitCode: { en: "exit code", sv: "slutkod", de: "Exit-Code", fr: "code de retour", es: "código de salida", pt: "código de saída", ru: "код возврата", zh: "退出码", ja: "終了コード", ar: "رمز الخروج", hi: "exit code" },
  yes: { en: "true", sv: "sant", de: "wahr", fr: "vrai", es: "verdadero", pt: "verdadeiro", ru: "истина", zh: "真", ja: "真", ar: "صحيح", hi: "true" },
  no: { en: "false", sv: "falskt", de: "falsch", fr: "faux", es: "falso", pt: "falso", ru: "ложь", zh: "假", ja: "偽", ar: "خطأ", hi: "false" },
};

export const terminals = { codes: { commands: ["[ -f ~/.bashrc ]; echo $?", "[ -f ~/nothing.txt ]; echo $?"] } };

const CX = PAD + 118; // the command and its exit code, one above the other
const CMD_Y = PAD + 21, CODE_Y = PAD + 106, ROW1 = PAD + 190, ROW2 = PAD + 256;
export const height = ROW2 + 20 + PAD;

export function draw(v, R) {
  const line = chapterBlock(v, "skript", ["if [ -f ~/.bashrc ]"]).find((l) => l.startsWith("if [ -f ~/.bashrc ]"));
  const m = /then (echo "[^"]*"); else (echo "[^"]*"); fi/.exec(line);
  if (m === null) throw new Error(`${v.lang}: no then … else … in ${line}`);
  const [ok, missing] = R.codes.lines.map((l) => l.output.map((row) => row.map((r) => r.text).join("")).join(""));
  if (ok !== "0" || missing === "0") throw new Error(`[ -f gave ${ok} and ${missing}`);
  let s = "";
  // The command if runs, and its exit code under it.
  s += strip(CX, CMD_Y, "[ -f ~/.bashrc ]", { anchor: "middle" }).svg;
  s += arrowPath(`M${CX},${CMD_Y + 22} V${CODE_Y - 30}`, CX, CODE_Y - 30, 0, 1, { color: C.ink, width: 2.5 });
  s += `<circle cx="${CX}" cy="${CODE_Y}" r="27" fill="#ffffff" stroke="${C.ink}" stroke-width="2.5"/>` + code(CX, CODE_Y, "$?", { anchor: "middle", weight: 800 });
  s += label(v, CX + 40, CODE_Y, tr(v, words.exitCode), { visual: true, weight: 700, fit: 260 });
  // The two branches: 0 (true) runs then, anything else (false) runs else – the part of the chapter's if each runs.
  const rows = [
    { y: ROW1, value: ok, word: "yes", color: C.y, style: "y", run: `then ${m[1]}` },
    { y: ROW2, value: `${missing}, 2 …`, word: "no", color: C.x, style: "x", run: `else ${m[2]}` },
  ];
  const ends = rows.map((r) => CX + (textWidth(r.value, FS, true) + 24) / 2 + 10 + textWidth(tr(v, words[r.word])) + 14);
  const sx = Math.max(...ends) + 36;
  s += arrowPath(`M${CX},${CODE_Y + 27} V${ROW1 - 20}`, CX, ROW1 - 19, 0, 1, { color: C.y, width: 3 });
  s += arrowPath(`M${CX - 27},${CODE_Y + 4} C${CX - 80},${CODE_Y + 30} ${CX - 92},${ROW2} ${CX - (textWidth(rows[1].value, FS, true) + 24) / 2 - 6},${ROW2}`, CX - (textWidth(rows[1].value, FS, true) + 24) / 2 - 5, ROW2, 1, 0, { color: C.x, width: 3 });
  rows.forEach((r, i) => {
    const vw = textWidth(r.value, FS, true) + 24;
    s += chip(CX, r.y, r.value, { anchor: "middle", style: r.style, h: 36 });
    s += label(v, CX + vw / 2 + 10, r.y, tr(v, words[r.word]), { visual: true, weight: 700, color: r.color });
    s += arrowPath(`M${ends[i] + 2},${r.y} H${sx - 6}`, sx - 6, r.y, 1, 0, { color: r.color, width: 2.5 });
    s += strip(sx, r.y, r.run).svg;
  });
  return svg(height, s);
}
