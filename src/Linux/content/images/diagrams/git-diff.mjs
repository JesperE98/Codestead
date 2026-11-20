// Git in the terminal: what git diff compares. git diff shows the changes in the working tree that are not in the index
// yet; git diff --staged shows what is in the index, waiting to be committed, compared with the latest commit.
import { C, PAD, W, perLanguage, svg } from "./style.mjs";
import { cmd } from "./_distro.mjs";
import { ROWH, areas, areasHeight, rowY, words as gitWords } from "./_git.mjs";

export const variants = perLanguage("git-diff");

export const words = { ...gitWords };

export const height = areasHeight;

const RESERVE = 262; // the brackets and the commands, at the end side

export function draw(v) {
  const a = areas(v, { end: RESERVE, short: true });
  let s = a.svg;
  const pairs = [["git diff", 0, 1, C.accent2], ["git diff --staged", 1, 2, C.z]];
  pairs.forEach(([command, r0, r1, color], i) => {
    const y0 = rowY(r0) + ROWH / 2 + (i === 1 ? 6 : 0), y1 = rowY(r1) + ROWH / 2 - (i === 0 ? 6 : 0);
    const bx = a.rtl ? a.rowX - 16 : a.rowX + a.rowW + 16; // the bracket's spine
    const d = a.rtl ? 10 : -10;
    s += `<path d="M${bx + d},${y0} H${bx} V${y1} H${bx + d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
    const c = cmd(0, 0, command);
    const cx = a.rtl ? bx - 14 - c.w : bx + 14;
    s += cmd(cx, (y0 + y1) / 2, command, { color: color === C.z ? "#9ec1ff" : "#c7b3f5" }).svg;
  });
  void PAD; void W;
  return svg(height, s);
}
