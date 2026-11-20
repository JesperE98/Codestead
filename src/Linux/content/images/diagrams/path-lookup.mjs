// Variables, PATH and aliases: how the shell finds ls. PATH (the simulator's own, from echo $PATH) is a list of
// directories separated by colons; the shell looks in them in order and runs the first ls it finds, /usr/bin/ls – so
// it never looks in /bin. Paths and commands only: no words.
import { C, FS, PAD, W, arrow, badge, code, folder, perLanguage, svg, terminal } from "./style.mjs";
import { mark } from "./_system.mjs";

export const variants = perLanguage("path-lookup");

export const terminals = { path: { commands: ["echo $PATH"] } };

/** The directories' contents shown (a few names that are really there in the simulator). */
const CONTENTS = { "/usr/local/bin": ["myserver"], "/usr/bin": ["cat", "ls", "nano"], "/bin": [] };
const COLORS = [C.z, C.accent, C.line];
const BW = 212, BGAP = (W - 2 * PAD - 3 * BW) / 2;
const termHeight = (R) => terminal(0, 0, W, R.path.lines).height;
const boxTop = (R) => PAD + termHeight(R) + 74;
const BOX_H = 150;
export const height = (v, R) => boxTop(R) + BOX_H + 60 + PAD;

export function draw(v, R) {
  const t = terminal(PAD, PAD, W - 2 * PAD, R.path.lines, {});
  const value = R.path.lines[0].output[0].map((r) => r.text).join("");
  const dirs = value.split(":");
  if (dirs.join() !== Object.keys(CONTENTS).join()) throw new Error(`PATH is ${value}`);
  // Each directory of PATH marked in the terminal, with its number under it.
  let col = 0;
  const marks = [], centres = [];
  dirs.forEach((d, i) => {
    marks.push({ row: 1, col, len: d.length, color: COLORS[i], opacity: 0.45 });
    centres.push((t.colX(col) + t.colX(col + d.length)) / 2);
    col += d.length + 1;
  });
  const term = terminal(PAD, PAD, W - 2 * PAD, R.path.lines, { marks });
  let s = term.svg;
  const top = boxTop(R);
  const ty = PAD + term.height;
  dirs.forEach((d, i) => {
    const bx = PAD + i * (BW + BGAP);
    const cx = bx + BW / 2;
    const color = COLORS[i];
    const searched = i < 2;
    // From the number under the terminal down to the directory.
    s += `<path d="M${centres[i]},${ty + 4} V${ty + 18} C${centres[i]},${ty + 40} ${cx},${ty + 30} ${cx},${top - 30}" fill="none" stroke="${color}" stroke-width="1.5"${searched ? "" : ` stroke-dasharray="4 3"`}/>`;
    s += badge(cx, top - 18, i + 1, { color, r: 16 });
    // The directory and what is in it; ls in /usr/bin is the one found.
    s += `<rect x="${bx}" y="${top}" width="${BW}" height="${BOX_H}" rx="6" fill="${searched ? "#ffffff" : C.card}" stroke="${searched ? color : C.boxStroke}" stroke-width="${searched ? 2 : 1.2}"${searched ? "" : ` stroke-dasharray="5 4"`}/>`;
    s += folder(bx + 12, top + 15, searched ? {} : { fill: C.card, stroke: C.line });
    s += code(bx + 42, top + 24, d, { weight: 700, color: searched ? C.ink : C.line, fit: BW - 46 });
    CONTENTS[d].forEach((name, k) => {
      const y = top + 64 + k * 33;
      const found = name === "ls";
      if (found) s += `<rect x="${bx + 30}" y="${y - 15}" width="${BW - 60}" height="30" rx="5" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2"/>`;
      s += code(bx + 44, y, name, { weight: found ? 700 : 500, color: found ? C.ink : C.muted });
    });
    // Under it: no ls here, ls found (/usr/bin/ls runs), and the one never looked in.
    const ry = top + BOX_H + 30;
    if (i === 0) s += code(cx - 10, ry, "ls", { anchor: "end", weight: 700 }) + mark(cx + 14, ry, false);
    if (i === 1) s += mark(bx + 24, ry, true) + code(bx + 44, ry, "/usr/bin/ls", { weight: 700, color: C.accent });
    if (i < 2) {
      const ax = bx + BW + 4;
      s += arrow(ax, top + BOX_H / 2, ax + BGAP - 8, top + BOX_H / 2, { color: i === 0 ? C.ink : C.line, width: 2, dash: i === 0 ? undefined : "4 3" });
    }
  });
  return svg(height(v, R), s);
}
