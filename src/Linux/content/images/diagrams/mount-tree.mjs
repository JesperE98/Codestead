// Disks and file systems: one tree, several file systems. The root file system (sda2) is mounted on /, the EFI partition
// (sda1) on /boot/efi, and after sudo mount the USB stick (sdb1) on /mnt/usb – its files (the simulator's, in the
// learner's language) appear there. No words: device names, types and paths.
import { C, PAD, W, perLanguage, svg, tree, world } from "./style.mjs";
import { chip, chipWidth, strip } from "./_admin.mjs";

export const variants = perLanguage("mount-tree");

export const terminals = { usb: { setup: ["sudo mkdir -p /mnt/usb", "sudo mount /dev/sdb1 /mnt/usb"], commands: ["ls /mnt/usb"] } };

const ROW = 38;
const TX = PAD + 18;
const TOP = PAD + 64; // under the command

function items(v, R) {
  const files = R.usb.lines[0].output.flatMap((row) => row.map((r) => r.text).join("").trim().split(/\s+/)).filter((f) => f !== "");
  return [
    { name: "/", depth: 0, bold: true, fs: "root" },
    { name: "boot", depth: 1 },
    { name: "efi", depth: 2, fs: "efi", color: C.accent, edge: C.accent },
    { name: "home", depth: 1 },
    { name: world(v.lang).names.user, depth: 2 },
    { name: "mnt", depth: 1 },
    { name: "usb", depth: 2, fs: "usb", color: C.accent2, edge: C.accent2 },
    ...files.map((f) => ({ name: f, depth: 3, file: true, edge: C.accent2 })),
  ];
}

export const height = (v, R) => TOP + items(v, R).length * ROW + PAD;

export function draw(v, R) {
  const list = items(v, R);
  const t = tree(TX, TOP, list, { row: ROW });
  const rowTop = (i) => TOP + i * ROW;
  let s = "";
  // The file systems as bands behind their part of the tree: the root file system everywhere, the others on top.
  const band = (from, to, fill, stroke) => `<rect x="${PAD}" y="${rowTop(from) + 2}" width="${W - 2 * PAD}" height="${(to - from + 1) * ROW - 4}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  s += band(0, list.length - 1, C.zSoft, C.z).replace('fill="', 'fill-opacity="0.5" fill="');
  const efi = list.findIndex((it) => it.fs === "efi"), usb = list.findIndex((it) => it.fs === "usb");
  s += band(efi, efi, C.accentSoft, C.accent);
  s += band(usb, list.length - 1, C.accent2Soft, C.accent2);
  s += t.svg;
  // Which file system is mounted where: the device and its type at the mount point's row.
  const dev = { root: ["/dev/sda2 ext4", "z"], efi: ["/dev/sda1 vfat", "accent"], usb: ["/dev/sdb1 vfat", "accent2"] };
  list.forEach((it, i) => {
    if (!it.fs) return;
    const [text, style] = dev[it.fs];
    const x = W - PAD - 14 - chipWidth(text);
    s += `<line x1="${t.rows[i].end + 10}" y1="${t.rows[i].y}" x2="${x - 6}" y2="${t.rows[i].y}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="2 4"/>`;
    s += chip(x, t.rows[i].y, text, { style });
  });
  // The command that mounted the stick, at the top.
  s += strip(PAD, PAD + 22, "sudo mount /dev/sdb1 /mnt/usb", { color: "#c9b3ff" }).svg;
  return svg(height(v, R), s);
}
