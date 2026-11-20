// Disks and file systems: disk, partition, file system and mount point on the simulator's two disks, as lsblk -f
// shows them – sda with the EFI partition, the root file system and swap, and the USB stick sdb with one FAT partition
// that is not mounted yet.
import { C, PAD, W, box, code, isRtl, label, perLanguage, svg, tr } from "./style.mjs";
import { chip, chipWidth } from "./_admin.mjs";

export const variants = perLanguage("disk-layout");

export const words = {
  // \n where the words need two lines.
  disk: { en: "disk", sv: "disk", de: "Datenträger", fr: "disque", es: "disco", pt: "disco", ru: "диск", zh: "磁盘", ja: "ディスク", ar: "القرص", hi: "disk" },
  partition: { en: "partition", sv: "partition", de: "Partition", fr: "partition", es: "partición", pt: "partição", ru: "раздел", zh: "分区", ja: "パーティション", ar: "القسم", hi: "partition" },
  fs: { en: "file system", sv: "filsystem", de: "Dateisystem", fr: "système de\nfichiers", es: "sistema de\narchivos", pt: "sistema de\narquivos", ru: "файловая\nсистема", zh: "文件系统", ja: "ファイル\nシステム", ar: "نظام الملفات", hi: "file system" },
  mountPoint: { en: "mount point", sv: "monterings-\npunkt", de: "Mountpunkt", fr: "point de\nmontage", es: "punto de\nmontaje", pt: "ponto de\nmontagem", ru: "точка\nмонтирования", zh: "挂载点", ja: "マウント\nポイント", ar: "نقطة التركيب", hi: "mount point" },
};

export const terminals = { lsblk: { commands: ["lsblk", "lsblk -f"] } };

const WORD_W = 150; // the words' column
const ROWS = { disk: 26, partition: 70, fs: 116, mountPoint: 196 }; // the rows' middles, from a disk's top
const DISK_H = 150;
const BLOCK = 246; // a disk and its mount points
export const height = PAD + 2 * BLOCK - 32 + PAD;

const FS_STYLE = { vfat: "accent", ext4: "z", swap: "muted" };

/** The disks from lsblk and lsblk -f: [{ name, size, removable, parts: [{ name, size, fstype, label, mount }] }]. */
function disks(R) {
  const text = (l) => l.output.map((row) => row.map((r) => r.text).join(""));
  const [plain, full] = R.lsblk.lines.map(text);
  const head = full[0];
  const col = (name) => head.indexOf(name);
  const result = [];
  plain.slice(1).forEach((row, i) => {
    const f = full[i + 1];
    const name = row.split(/\s+/)[0].replace(/^[├└]─/, "");
    const [, , rm, size] = row.trim().split(/\s+/);
    const cut = (a, b) => f.slice(col(a), b ? col(b) : undefined).trim();
    const item = { name, size, removable: rm === "1", fstype: cut("FSTYPE", "FSVER"), label: cut("LABEL", "UUID"), mount: cut("MOUNTPOINTS") };
    if (/^[├└]/.test(row)) result.at(-1).parts.push(item);
    else result.push({ ...item, parts: [] });
  });
  return result;
}

export function draw(v, R) {
  const rtl = isRtl(v);
  const dx0 = rtl ? PAD : PAD + WORD_W + 14, dx1 = rtl ? W - PAD - WORD_W - 14 : W - PAD;
  const wx = rtl ? W - PAD : PAD;
  let s = "";
  disks(R).forEach((d, i) => {
    const y = PAD + i * BLOCK;
    // The words, one per row, on the start side (beside the first disk).
    if (i === 0) for (const [key, dy] of Object.entries(ROWS)) {
      const lines = tr(v, words[key]).split("\n");
      lines.forEach((l, j) => (s += label(v, wx, y + dy + (j - (lines.length - 1) / 2) * 23, l, { weight: 600, color: C.muted, fit: WORD_W })));
    }
    // The disk, with its name and size.
    s += box(dx0, y, dx1 - dx0, DISK_H, { style: "muted", r: 10, width: 2 });
    s += code(dx0 + 16, y + ROWS.disk, d.name, { weight: 800 }) + code(dx0 + 16 + chipWidth(d.name) - 6, y + ROWS.disk, d.size, { color: C.muted });
    // The partitions: the big one gets what the small ones leave.
    const inner = dx1 - dx0 - 24, gap = 10, small = 128;
    const widths = d.parts.length === 1 ? [inner] : d.parts.map((p) => (p.size === d.parts.reduce((a, b) => (parseFloat(a.size) > parseFloat(b.size) ? a : b)).size ? inner - (d.parts.length - 1) * (small + gap) : small));
    let px = dx0 + 12;
    d.parts.forEach((p, j) => {
      const pw = widths[j];
      s += box(px, y + 46, pw, DISK_H - 58, { style: "plain" });
      s += code(px + 12, y + ROWS.partition, p.name, { weight: 700 }) + code(px + pw - 12, y + ROWS.partition, p.size, { anchor: "end", color: C.muted });
      // The file system: what is inside the partition.
      const fsText = p.label ? `${p.fstype} ${p.label}` : p.fstype;
      s += chip(px + 8, y + ROWS.fs, fsText, { style: FS_STYLE[p.fstype] ?? "plain", w: pw - 16, h: 38 });
      // The mount point, under the disk – or a dashed empty place when it is not mounted.
      const cx = px + pw / 2;
      s += `<line x1="${cx}" y1="${y + DISK_H - 12}" x2="${cx}" y2="${y + ROWS.mountPoint - 18}" stroke="${C.line}" stroke-width="1.5"${p.mount ? "" : ` stroke-dasharray="4 3"`}/>`;
      s += p.mount ? chip(cx, y + ROWS.mountPoint, p.mount, { anchor: "middle", style: p.mount === "[SWAP]" ? "grey" : "plain" }) : chip(cx, y + ROWS.mountPoint, "   ", { anchor: "middle", style: "muted", w: 60 });
      px += pw + gap;
    });
  });
  return svg(height, s);
}

