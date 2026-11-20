// Archives and compression: tar and gzip, each doing one thing. tar makes one file of the documents directory – bigger
// than the files, because every member gets a 512-byte header and the archive is padded out to whole blocks – and gzip
// makes that file small; tar -czf does both. The sizes are the simulator's (ls -l), drawn to scale.
import { C, FS, PAD, W, arrow, code, file, folder, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";

export const variants = perLanguage("tar-gzip");

export const words = {
  bytes: { en: "bytes", sv: "byte", de: "Bytes", fr: "octets", es: "bytes", pt: "bytes", ru: "байт", zh: "字节", ja: "バイト", ar: "بايت", hi: "bytes" },
};

export const terminals = {
  sizes: { commands: ["tar -cvf {{documents}}.tar {{documents}}", "tar -czf {{documents}}.tar.gz {{documents}}", "ls -l {{documents}} {{documents}}.tar {{documents}}.tar.gz"] },
};

const NAME_X = PAD + 4;
const BAR_X = 292, BAR_W = 250; // 10240 bytes
const ROW_H = 44, STEP = 104;
const Y0 = PAD + 26;
const FILE_COLORS = [C.y, C.z, C.accent2];
export const height = Y0 + 2 * STEP + 22 + PAD;

function sizes(R, n) {
  const [list, , ls] = R.sizes.lines;
  const order = list.output.map((r) => r.map((x) => x.text).join("")).filter((t) => !t.endsWith("/")).map((t) => t.split("/").pop());
  const size = new Map();
  for (const row of ls.output) {
    const m = /^\S+ +\d+ +\S+ +\S+ +(\d+) +\S+ +\d+ +[\d:]+ (.+)$/.exec(row.map((x) => x.text).join(""));
    if (m) size.set(m[2], Number(m[1]));
  }
  const files = order.map((name) => [name, size.get(name)]);
  return { files, tar: size.get(`${n.documents}.tar`), gz: size.get(`${n.documents}.tar.gz`) };
}

export function draw(v, R) {
  const n = world(v.lang).names;
  const { files, tar, gz } = sizes(R, n);
  // The archive's layout: a header per member (the directory and each file), each file's data in whole 512-byte
  // blocks, two empty blocks at the end, padded out to a multiple of 10240 bytes.
  const segments = [["header", 512]];
  for (const [name, size] of files) segments.push(["header", 512], [name, size], ["pad", Math.ceil(size / 512) * 512 - size]);
  let used = segments.reduce((a, [, b]) => a + b, 0) + 1024;
  segments.push(["pad", 1024 + Math.ceil(used / 10240) * 10240 - used]);
  used = segments.reduce((a, [, b]) => a + b, 0);
  if (used !== tar) throw new Error(`a tar archive of ${files} is ${used} bytes, the simulator's ${tar}`);
  const scale = BAR_W / tar;
  const bytes = tr(v, words.bytes);
  let s = "";
  const rows = [
    { y: Y0, icon: "dir", name: `${n.documents}/`, size: files.reduce((a, [, b]) => a + b, 0) },
    { y: Y0 + STEP, icon: "file", name: `${n.documents}.tar`, size: tar },
    { y: Y0 + 2 * STEP, icon: "file", name: `${n.documents}.tar.gz`, size: gz, accent: true },
  ];
  for (const r of rows) {
    s += r.icon === "dir" ? folder(NAME_X, r.y - 9) : file(NAME_X + 4, r.y - 10, r.accent ? { stroke: C.accent } : {});
    s += code(NAME_X + 32, r.y, r.name, { weight: 700, color: r.accent ? C.accent : C.ink, fit: BAR_X - NAME_X - 44 });
    // The bar: as wide as the size.
    const by = r.y - ROW_H / 2 + 8, bh = ROW_H - 16;
    if (r.icon === "dir") {
      let x = BAR_X;
      files.forEach(([, size], i) => {
        s += `<rect x="${x}" y="${by}" width="${size * scale}" height="${bh}" fill="${FILE_COLORS[i]}"/>`;
        x += size * scale;
      });
    } else if (!r.accent) {
      s += `<rect x="${BAR_X}" y="${by}" width="${BAR_W}" height="${bh}" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1"/>`;
      let x = BAR_X;
      let f = 0;
      for (const [kind, size] of segments) {
        const color = kind === "header" ? C.line : kind === "pad" ? null : FILE_COLORS[f++];
        if (color) s += `<rect x="${x}" y="${by}" width="${Math.max(size * scale, 1.5)}" height="${bh}" fill="${color}"${kind === "header" ? ` opacity="0.55"` : ""}/>`;
        x += size * scale;
      }
    } else s += `<rect x="${BAR_X}" y="${by}" width="${r.size * scale}" height="${bh}" fill="${C.accent}"/>`;
    const end = r.icon === "dir" || r.accent ? BAR_X + r.size * scale : BAR_X + BAR_W;
    s += code(end + 12, r.y, String(r.size), { weight: 700 });
    s += label(v, end + 12 + textWidth(String(r.size), FS, true) + 8, r.y, bytes, { visual: true, color: C.muted, weight: 600 });
  }
  // The programs between the rows, and tar -czf doing both.
  const ax = NAME_X + 14;
  [["tar", 0], ["gzip", 1]].forEach(([prog, i]) => {
    const y1 = rows[i].y + 22, y2 = rows[i + 1].y - 22;
    s += arrow(ax, y1, ax, y2, { color: C.ink, width: 2.5 });
    s += code(ax + 20, (y1 + y2) / 2, prog, { weight: 800, color: C.ink });
  });
  const bx = W - PAD - 4;
  s += `<path d="M${bx - 12},${rows[0].y} H${bx} V${rows[2].y} H${bx - 12}" fill="none" stroke="${C.accent}" stroke-width="2.5" stroke-linejoin="round"/>`;
  s += `<rect x="${bx - 118}" y="${rows[1].y + STEP / 2 - 15}" width="112" height="30" rx="6" fill="#ffffff" stroke="${C.accent}" stroke-width="1.5"/>`;
  s += code(bx - 62, rows[1].y + STEP / 2, "tar -czf", { anchor: "middle", weight: 700, color: C.accent });
  return svg(height, s);
}
