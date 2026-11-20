// Text processing: the parts of sed's s command (the chapter's s/PATTERN/REPLACEMENT/FLAGS in the variant's language)
// and the chapter's example in the simulator – without g only the first cat on the line is replaced, with g every one.
// (After the question in the text: it shows the answer.)
import { C, FS, MONO, PAD, W, esc, perLanguage, svg, terminal, textWidth } from "./style.mjs";
import { chapterLine } from "./_admin.mjs";

export const variants = perLanguage("sed-substitute");

export const terminals = { sed: { commands: [`echo "cat cat cat" | sed 's/cat/dog/'`, `echo "cat cat cat" | sed 's/cat/dog/g'`] } };

const COLORS = [C.accent, C.y, C.accent2]; // the pattern, the replacement, the flags
const FORM_Y = PAD + 30;
const TERM_Y = FORM_Y + 44;
export const height = (v, R) => TERM_Y + terminal(0, 0, W, R.sed.lines).height + PAD;

export function draw(v, R) {
  // The form, as the chapter writes it: s / PATTERN / REPLACEMENT / FLAGS, each part in its colour.
  const form = chapterLine(v, "textbearbetning", /^s\/[^/ ]+\/[^/ ]+\/[^/ ]+$/);
  const parts = form.split("/");
  const size = FS + 5;
  const total = textWidth(form, size, true);
  let s = "";
  let x = (W - total) / 2;
  parts.forEach((p, i) => {
    if (i > 0) {
      s += `<text x="${x}" y="${FORM_Y}" font-size="${size}" font-weight="700" fill="${C.muted}" dominant-baseline="central" font-family="${MONO}">/</text>`;
      x += textWidth("/", size, true);
    }
    const color = i === 0 ? C.ink : COLORS[i - 1];
    const w = textWidth(p, size, true);
    if (i > 0) s += `<rect x="${x - 3}" y="${FORM_Y + 15}" width="${w + 6}" height="3" fill="${color}"/>`;
    s += `<text x="${x}" y="${FORM_Y}" font-size="${size}" font-weight="700" fill="${color}" dominant-baseline="central" font-family="${MONO}" direction="ltr">${esc(p)}</text>`;
    x += w;
  });
  // The two commands and what they print: the same colours on cat, dog and g, and on what was replaced.
  const lines = R.sed.lines;
  const rows = [];
  for (const l of lines) {
    rows.push(l.prompt.map((r) => r.text).join("") + l.typed);
    for (const o of l.output) rows.push(o.map((r) => r.text).join(""));
  }
  const marks = [];
  rows.forEach((row, i) => {
    const sAt = row.indexOf("'s/");
    if (sAt >= 0) {
      marks.push({ row: i, col: sAt + 3, len: 3, color: COLORS[0], opacity: 0.5 });
      marks.push({ row: i, col: sAt + 7, len: 3, color: COLORS[1], opacity: 0.5 });
      if (row.endsWith("/g'")) marks.push({ row: i, col: row.length - 2, len: 1, color: COLORS[2], opacity: 0.7 });
    } else {
      for (let c = row.indexOf("dog"); c >= 0; c = row.indexOf("dog", c + 1)) marks.push({ row: i, col: c, len: 3, color: COLORS[1], opacity: 0.5 });
    }
  });
  s += terminal(PAD, TERM_Y, W - 2 * PAD, lines, { marks }).svg;
  return svg(height(v, R), s);
}
