// Git in the terminal: the three places a change passes through. README.md is changed in the working tree, git add puts
// it in the index, and git commit saves the index as a new commit in the history (.git). The files are the chapter's
// web project's, the commit ids the chapter's examples.
import { C, perLanguage, svg, tr } from "./style.mjs";
import { cmd } from "./_distro.mjs";
import { GAPH, ROWH, areas, areasHeight, rowY, words as gitWords } from "./_git.mjs";
import { arrow } from "./style.mjs";

export const variants = perLanguage("git-areas");

export const words = { ...gitWords };

export const height = areasHeight;

export function draw(v) {
  const a = areas(v, { newCommit: true });
  let s = a.svg;
  // The commands between the rows.
  [["git add README.md", C.accent], ['git commit -m "…"', C.accent]].forEach(([command, color], i) => {
    const y0 = rowY(i) + ROWH, y1 = rowY(i + 1), my = (y0 + y1) / 2;
    const ax = a.at(44);
    s += arrow(ax, y0 + 4, ax, y1 - 4, { color, width: 2.5 });
    const c = cmd(0, 0, command);
    s += cmd(a.at(66, c.w), my, command).svg;
  });
  void tr; void GAPH;
  return svg(height, s);
}
