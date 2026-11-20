// Redirection and pipes: where stdout (1) and stderr (2) of `ls` with a missing directory go with >, 2> and > … 2>&1 –
// the chapter's question (> leaves the error on the screen and the file empty) and the two ways that catch the error.
import { C, FS, PAD, code, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { STREAM, fileBox, pipe, words as pipeWords } from "./_pipes.mjs";

export const variants = perLanguage("redirect");

export const words = {
  screen: pipeWords.screen,
  empty: pipeWords.empty,
  // The chapter's file name for the error messages in each language.
  errors: { en: "errors.txt", sv: "fel.txt", de: "fehler.txt", fr: "erreurs.txt", es: "errores.txt", pt: "erros.txt", ru: "errors.txt", zh: "errors.txt", ja: "errors.txt", ar: "errors.txt", hi: "errors.txt" },
};

const ROW = 126;
const STRIP_H = 92;
export const height = PAD + 3 * ROW - 18 + PAD;

/** A small screen with its word beside it; (x, y) is its left middle. */
function smallScreen(v, x, y, word, lines) {
  let s = `<rect x="${x}" y="${y - 24}" width="78" height="48" rx="5" fill="#0f1318" stroke="#30363d" stroke-width="2"/>`;
  lines.forEach((color, i) => (s += `<rect x="${x + 9}" y="${y - 14 + i * 14}" width="58" height="7" rx="2" fill="${color}"/>`));
  return s + label(v, x + 92, y, word, { visual: true, color: C.muted, weight: 600 });
}

export function draw(v) {
  const missing = world(v.lang).names.missing;
  const errors = tr(v, words.errors);
  const screenWord = tr(v, words.screen);
  const rows = [
    { cmd: `ls /${missing} > ${errors}`, out: ["file", errors, tr(v, words.empty)], err: ["screen"] },
    { cmd: `ls /${missing} 2> ${errors}`, out: ["screen"], err: ["file", errors] },
    { cmd: `ls /${missing} > t.txt 2>&1`, out: ["file", "t.txt"], err: ["join"] },
  ];
  const stripW = Math.max(...rows.map((r) => textWidth(r.cmd, FS, true))) + 26;
  const destX = PAD + stripW + 62;
  let s = "";
  rows.forEach((r, i) => {
    const y = PAD + i * ROW + STRIP_H / 2;
    const outY = y - 26, errY = y + 26;
    s += `<rect x="${PAD}" y="${y - STRIP_H / 2}" width="${stripW}" height="${STRIP_H}" rx="8" fill="#0f1318"/>`;
    s += code(PAD + 15, y, r.cmd, { color: "#e6edf3" });
    const from = PAD + stripW;
    // stdout: straight on to its file or the screen.
    s += pipe(`M${from},${outY} H${destX - 6}`, 1, destX - 6, outY, 1, 0);
    // stderr: on to its own place, or up into stdout (2>&1: where 1 goes).
    if (r.err[0] === "join") {
      const jx = from + 34;
      s += `<path d="M${from},${errY} H${jx - 10} Q${jx},${errY} ${jx},${errY - 10} V${outY + 4}" fill="none" stroke="${STREAM[2]}" stroke-width="7" opacity="0.9"/>`;
      s += code(jx + 12, errY + 4, "2>&1", { color: STREAM[2], weight: 700 });
    } else s += pipe(`M${from},${errY} H${destX - 6}`, 2, destX - 6, errY, 1, 0);
    // The streams' numbers, where they leave the command.
    s += `<circle cx="${from}" cy="${outY}" r="11" fill="#ffffff" stroke="${STREAM[1]}" stroke-width="2"/>` + code(from, outY, "1", { anchor: "middle", color: STREAM[1], weight: 800 });
    s += `<circle cx="${from}" cy="${errY}" r="11" fill="#ffffff" stroke="${STREAM[2]}" stroke-width="2"/>` + code(from, errY, "2", { anchor: "middle", color: STREAM[2], weight: 800 });
    // The destinations.
    const place = (d, yy, color) => (d[0] === "file" ? fileBox(v, destX, yy, d[1], d[2] ?? null) : smallScreen(v, destX, yy, screenWord, color));
    s += place(r.out, outY, []);
    if (r.err[0] !== "join") s += place(r.err, errY, [STREAM[2]]);
  });
  return svg(height, s);
}
