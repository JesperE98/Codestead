// Processes and jobs: the states of a job and the keys and commands that move it between them – a command starts in
// the foreground (the shell waits) or with & in the background (you keep your prompt); Ctrl+Z stops it, bg lets it go
// on in the background, fg brings it to the foreground, and Ctrl+C or kill ends it. As the chapter's table.
import { C, FS, FS_TITLE, PAD, W, arrow, code, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { cmdStrip } from "./_system.mjs";

export const variants = perLanguage("job-states");

export const words = {
  fg: { en: "Foreground", sv: "Förgrunden", de: "Vordergrund", fr: "Premier plan", es: "Primer plano", pt: "Primeiro plano", ru: "Передний план", zh: "前台", ja: "フォアグラウンド", ar: "الواجهة", hi: "Foreground" },
  fgDoes: { en: "the shell waits", sv: "skalet väntar", de: "die Shell wartet", fr: "le shell attend", es: "la shell espera", pt: "o shell espera", ru: "shell ждёт", zh: "shell 等它结束", ja: "シェルは待つ", ar: "الـ shell ينتظر", hi: "shell इंतज़ार करता है" },
  bg: { en: "Background", sv: "Bakgrunden", de: "Hintergrund", fr: "Arrière-plan", es: "Segundo plano", pt: "Segundo plano", ru: "Фон", zh: "后台", ja: "バックグラウンド", ar: "الخلفية", hi: "Background" },
  bgDoes: {
    en: "you keep your prompt",
    sv: "du behåller prompten",
    de: "du behältst den Prompt",
    fr: "vous gardez l'invite",
    es: "conservas el prompt",
    pt: "você mantém o prompt",
    ru: "приглашение свободно",
    zh: "提示符可以继续用",
    ja: "プロンプトが使える",
    ar: "تحتفظ بالمحث",
    hi: "prompt आपके पास रहता है",
  },
  stopped: { en: "Stopped", sv: "Stoppat", de: "Angehalten", fr: "Stoppé", es: "Detenido", pt: "Parado", ru: "Остановлено", zh: "已暂停", ja: "停止中", ar: "متوقفة", hi: "रुका हुआ" },
  ended: { en: "Ended", sv: "Avslutat", de: "Beendet", fr: "Terminé", es: "Terminado", pt: "Encerrado", ru: "Завершено", zh: "已结束", ja: "終了", ar: "انتهت", hi: "ख़त्म" },
};

const BW = 250, BH = 78;
const FG = { x: PAD + 20, y: PAD + 76 };
const BG = { x: W - PAD - 20 - BW, y: PAD + 76 };
const ST = { x: (W - BW) / 2, y: FG.y + BH + 128, h: 58 };
const EW = 142, EH = 50;
const END_L = { x: PAD + 6, y: ST.y + 4 };
const END_R = { x: W - PAD - 6 - EW, y: ST.y + 4 };
export const height = ST.y + ST.h + PAD + 4;

/** A key or command on an arrow: mono on a white pill; (x, y) its middle. */
function key(x, y, s, color = C.ink, anchor = "middle") {
  const w = textWidth(s, FS, true) + 16;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - 15}" width="${w}" height="30" rx="6" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>` + code(x0 + w / 2, y, s, { anchor: "middle", weight: 700, color });
}

function state(v, p, w, h, title, does, style) {
  const [fill, stroke] = style;
  let s = `<rect x="${p.x}" y="${p.y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
  const cx = p.x + w / 2;
  s += label(v, cx, does ? p.y + 26 : p.y + h / 2, title, { anchor: "middle", size: FS_TITLE, weight: 700, fit: w - 16 });
  if (does) s += label(v, cx, p.y + 54, does, { anchor: "middle", color: C.muted, weight: 600, fit: w - 16 });
  return s;
}

export function draw(v) {
  let s = "";
  // How a job starts: without & in the foreground, with & in the background.
  const a = cmdStrip(0, 0, "sleep 300"), b = cmdStrip(0, 0, "sleep 300 &");
  s += cmdStrip(FG.x + (BW - a.w) / 2, PAD + 18, "sleep 300").svg;
  s += cmdStrip(BG.x + (BW - b.w) / 2, PAD + 18, "sleep 300 &").svg;
  s += arrow(FG.x + BW / 2, PAD + 40, FG.x + BW / 2, FG.y - 4, { color: C.accent, width: 2.5 });
  s += arrow(BG.x + BW / 2, PAD + 40, BG.x + BW / 2, BG.y - 4, { color: C.accent2, width: 2.5 });
  // The three states and the end.
  s += state(v, FG, BW, BH, tr(v, words.fg), tr(v, words.fgDoes), [C.accentSoft, C.accent]);
  s += state(v, BG, BW, BH, tr(v, words.bg), tr(v, words.bgDoes), [C.accent2Soft, C.accent2]);
  s += state(v, ST, BW, ST.h, tr(v, words.stopped), null, ["#ffffff", C.line]);
  s += state(v, END_L, EW, EH, tr(v, words.ended), null, [C.card, C.boxStroke]);
  s += state(v, END_R, EW, EH, tr(v, words.ended), null, [C.card, C.boxStroke]);
  // fg: from the background to the foreground.
  const my = FG.y + BH / 2;
  s += arrow(BG.x - 6, my, FG.x + BW + 6, my, { color: C.ink, width: 2 });
  s += key((FG.x + BW + BG.x) / 2, my - 22, "fg %1");
  // Ctrl+Z: the foreground job stops; fg brings it back, bg lets it go on in the background.
  const fgB = FG.y + BH + 6, stT = ST.y - 6;
  const ky = stT - 36; // the keys on the slanted arrows
  const at = (x1, y1, x2, y2) => x1 + ((x2 - x1) * (ky - y1)) / (y2 - y1);
  const slant = (x1, y1, x2, y2, name, side) => {
    const x = at(x1, y1, x2, y2);
    return arrow(x1, y1, x2, y2, { color: C.ink, width: 2 }) + key(side === "end" ? x - 12 : x + 12, ky, name, C.ink, side);
  };
  s += slant(FG.x + BW - 70, fgB, ST.x + 40, stT, "Ctrl+Z", "end");
  s += slant(ST.x + 80, stT, FG.x + BW - 30, fgB, "fg %1", "start");
  s += slant(ST.x + BW - 60, stT, BG.x + 60, fgB, "bg %1", "start");
  // Ctrl+C ends the foreground job, kill %1 a background job.
  const lx = END_L.x + 34, rx = END_R.x + EW - 34;
  s += arrow(lx, fgB, lx, END_L.y - 6, { color: C.bad, width: 2 });
  s += key(lx + 10, fgB + 40, "Ctrl+C", C.bad, "start");
  s += arrow(rx, fgB, rx, END_R.y - 6, { color: C.bad, width: 2 });
  s += key(rx - 10, fgB + 40, "kill %1", C.bad, "end");
  return svg(height, s);
}
