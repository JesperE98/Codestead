// The Red Hat family: what dnf copr enable, disable and remove do to the repository's file in /etc/yum.repos.d/ and
// whether dnf repolist shows the repository – enable writes the file with enabled=1, disable keeps it with enabled=0,
// remove deletes it. The file's name and its enabled= line are the simulator's. No words: one picture for every language.
import { C, FS, MONO, PAD, W, box, code, esc, folder, shared, svg, textWidth } from "./style.mjs";
import { cmd, famBadge, famBadgeWidth, fileChip, verdict } from "./_distro.mjs";

export const variants = shared("copr-states");

const FILE = "_copr:…:moonphase.repo";
const ROWS = [
  { command: "sudo dnf copr enable lunatool/moonphase", state: "enabled=1", listed: true },
  { command: "sudo dnf copr disable lunatool/moonphase", state: "enabled=0", listed: false },
  { command: "sudo dnf copr remove lunatool/moonphase", state: null, listed: false },
];
const TOP = PAD + 44;
const HEAD = 34;
const ROWH = 100;
export const height = TOP + HEAD + ROWS.length * ROWH + PAD - 10;

export function draw() {
  let s = famBadge({ lang: "en" }, PAD, PAD + 14, "redhat", "Red Hat");
  const listX = W - PAD - 80; // the dnf repolist column's middle
  // The column heads: the directory and dnf repolist.
  const hy = TOP + HEAD / 2;
  s += folder(PAD + 14, hy - 9) + code(PAD + 46, hy, "/etc/yum.repos.d/", { weight: 650, color: C.muted });
  s += code(listX, hy, "dnf repolist", { anchor: "middle", weight: 650, color: C.muted });
  ROWS.forEach((r, i) => {
    const y = TOP + HEAD + i * ROWH;
    if (i > 0) s += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`;
    s += cmd(PAD, y + 28, r.command).svg;
    const fy = y + 74;
    if (r.state === null) {
      // Removed: the file is gone.
      const f = fileChip(PAD + 14, fy, FILE, { style: "muted", dash: "5 4", strike: true });
      s += f.svg;
      s += `<path d="M${f.x + f.w + 12},${fy - 10} l20,20 M${f.x + f.w + 32},${fy - 10} l-20,20" stroke="${C.bad}" stroke-width="3" stroke-linecap="round"/>`;
    } else {
      const on = r.listed;
      const f = fileChip(PAD + 14, fy, FILE, on ? { style: "accent2" } : {});
      s += f.svg;
      const tw = textWidth(r.state, FS, true) + 20;
      const tx = f.x + f.w + 12;
      s += `<rect x="${tx}" y="${fy - 15}" width="${tw}" height="30" rx="5" fill="${on ? C.ySoft : C.xSoft}" stroke="${on ? C.good : C.bad}" stroke-width="1.5"/>`;
      s += `<text x="${tx + tw / 2}" y="${fy}" font-size="${FS}" font-weight="650" fill="${C.ink}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">${esc(r.state)}</text>`;
    }
    s += verdict(listX, y + ROWH / 2 + 4, r.listed, 16);
  });
  // The repolist column: a white band behind its head and the verdicts.
  return svg(height, box(listX - 80, TOP, 160, height - PAD - TOP + 2, { fill: "#ffffff", stroke: C.grid }) + s);
}
