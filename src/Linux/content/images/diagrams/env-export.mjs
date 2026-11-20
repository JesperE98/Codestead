// Variables, PATH and aliases: what export does. A variable you create lives only in your shell; one you export is an
// environment variable, and every program the shell starts gets a copy of it – the chapter's x=linux and
// export EDITOR=nano.
import { C, FS, FS_TITLE, PAD, W, arrow, box, code, isRtl, label, perLanguage, startX, svg, textWidth, tr } from "./style.mjs";
import { mark, words as systemWords } from "./_system.mjs";

export const variants = perLanguage("env-export");

export const words = {
  shell: systemWords.shell,
  program: {
    en: "a program you start",
    sv: "ett program du startar",
    de: "ein Programm, das du startest",
    fr: "programme que vous lancez",
    es: "un programa que arrancas",
    pt: "um programa que você inicia",
    ru: "запущенная вами программа",
    zh: "你启动的程序",
    ja: "あなたが起動したプログラム",
    ar: "برنامج تشغّله",
    hi: "आपका चलाया हुआ program",
  },
  envVar: { en: "environment variable", sv: "miljövariabel", de: "Umgebungsvariable", fr: "variable d'environnement", es: "variable de entorno", pt: "variável de ambiente", ru: "переменная окружения", zh: "环境变量", ja: "環境変数", ar: "متغير بيئة", hi: "environment variable" },
  only: {
    en: "only in your shell",
    sv: "bara i ditt skal",
    de: "nur in deiner Shell",
    fr: "seulement dans votre shell",
    es: "solo en tu shell",
    pt: "só no seu shell",
    ru: "только в вашем shell",
    zh: "只在你的 shell 里",
    ja: "シェルの中だけ",
    ar: "في الـ shell الخاص بك فقط",
    hi: "सिर्फ़ आपके shell में",
  },
};

const LX = PAD, LW = 280; // your shell
const RX = 380, RW = W - PAD - RX; // the program it starts
const TOP = PAD + 4, BOX_H = 176;
const ROW1 = TOP + 82, ROW2 = TOP + 134;
const LEGEND = TOP + BOX_H + 34;
export const height = LEGEND + 18 + PAD;

/** A variable as a chip; (x, y) is the left middle. */
function chip(x, y, s, o = {}) {
  const w = textWidth(s, FS, true) + 24;
  return `<rect x="${x}" y="${y - 18}" width="${w}" height="36" rx="6" fill="${o.fill ?? "#ffffff"}" stroke="${o.stroke ?? C.boxStroke}" stroke-width="${o.width ?? 1.5}"${o.dash ? ` stroke-dasharray="5 4"` : ""}/>` +
    code(x + 12, y, s, { color: o.color ?? C.ink, weight: 600 });
}
const chipW = (s) => textWidth(s, FS, true) + 24;

export function draw(v) {
  let s = "";
  // The two boxes, each with its name at the top.
  const head = (x, w, name, title) => {
    let h = box(x, TOP, w, BOX_H);
    const tx = startX(v, x + 16, x + w - 16);
    if (name) {
      h += code(isRtl(v) ? x + w - 16 : x + 16, TOP + 28, name, { size: FS_TITLE, weight: 700, anchor: isRtl(v) ? "end" : "start" });
      h += label(v, isRtl(v) ? x + w - 16 - textWidth(name, FS_TITLE, true) - 12 : x + 16 + textWidth(name, FS_TITLE, true) + 12, TOP + 28, title, { color: C.muted, weight: 600, fit: w - 40 - textWidth(name, FS_TITLE, true) });
    } else h += label(v, tx, TOP + 28, title, { weight: 700, fit: w - 32 });
    return h;
  };
  s += head(LX, LW, "bash", tr(v, words.shell));
  s += head(RX, RW, null, tr(v, words.program));
  // In your shell: x=linux and the exported EDITOR=nano.
  s += chip(LX + 16, ROW1, "x=linux");
  s += chip(LX + 16, ROW2, "export EDITOR=nano", { fill: C.accentSoft, stroke: C.accent, width: 2 });
  // Into the program: only the environment variable comes along.
  const ax1 = RX - 8;
  s += `<path d="M${LX + 16 + chipW("x=linux") + 8},${ROW1} H${ax1 - 40}" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += mark(ax1 - 24, ROW1, false);
  s += arrow(LX + 16 + chipW("export EDITOR=nano") + 8, ROW2, RX + 12, ROW2, { color: C.accent, width: 2.5 });
  s += chip(RX + 18, ROW2, "EDITOR=nano", { fill: C.accentSoft, stroke: C.accent, width: 2 });
  s += chip(RX + 18, ROW1, "x", { fill: C.card, stroke: C.line, color: C.line, dash: "5 4" });
  // The legend: the orange one is an environment variable, the grey one only lives in your shell.
  const lx = startX(v, PAD + 4, W - PAD - 4);
  const sw = (x, fill, stroke, dash) => `<rect x="${isRtl(v) ? x - 26 : x}" y="${LEGEND - 11}" width="26" height="22" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"${dash ? ` stroke-dasharray="4 3"` : ""}/>`;
  const env = tr(v, words.envVar), only = tr(v, words.only);
  s += sw(lx, C.accentSoft, C.accent);
  s += label(v, isRtl(v) ? lx - 36 : lx + 36, LEGEND, env, { weight: 600 });
  const second = isRtl(v) ? lx - 36 - textWidth(env) - 34 : lx + 36 + textWidth(env) + 34;
  s += sw(second, "#ffffff", C.boxStroke);
  s += label(v, isRtl(v) ? second - 36 : second + 36, LEGEND, only, { color: C.muted, weight: 600, fit: isRtl(v) ? second - 36 - PAD : W - PAD - second - 36 });
  return svg(height, s);
}
