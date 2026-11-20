// systemd: start and enable are two different things – for a stopped service that is not enabled, what start, enable
// and enable --now give now and after a reboot (the states as systemctl is-active prints them, with status's dots).
import { C, FS, MONO, PAD, W, arcArrow, isRtl, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { strip } from "./_admin.mjs";

export const variants = perLanguage("start-enable");

export const words = {
  now: { en: "now", sv: "nu", de: "jetzt", fr: "maintenant", es: "ahora", pt: "agora", ru: "сейчас", zh: "现在", ja: "いま", ar: "الآن", hi: "अभी" },
  // \n where the words need two lines.
  after: { en: "after a reboot", sv: "efter omstart", de: "nach einem\nNeustart", fr: "après un\nredémarrage", es: "después de\nreiniciar", pt: "depois de\nreiniciar", ru: "после\nперезагрузки", zh: "重启之后", ja: "再起動後", ar: "بعد إعادة\nالتشغيل", hi: "reboot के बाद" },
};

const ROWS = [
  ["systemctl start myserver", true, false],
  ["systemctl enable myserver", false, true],
  ["systemctl enable --now myserver", true, true],
];
const HEAD = 84; // the column titles (two lines) and the reboot
const ROW = 58;
const STRIP_W = textWidth(ROWS[2][0], FS, true) + 28;
export const height = PAD + HEAD + ROWS.length * ROW + PAD - 4;

/** A state as `systemctl status` and `is-active` show it: ● active (green) or ○ inactive (grey). */
function state(x, y, on) {
  const color = on ? C.y : C.muted;
  const dot = on ? `<circle cx="${x - 50}" cy="${y}" r="8" fill="${color}"/>` : `<circle cx="${x - 50}" cy="${y}" r="7" fill="none" stroke="${color}" stroke-width="2"/>`;
  return dot + `<text x="${x - 36}" y="${y}" font-size="${FS}" font-weight="${on ? 700 : 500}" fill="${color}" dominant-baseline="central" font-family="${MONO}">${on ? "active" : "inactive"}</text>`;
}

export function draw(v) {
  const rtl = isRtl(v);
  // The commands on the start side, the two columns after them (in Arabic: "now" on the right, as the text reads).
  const sx = rtl ? W - PAD - STRIP_W : PAD;
  const free0 = rtl ? PAD : PAD + STRIP_W + 16, free1 = rtl ? W - PAD - STRIP_W - 16 : W - PAD;
  const colW = (free1 - free0) / 2;
  const colX = (i) => (rtl ? free1 - colW * (i + 1) : free0 + colW * i);
  let s = "";
  // The column titles, and between the columns the reboot.
  [tr(v, words.now), tr(v, words.after)].forEach((t, i) => {
    const lines = t.split("\n");
    lines.forEach((l, j) => (s += label(v, colX(i) + colW / 2, PAD + 26 + (j - (lines.length - 1) / 2) * 24, l, { anchor: "middle", weight: 700, fit: colW - 8 })));
  });
  const mid = rtl ? colX(0) : colX(1);
  const iy = PAD + HEAD - 20;
  s += `<line x1="${mid}" y1="${iy}" x2="${mid}" y2="${height - PAD + 4}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<circle cx="${mid}" cy="${iy}" r="15" fill="${C.card}"/>` + arcArrow(mid, iy, 10, 120, 400, { color: C.accent, width: 2.5 });
  ROWS.forEach(([cmd, now, after], i) => {
    const y = PAD + HEAD + i * ROW + ROW / 2;
    if (i > 0) s += `<line x1="${PAD}" y1="${y - ROW / 2}" x2="${W - PAD}" y2="${y - ROW / 2}" stroke="${C.grid}" stroke-width="1"/>`;
    s += strip(sx, y, cmd, { w: STRIP_W }).svg;
    [now, after].forEach((on, c) => (s += state(colX(c) + colW / 2, y, on)));
  });
  return svg(height, s);
}
