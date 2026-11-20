// Copying files over SSH: which way scp copies – the chapter's three commands between the home directories of your
// computer and of the server srv (HOST:PATH is on the server, the source comes first; backup did not exist, so the
// directory is copied as backup) – and the chapter's question:
// without the colon, srv is only a file name and the copy stays on your computer. (After the question in the text.)
import { C, FS, MONO, PAD, W, arrow, esc, file, folder, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { DARK, words as adminWords } from "./_admin.mjs";

export const variants = perLanguage("scp-copy");

export const words = {
  yourComputer: adminWords.yourComputer,
  server: adminWords.server,
};

const HEAD = 64; // the two sides' titles
const ROW = 104; // a command and its copy
const SIDE_W = 270;
export const height = PAD + HEAD + 4 * ROW - 8 + PAD;

/** A command with the HOST: part in the server's colour, centred at x. */
function command(x, y, cmd) {
  const w = textWidth(cmd, FS, true) + 28;
  const parts = cmd.split(/(srv:\S*)/);
  const spans = parts.map((p) => (p.startsWith("srv:") ? `<tspan fill="#c9b3ff" font-weight="700">${esc(p)}</tspan>` : `<tspan fill="#e6edf3">${esc(p)}</tspan>`)).join("");
  return `<rect x="${x - w / 2}" y="${y - 20}" width="${w}" height="40" rx="6" fill="${DARK}"/>` +
    `<text x="${x - w / 2 + 14}" y="${y}" font-size="${FS}" font-weight="500" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${spans}</text>`;
}

/** A file or directory on a side: its symbol and its path (as seen from that side's home directory). */
function item(x, y, name, o = {}) {
  const dir = o.dir;
  const w = textWidth(name, FS, true) + 46;
  const x0 = o.anchor === "end" ? x - w : x;
  const [fill, stroke] = o.isNew ? [C.accentSoft, C.accent] : ["#ffffff", C.boxStroke];
  return `<rect x="${x0}" y="${y - 18}" width="${w}" height="36" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${o.isNew ? 2 : 1.5}"/>` +
    (dir ? folder(x0 + 9, y - 9) : file(x0 + 11, y - 10)) +
    `<text x="${x0 + 38}" y="${y}" font-size="${FS}" font-weight="600" fill="${C.ink}" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(name)}</text>`;
}

export function draw(v) {
  const n = world(v.lang).names;
  // Your computer on the left, the server on the right – in Arabic too: the copies follow the commands, which read
  // left to right.
  const L = PAD, R = W - PAD;
  let s = "";
  s += `<rect x="${L}" y="${PAD}" width="${SIDE_W}" height="${height - 2 * PAD}" rx="10" fill="${C.zSoft}" fill-opacity="0.5" stroke="${C.z}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  s += `<rect x="${R - SIDE_W}" y="${PAD}" width="${SIDE_W}" height="${height - 2 * PAD}" rx="10" fill="${C.accent2Soft}" fill-opacity="0.6" stroke="${C.accent2}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  s += label(v, L + SIDE_W / 2, PAD + 22, tr(v, words.yourComputer), { anchor: "middle", weight: 700, color: C.z, fit: SIDE_W - 16 });
  s += label(v, R - SIDE_W / 2, PAD + 22, `${tr(v, words.server)} (srv)`, { anchor: "middle", weight: 700, color: C.accent2, fit: SIDE_W - 16 });
  s += `<text x="${L + SIDE_W / 2}" y="${PAD + 48}" font-size="${FS}" fill="${C.muted}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">~ = /home/${esc(n.user)}</text>`;
  s += `<text x="${R - SIDE_W / 2}" y="${PAD + 48}" font-size="${FS}" fill="${C.muted}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">~ = /home/${esc(n.user)}</text>`;
  const rows = [
    { cmd: `scp ${n.notes} srv:`, from: ["L", n.notes], to: ["R", n.notes] },
    { cmd: `scp srv:${n.welcomeFile} .`, from: ["R", n.welcomeFile], to: ["L", n.welcomeFile] },
    { cmd: `scp -r ${n.documents} srv:backup`, from: ["L", n.documents, true], to: ["R", "backup", true] },
    { cmd: `scp ${n.notes} srv`, from: ["L", n.notes], to: ["L", "srv"], mistake: true },
  ];
  rows.forEach((r, i) => {
    const y = PAD + HEAD + i * ROW;
    s += command(W / 2, y + 20, r.cmd);
    const iy = y + 68;
    const at = (side) => (side === "L" ? L + 14 : R - 14);
    if (r.mistake) {
      // Both on your computer: the copy is a file called srv.
      s += item(L + 14, iy, r.from[1]);
      const fw = textWidth(r.from[1], FS, true) + 46;
      s += arrow(L + 14 + fw + 6, iy, L + 14 + fw + 44, iy, { color: C.x, width: 2.5 });
      s += item(L + 14 + fw + 50, iy, "srv", { isNew: true });
      s += `<path d="M${R - SIDE_W / 2 - 14},${iy - 14} l28,28 M${R - SIDE_W / 2 + 14},${iy - 14} l-28,28" stroke="${C.x}" stroke-width="3.5" stroke-linecap="round"/>`;
      return;
    }
    const [fs, fname, fdir] = r.from, [ts, tname, tdir] = r.to;
    s += item(at(fs), iy, fname, { dir: fdir, anchor: fs === "R" ? "end" : "start" });
    s += item(at(ts), iy, tname, { dir: tdir, anchor: ts === "R" ? "end" : "start", isNew: true });
    const fw = textWidth(fname, FS, true) + 46, tw = textWidth(tname, FS, true) + 46;
    const x1 = fs === "L" ? at(fs) + fw + 8 : at(fs) - fw - 8;
    const x2 = ts === "L" ? at(ts) + tw + 8 : at(ts) - tw - 8;
    s += arrow(x1, iy, x2, iy, { color: C.accent, width: 3 });
  });
  return svg(height, s);
}
