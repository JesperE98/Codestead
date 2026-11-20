// Scheduled jobs: the cron trap – the same command in your terminal and in a cron job: bash with your ~/.bashrc or
// /bin/sh without it, the terminal's PATH (the simulator's) or cron's short one, and output on the screen or lost unless
// the line sends it to a file (the chapter's >> ~/job.log 2>&1). (After the question in the text: it shows the answer.)
import { C, FS, PAD, W, arrow, code, isRtl, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { chapter, chip } from "./_admin.mjs";

export const variants = perLanguage("cron-env");

export const words = {
  terminal: { en: "in your terminal", sv: "i din terminal", de: "in deinem Terminal", fr: "dans votre terminal", es: "en tu terminal", pt: "no seu terminal", ru: "в вашем терминале", zh: "在你的终端里", ja: "あなたのターミナル", ar: "في الطرفية", hi: "आपके terminal में" },
  cron: { en: "in a cron job", sv: "i ett cron-jobb", de: "in einem cron-Job", fr: "dans une tâche cron", es: "en una tarea de cron", pt: "em uma tarefa do cron", ru: "в задании cron", zh: "在 cron 任务里", ja: "cron のジョブ", ar: "في مهمة cron", hi: "cron job में" },
  shell: { en: "shell", sv: "skal", de: "Shell", fr: "shell", es: "shell", pt: "shell", ru: "shell", zh: "shell", ja: "シェル", ar: "الـ shell", hi: "shell" },
  output: { en: "output", sv: "utdata", de: "Ausgabe", fr: "sortie", es: "salida", pt: "saída", ru: "вывод", zh: "输出", ja: "出力", ar: "المخرجات", hi: "output" },
  screen: { en: "on the screen", sv: "på skärmen", de: "auf dem Bildschirm", fr: "à l'écran", es: "en la pantalla", pt: "na tela", ru: "на экране", zh: "显示在屏幕上", ja: "画面に出る", ar: "على الشاشة", hi: "screen पर" },
  lost: { en: "lost", sv: "försvinner", de: "geht verloren", fr: "perdue", es: "se pierde", pt: "se perde", ru: "теряется", zh: "丢失", ja: "失われる", ar: "تضيع", hi: "खो जाता है" },
};

export const terminals = { path: { commands: ["echo $PATH"] } };

const LEFT_W = 372; // the terminal's column (its PATH is the longer one)
const HEAD = PAD + 22;
const ROW = 92;
const ROWS_Y = HEAD + 46; // the first row's label
export const height = ROWS_Y + 3 * ROW + 40 + PAD;

export function draw(v, R) {
  const rtl = isRtl(v);
  const path = R.path.lines[0].output[0].map((r) => r.text).join("");
  const log = /(>> ~\/\S+\.log 2>&1)/.exec(chapter(v.lang, "schemalaggning"))[1];
  const lx = rtl ? W - PAD - LEFT_W : PAD, rx = rtl ? PAD : PAD + LEFT_W + 12;
  const rw = W - 2 * PAD - LEFT_W - 12;
  let s = "";
  // The two columns.
  s += `<rect x="${lx}" y="${PAD}" width="${LEFT_W}" height="${height - 2 * PAD}" rx="10" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += `<rect x="${rx}" y="${PAD}" width="${rw}" height="${height - 2 * PAD}" rx="10" fill="${C.xSoft}" fill-opacity="0.5" stroke="${C.x}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += label(v, lx + LEFT_W / 2, HEAD, tr(v, words.terminal), { anchor: "middle", weight: 700, fit: LEFT_W - 16 });
  s += label(v, rx + rw / 2, HEAD, tr(v, words.cron), { anchor: "middle", weight: 700, color: C.x, fit: rw - 16 });
  const rowLabel = (i, t, mono) => {
    const y = ROWS_Y + i * ROW;
    return mono ? code(lx + 16, y, t, { color: C.muted, weight: 700 }) + code(rx + 16, y, t, { color: C.muted, weight: 700 })
      : label(v, rtl ? lx + LEFT_W - 16 : lx + 16, y, t, { color: C.muted, weight: 700 }) + label(v, rtl ? rx + rw - 16 : rx + 16, y, t, { color: C.muted, weight: 700 });
  };
  // 1. The shell.
  let y = ROWS_Y;
  s += rowLabel(0, tr(v, words.shell));
  s += chip(lx + 16, y + 36, "/bin/bash", { style: "plain" }) + chip(lx + 16 + textWidth("/bin/bash", FS, true) + 34, y + 36, "~/.bashrc", { style: "y" });
  s += chip(rx + 16, y + 36, "/bin/sh", { style: "plain" }) + chip(rx + 16 + textWidth("/bin/sh", FS, true) + 34, y + 36, "~/.bashrc", { style: "gone" });
  // 2. PATH.
  y += ROW;
  s += rowLabel(1, "PATH", true);
  s += chip(lx + 16, y + 36, path, { style: "plain" });
  s += chip(rx + 16, y + 36, "/usr/bin:/bin", { style: "x" });
  // 3. The output.
  y += ROW;
  s += rowLabel(2, tr(v, words.output));
  s += arrow(lx + 18, y + 36, lx + 54, y + 36, { color: C.y, width: 2.5 }) + label(v, lx + 62, y + 36, tr(v, words.screen), { visual: true, weight: 600, color: C.y, fit: LEFT_W - 80 });
  s += arrow(rx + 18, y + 36, rx + 54, y + 36, { color: C.x, width: 2.5 }) + label(v, rx + 62, y + 36, tr(v, words.lost), { visual: true, weight: 700, color: C.x, fit: rw - 80 });
  s += chip(rx + 16, y + 80, log, { style: "y" });
  return svg(height, s);
}
