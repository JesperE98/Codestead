// Shared by the pictures of "Redirection and pipes": the three streams as pipes (stdin blue, stdout green, stderr red),
// a keyboard, a screen, a program and a file, and the words for them.
import { C, FS, file, label, textWidth } from "./style.mjs";

export const STREAM = { 0: C.z, 1: C.y, 2: C.x };
export const PIPE = 7; // a stream's width

export const words = {
  keyboard: { en: "keyboard", sv: "tangentbord", de: "Tastatur", fr: "clavier", es: "teclado", pt: "teclado", ru: "клавиатура", zh: "键盘", ja: "キーボード", ar: "لوحة المفاتيح", hi: "keyboard" },
  screen: { en: "screen", sv: "skärm", de: "Bildschirm", fr: "écran", es: "pantalla", pt: "tela", ru: "экран", zh: "屏幕", ja: "画面", ar: "الشاشة", hi: "screen" },
  program: { en: "program", sv: "program", de: "Programm", fr: "programme", es: "programa", pt: "programa", ru: "программа", zh: "程序", ja: "プログラム", ar: "البرنامج", hi: "program" },
  empty: { en: "empty", sv: "tom", de: "leer", fr: "vide", es: "vacío", pt: "vazio", ru: "пустой", zh: "空的", ja: "空", ar: "فارغ", hi: "खाली" },
};

/** A stream as a thick pipe along an SVG path, with an arrow head at its end ((tx, ty) is the direction there). */
export function pipe(d, n, endX, endY, tx, ty) {
  const color = STREAM[n];
  const len = Math.hypot(tx, ty) || 1;
  const ux = tx / len, uy = ty / len;
  const l = 16, h = 10;
  const bx = endX - ux * l, by = endY - uy * l;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${PIPE}" stroke-linecap="butt" stroke-linejoin="round" opacity="0.9"/>` +
    `<path d="M${endX},${endY} L${bx - uy * h},${by + ux * h} L${bx + uy * h},${by - ux * h} Z" fill="${color}"/>`;
}

/** The stream's number and name on a white pill, e.g. "1 stdout". */
export function streamTag(x, y, n, anchor = "middle") {
  const s = `${n} ${["stdin", "stdout", "stderr"][n]}`;
  const w = textWidth(s, FS, true) + 18;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - 15}" width="${w}" height="30" rx="15" fill="#ffffff" stroke="${STREAM[n]}" stroke-width="1.5"/>` +
    `<text x="${x0 + w / 2}" y="${y}" font-size="${FS}" font-weight="700" fill="${STREAM[n]}" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono', monospace" style="white-space:pre">${s}</text>`;
}

/** A screen (a monitor) with its top left corner at (x, y), w × h, and its word under it. */
export function screen(v, x, y, w, h, word, inside = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#0f1318" stroke="#30363d" stroke-width="2"/>` + inside +
    `<path d="M${x + w / 2 - 14},${y + h} l-6,12 h40 l-6,-12 z" fill="#8a93a3"/>` +
    `<rect x="${x + w / 2 - 30}" y="${y + h + 11}" width="60" height="5" rx="2" fill="#8a93a3"/>` +
    label(v, x + w / 2, y + h + 34, word, { anchor: "middle", color: C.muted, weight: 600 });
}

/** A keyboard with its top left corner at (x, y), w wide, and its word under it. */
export function keyboard(v, x, y, w, word) {
  const h = 46;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  const keys = 7, kw = (w - 16) / keys;
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < keys - (r === 2 ? 2 : 0); k++) s += `<rect x="${x + 8 + k * kw + (r === 2 ? kw : 0) + 1}" y="${y + 6 + r * 12}" width="${kw - 3}" height="9" rx="2" fill="${C.grid}"/>`;
  return s + label(v, x + w / 2, y + h + 20, word, { anchor: "middle", color: C.muted, weight: 600 });
}

/** A file: its symbol and name in a white box, at (x, y) its left middle; `note` after the name (e.g. "empty"). */
export function fileBox(v, x, y, name, note = null) {
  const nameW = textWidth(name, FS, true);
  const w = nameW + 50 + (note ? textWidth(note, FS) + 14 : 0);
  return `<rect x="${x}" y="${y - 20}" width="${w}" height="40" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>` +
    file(x + 10, y - 10) +
    `<text x="${x + 36}" y="${y}" font-size="${FS}" font-weight="600" fill="${C.ink}" dominant-baseline="central" font-family="'JetBrains Mono', monospace">${name}</text>` +
    (note ? label(v, x + 36 + nameW + 12, y, `(${note})`, { color: C.muted, visual: true }) : "");
}
