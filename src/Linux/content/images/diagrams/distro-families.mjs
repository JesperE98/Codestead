// Distributions and families: the three families as neutral badges (never logos), the distributions in each and what
// they are built on (Ubuntu on Debian, Linux Mint on Ubuntu …), and each family's package manager and package format.
import { C, FAMILY, FS, PAD, W, isRtl, perLanguage, svg, text, tr } from "./style.mjs";
import { cmd, famBadge, fileChip, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("distro-families");

export const words = { debian: distroWords.debian, arch: distroWords.arch, redhat: distroWords.redhat };

const FAMILIES = [
  { id: "debian", tree: [["Debian", 0], ["Ubuntu", 1], ["Linux Mint", 2]], pm: "apt", format: ".deb" },
  { id: "arch", tree: [["Arch Linux", 0], ["Manjaro", 1], ["EndeavourOS", 1]], pm: "pacman", format: ".pkg.tar.zst" },
  { id: "redhat", tree: [["Fedora", 0], ["RHEL", 1], ["Rocky Linux", 2], ["AlmaLinux", 2]], pm: "dnf", format: ".rpm" },
];

const GAP = 12;
const COL = (W - 2 * PAD - 2 * GAP) / 3;
const ROW = 36, INDENT = 24;
const TREE_Y = PAD + 62;
const CHIPS_Y = TREE_Y + 4 * ROW + 26;
export const height = CHIPS_Y + 12 + 44 + 18 + 14 + PAD;

function column(v, x, f) {
  const color = FAMILY[f.id];
  let s = `<rect x="${x}" y="${PAD}" width="${COL}" height="${height - 2 * PAD}" rx="8" fill="#ffffff" stroke="${color}" stroke-opacity="0.55" stroke-width="1.5"/>`;
  s += famBadge(v, x + COL / 2, PAD + 26, f.id, tr(v, words[f.id]), { anchor: "middle" });
  // The distributions: each under the one it is built on.
  const rows = f.tree.map(([name, depth], i) => ({ name, depth, x: x + 18 + depth * INDENT, y: TREE_Y + i * ROW + ROW / 2 }));
  rows.forEach((r, i) => {
    if (r.depth > 0) {
      let p = i - 1;
      while (rows[p].depth >= r.depth) p--;
      s += `<path d="M${rows[p].x + 7},${rows[p].y + 12} V${r.y} H${r.x - 3}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`;
    }
    s += `<circle cx="${r.x + 3}" cy="${r.y}" r="4" fill="${color}"/>`;
    s += text(r.x + 13, r.y, r.name, { size: FS, weight: r.depth === 0 ? 700 : 550, color: C.ink, fit: x + COL - 8 - (r.x + 13) });
  });
  // The package manager (a command) and the package format (a file).
  s += `<line x1="${x + 14}" y1="${CHIPS_Y - 14}" x2="${x + COL - 14}" y2="${CHIPS_Y - 14}" stroke="${C.grid}" stroke-width="1"/>`;
  s += cmd(x + COL / 2, CHIPS_Y + 12, f.pm, { anchor: "middle" }).svg;
  s += fileChip(x + COL / 2, CHIPS_Y + 12 + 44, f.format, { anchor: "middle" }).svg;
  return s;
}

export function draw(v) {
  const order = isRtl(v) ? [...FAMILIES].reverse() : FAMILIES;
  return svg(height, order.map((f, i) => column(v, PAD + i * (COL + GAP), f)).join(""));
}
