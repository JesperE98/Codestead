// Scheduled jobs: when two crontab lines from the chapter's table run – */10 in the minute field every ten minutes of
// every hour, and 0 7 * * 1-5 at 07:00 on days 1 to 5 of the week (Monday to Friday; Sunday is 0 or 7).
// (After the questions in the text: the week shows that 6 is Saturday.)
import { C, FS, MONO, PAD, W, code, esc, isRtl, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { DARK } from "./_admin.mjs";

export const variants = perLanguage("cron-times");

export const words = {
  days: {
    en: "Mon Tue Wed Thu Fri Sat Sun",
    sv: "mån tis ons tor fre lör sön",
    de: "Mo Di Mi Do Fr Sa So",
    fr: "lun mar mer jeu ven sam dim",
    es: "lun mar mié jue vie sáb dom",
    pt: "seg ter qua qui sex sáb dom",
    ru: "пн вт ср чт пт сб вс",
    zh: "周一 周二 周三 周四 周五 周六 周日",
    ja: "月 火 水 木 金 土 日",
    ar: "الاثنين الثلاثاء الأربعاء الخميس الجمعة السبت الأحد",
    hi: "सोम मंगल बुध गुरु शुक्र शनि रवि",
  },
};

// The five fields on the dark strip: minute, hour, day of the month, month, day of the week (light versions of x red,
// accent, z blue, y green and accent2, which the timelines use).
const FIELD_COLORS = ["#ff8a8a", "#ffb77a", "#8fb3ff", "#7ee0a0", "#c9b3ff"];

/** A crontab line in a dark strip, its five fields in their colours; (x, y) its left middle. */
function cronLine(x, y, fields, cmd) {
  const textOf = fields.join(" ") + "  " + cmd;
  const w = textWidth(textOf, FS + 2, true) + 30;
  let spans = fields.map((f, i) => `<tspan fill="${FIELD_COLORS[i]}" font-weight="800">${esc(f)}</tspan>`).join(" ");
  spans += `<tspan fill="#e6edf3">  ${esc(cmd)}</tspan>`;
  return `<rect x="${x}" y="${y - 22}" width="${w}" height="44" rx="6" fill="${DARK}"/>` +
    `<text x="${x + 15}" y="${y}" font-size="${FS + 2}" font-weight="600" dominant-baseline="central" font-family="${MONO}" style="white-space:pre" fill="#e6edf3">${spans}</text>`;
}

const A_Y = PAD + 24; // the first line
const AXIS_Y = A_Y + 82;
const B_Y = AXIS_Y + 84;
const WEEK_Y = B_Y + 44;
const DAY_H = 112;
export const height = WEEK_Y + DAY_H + PAD;

export function draw(v) {
  let s = "";
  // */10 * * * *: a run every ten minutes of the hour.
  s += cronLine(PAD, A_Y, ["*/10", "*", "*", "*", "*"], "~/backup.sh");
  const x0 = PAD + 40, x1 = W - PAD - 40;
  const mx = (m) => x0 + ((x1 - x0) * m) / 60;
  s += `<line x1="${x0}" y1="${AXIS_Y}" x2="${x1}" y2="${AXIS_Y}" stroke="${C.line}" stroke-width="2"/>`;
  for (let m = 0; m <= 60; m += 5) s += `<line x1="${mx(m)}" y1="${AXIS_Y - 5}" x2="${mx(m)}" y2="${AXIS_Y + 5}" stroke="${C.line}" stroke-width="1.5"/>`;
  for (let m = 0; m <= 60; m += 10) {
    s += `<circle cx="${mx(m)}" cy="${AXIS_Y}" r="8" fill="${C.x}"/>`;
    s += code(mx(m), AXIS_Y + 26, m === 60 ? "10:00" : `09:${String(m).padStart(2, "0")}`, { anchor: "middle", color: C.ink, weight: 600, size: FS });
  }
  // 0 7 * * 1-5: 07:00 on Monday to Friday.
  s += cronLine(PAD, B_Y, ["0", "7", "*", "*", "1-5"], "~/backup.sh");
  const names = tr(v, words.days).split(" ");
  const numbers = ["1", "2", "3", "4", "5", "6", "0 7"];
  const dw = (W - 2 * PAD) / 7;
  names.forEach((name, i) => {
    const x = isRtl(v) ? W - PAD - (i + 1) * dw : PAD + i * dw; // in Arabic the week reads from the right
    const on = i < 5;
    s += `<rect x="${x + 3}" y="${WEEK_Y}" width="${dw - 6}" height="${DAY_H}" rx="6" fill="${on ? C.accent2Soft : "#ffffff"}" stroke="${on ? C.accent2 : C.boxStroke}" stroke-width="1.5"/>`;
    s += label(v, x + dw / 2, WEEK_Y + 22, name, { anchor: "middle", weight: 700, color: on ? C.ink : C.muted, fit: dw - 8 });
    s += code(x + dw / 2, WEEK_Y + 50, numbers[i], { anchor: "middle", weight: 800, color: on ? C.accent2 : C.line });
    if (on) s += `<rect x="${x + 10}" y="${WEEK_Y + 68}" width="${dw - 20}" height="32" rx="6" fill="#ffffff" stroke="${C.accent}" stroke-width="1.5"/>` + code(x + dw / 2, WEEK_Y + 84, "07:00", { anchor: "middle", weight: 700, color: C.accent });
  });
  return svg(height, s);
}
