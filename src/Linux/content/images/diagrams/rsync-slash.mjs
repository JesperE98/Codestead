// Copying files over SSH: the slash at the end of rsync's source. Without it the directory itself is copied into the
// target, with it only what is in it – the trees are what the simulator has after each command. No words.
// (After the question in the text: it shows the answer.)
import { C, FS, MONO, PAD, W, esc, perLanguage, svg, textWidth, tree, world } from "./style.mjs";
import { DARK } from "./_admin.mjs";

export const variants = perLanguage("rsync-slash");

export function terminals(v) {
  const d = world(v.lang).names.documents;
  return { copy: { commands: [`rsync -a ${d} /tmp/x`, "find /tmp/x", `rsync -a ${d}/ /tmp/y`, "find /tmp/y"] } };
}

const COL = (W - 2 * PAD - 20) / 2;
const ROW = 38;
const TREE_Y = PAD + 66;
export const height = TREE_Y + 5 * ROW + PAD;

/** The paths find printed, as tree items under the target (shown as /tmp/x in both columns, as in the text). */
function items(rows, target) {
  return rows.map((p) => {
    const rel = p.slice(target.length).split("/").filter(Boolean);
    return rel.length === 0 ? { name: "/tmp/x", depth: 0, bold: true } : { name: rel.at(-1), depth: rel.length, file: /\.[a-z]+$/.test(rel.at(-1)) };
  });
}

export function draw(v, R) {
  const d = world(v.lang).names.documents;
  const out = (i) => R.copy.lines[i].output.map((row) => row.map((r) => r.text).join(""));
  const cols = [
    { cmd: [`rsync -a ${d}`, "", " /tmp/x"], list: items(out(1), "/tmp/x") },
    { cmd: [`rsync -a ${d}`, "/", " /tmp/x"], list: items(out(3), "/tmp/y") },
  ];
  let s = "";
  cols.forEach((c, i) => {
    const x = PAD + i * (COL + 20);
    s += `<rect x="${x}" y="${PAD}" width="${COL}" height="${height - 2 * PAD}" rx="10" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
    // The command, its slash (or the place where it is missing) marked.
    const full = c.cmd.join("");
    const w = textWidth(full, FS, true) + 28;
    const sx = x + (COL - w) / 2;
    s += `<rect x="${sx}" y="${PAD + 12}" width="${w}" height="40" rx="6" fill="${DARK}"/>`;
    const slashX = sx + 14 + textWidth(c.cmd[0], FS, true);
    if (c.cmd[1]) s += `<rect x="${slashX - 2}" y="${PAD + 17}" width="${FS * 0.6 + 4}" height="30" rx="4" fill="${C.accent}"/>`;
    else s += `<path d="M${slashX},${PAD + 47} v-6" stroke="${C.line}" stroke-width="2"/>`;
    s += `<text x="${sx + 14}" y="${PAD + 32}" font-size="${FS}" font-weight="500" fill="#e6edf3" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(full)}</text>`;
    // What /tmp/x holds afterwards: the directory itself (orange) or only its files.
    const list = c.list.map((it) => (it.name === d && it.depth === 1 ? { ...it, color: C.accent, edge: C.accent } : it.depth === 2 ? { ...it, edge: C.accent } : it));
    s += tree(x + 26, TREE_Y, list, { row: ROW }).svg;
  });
  return svg(height, s);
}
