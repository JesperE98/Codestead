// Git in the terminal: your repository and its remote, origin (a bare repository on a server such as GitHub: only the
// history, no working tree). git push sends your new commits there, git fetch fetches new commits into your history
// without touching your files, and git pull fetches and merges them into your working tree too.
import { C, FS, PAD, W, arrow, box, code, file, folder, isRtl, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { cmd, computer, server } from "./_distro.mjs";
import { words as gitWords } from "./_git.mjs";

export const variants = perLanguage("git-remote");

export const words = {
  computer: { en: "Your computer", sv: "Din dator", de: "Dein Computer", fr: "Votre ordinateur", es: "Tu ordenador", pt: "Seu computador", ru: "Ваш компьютер", zh: "你的计算机", ja: "あなたのコンピューター", ar: "حاسوبك", hi: "आपका कंप्यूटर" },
  workingTree: gitWords.workingTree,
  history: gitWords.history,
};

const LW = 280, RW = 236; // the two sides
const WT_Y = PAD + 64, WT_H = 70; // the working tree
const GIT_Y = WT_Y + WT_H + 14, GIT_H = 120; // the history
export const height = GIT_Y + GIT_H + 14 + PAD;

/** Three commits in a row from x (left to right), at y. */
function commits(x, y, n, newOne = false) {
  let s = `<line x1="${x}" y1="${y}" x2="${x + (n - 1) * 34}" y2="${y}" stroke="${C.line}" stroke-width="2.5"/>`;
  for (let i = 0; i < n; i++) {
    const fresh = newOne && i === n - 1;
    s += `<circle cx="${x + i * 34}" cy="${y}" r="10" fill="${fresh ? C.accentSoft : "#ffffff"}" stroke="${fresh ? C.accent : C.muted}" stroke-width="3"/>`;
  }
  return s;
}

export function draw(v) {
  const rtl = isRtl(v);
  const n = world(v.lang).names;
  const lx = rtl ? W - PAD - LW : PAD, rx = rtl ? PAD : W - PAD - RW;
  const at = (bx, bw, dx, w = 0) => (rtl ? bx + bw - dx - w : bx + dx);
  let s = "";
  // Your repository: a working tree and the history in .git.
  s += box(lx, PAD, LW, height - 2 * PAD, { fill: "#ffffff" });
  s += computer(at(lx, LW, 14, 34), PAD + 12, 34, 22);
  s += label(v, at(lx, LW, 58), PAD + 24, tr(v, words.computer), { weight: 700, fit: LW - 70 });
  const dir = `~/${n.webProject}/`;
  s += code(at(lx, LW, 58, textWidth(dir, FS, true)), PAD + 48, dir, { color: C.muted, weight: 600 });
  s += box(lx + 12, WT_Y, LW - 24, WT_H, { style: "y" });
  s += label(v, at(lx + 12, LW - 24, 12), WT_Y + 20, tr(v, words.workingTree), { weight: 700, fit: LW - 48 });
  for (let i = 0; i < 3; i++) s += file(at(lx + 12, LW - 24, 14 + i * 26, 16), WT_Y + 38);
  s += box(lx + 12, GIT_Y, LW - 24, GIT_H, { style: "z" });
  s += label(v, at(lx + 12, LW - 24, 12), GIT_Y + 20, tr(v, words.history), { weight: 700, fit: LW - 120 });
  s += code(at(lx + 12, LW - 24, 12 + textWidth(tr(v, words.history), FS) + 10, 46), GIT_Y + 20, ".git", { color: C.muted, weight: 600 });
  s += commits(at(lx + 12, LW - 24, 22, 2 * 34), GIT_Y + 56, 3, true);
  // origin: a bare repository on a server – only the history.
  s += box(rx, PAD, RW, height - 2 * PAD, { fill: "#ffffff" });
  s += server(at(rx, RW, 14, 30), PAD + 10, 30, 30);
  s += code(at(rx, RW, 54, textWidth("origin", 21, true)), PAD + 24, "origin", { weight: 700, size: 21 });
  s += label(v, at(rx, RW, 54), PAD + 48, "GitHub · GitLab", { color: C.muted, weight: 600, ltr: true, anchor: rtl ? "end" : "start", fit: RW - 64 });
  s += box(rx + 12, WT_Y, RW - 24, WT_H + 14 + GIT_H, { style: "z" });
  s += label(v, at(rx + 12, RW - 24, 12), WT_Y + 20, tr(v, words.history), { weight: 700, fit: RW - 48 });
  s += code(at(rx + 12, RW - 24, 12, 46), WT_Y + 48, ".git", { color: C.muted, weight: 600, anchor: rtl ? "end" : "start" });
  s += commits(at(rx + 12, RW - 24, 22, 34), WT_Y + 90, 2); // the new commit is not there until git push
  // The commands between them.
  const mid = rtl ? (rx + RW + lx) / 2 : (lx + LW + rx) / 2;
  const lanes = [
    ["git pull", WT_Y + WT_H / 2, "toLocal", C.good, rtl ? lx + 12 - 2 : lx + LW - 12 + 2],
    ["git push", GIT_Y + 36, "toServer", C.accent, null],
    ["git fetch", GIT_Y + 90, "toLocal", C.z, rtl ? lx + 12 - 2 : lx + LW - 12 + 2],
  ];
  for (const [command, y, dir2, color, localEnd] of lanes) {
    const from = dir2 === "toServer" ? (rtl ? lx + 12 - 2 : lx + LW - 12 + 2) : rtl ? rx + RW - 12 + 2 : rx + 12 - 2;
    const to = dir2 === "toServer" ? (rtl ? rx + RW - 12 + 2 : rx + 12 - 2) : localEnd;
    s += arrow(from, y, to, y, { color, width: 2.5 });
    s += cmd(mid, y, command, { anchor: "middle", color: "#e6edf3" }).svg;
  }
  return svg(height, s);
}
