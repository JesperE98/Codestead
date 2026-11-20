// Processes and jobs: the process tree, read from the simulator's ps -ef. Every process has a PID and the PID of the
// process that started it (PPID); following the parents from ps -ef leads through your shell and systemd --user to
// process 1, init. Each PID has a colour, and a PPID has its parent's colour. (The process that uses all the processor
// is left out: finding it is the chapter's task.)
import { C, FS, MONO, PAD, W, code, esc, perLanguage, svg, tag, textWidth, tr } from "./style.mjs";
import { words as systemWords } from "./_system.mjs";

export const variants = perLanguage("process-tree");

export const words = { shell: systemWords.shell };

export const terminals = { ps: { commands: ["ps -ef"] } };

/** The processes shown, by their command in ps -ef, with the name drawn and the depth in the tree. */
const SHOWN = [
  ["/sbin/init", "init", 0],
  ["/usr/sbin/cron -f", "cron", 1],
  ["/usr/sbin/sshd -D", "sshd", 1],
  [null, "…", 1],
  ["/usr/lib/systemd/systemd --user", "systemd --user", 1],
  ["-bash", "bash", 2],
  ["ps -ef", "ps -ef", 3],
];
const COLORS = { init: C.ink, "systemd --user": C.accent2, bash: C.y, "ps -ef": C.accent };
const ROW = 50, INDENT = 44, X = PAD + 14, TOP = PAD + 40;
const PPID_X = 548;
export const height = TOP + SHOWN.length * ROW + PAD - 8;

function processes(R) {
  const byCmd = new Map();
  for (const row of R.ps.lines[0].output.slice(1)) {
    const m = /^(\S+) +(\d+) +(\d+) +\S+ +\S+ +\S+ +\S+ (.+)$/.exec(row.map((r) => r.text).join(""));
    if (m) byCmd.set(m[4], { pid: m[2], ppid: m[3] });
  }
  return byCmd;
}

export function draw(v, R) {
  const procs = processes(R);
  const rows = SHOWN.map(([cmd, name, depth], i) => ({ cmd, name, depth, y: TOP + ROW / 2 + i * ROW, x: X + depth * INDENT, p: cmd ? procs.get(cmd) : null }));
  for (const r of rows) if (r.cmd && !r.p) throw new Error(`no ${r.cmd} in ps -ef`);
  const colorOf = (pid) => {
    const r = rows.find((q) => q.p?.pid === pid);
    return r ? COLORS[r.name] ?? C.ink : C.muted;
  };
  let s = "";
  // The headers.
  s += code(X + 2, PAD + 14, "PID", { weight: 700, color: C.muted });
  s += code(PPID_X, PAD + 14, "PPID", { weight: 700, color: C.muted });
  // The tree's lines, from each parent's chip down to its children.
  rows.forEach((r, i) => {
    if (r.depth === 0) return;
    let p = i - 1;
    while (rows[p].depth >= r.depth) p--;
    const px = rows[p].x + 22;
    const color = r.p && rows[p].p && COLORS[r.name] ? colorOf(rows[p].p.pid) : C.line;
    s += `<path d="M${px},${rows[p].y + 16} V${r.y} H${r.x - 4}" fill="none" stroke="${color}" stroke-width="${color === C.line ? 1.5 : 2.5}" stroke-linejoin="round"${r.p ? "" : ` stroke-dasharray="4 3"`}/>`;
  });
  for (const r of rows) {
    if (!r.p) {
      s += code(r.x + 8, r.y, r.name, { color: C.muted, weight: 700 });
      continue;
    }
    // The PID on a chip in the process's colour, then its name.
    const color = COLORS[r.name] ?? C.line;
    const w = textWidth(r.p.pid, FS, true) + 18;
    s += `<rect x="${r.x}" y="${r.y - 16}" width="${w}" height="32" rx="7" fill="${COLORS[r.name] ? "#ffffff" : C.card}" stroke="${color}" stroke-width="${COLORS[r.name] ? 2.5 : 1.5}"/>`;
    s += code(r.x + w / 2, r.y, r.p.pid, { anchor: "middle", weight: 800, color: COLORS[r.name] ? color : C.muted });
    s += `<text x="${r.x + w + 12}" y="${r.y}" font-size="${FS}" font-weight="${COLORS[r.name] ? 700 : 500}" fill="${C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${esc(r.name)}</text>`;
    // The parent's PID, in the parent's colour.
    const pc = colorOf(r.p.ppid);
    s += code(PPID_X, r.y, r.p.ppid, { weight: 800, color: pc });
    if (r.name === "bash") s += tag(v, r.x + w + 12 + textWidth("bash", FS, true) + 16, r.y, tr(v, words.shell), { fill: C.ySoft, stroke: C.y });
  }
  // The column of PPIDs: a light band.
  s = `<rect x="${PPID_X - 14}" y="${PAD - 4}" width="${W - PAD - PPID_X + 14}" height="${height - 2 * PAD + 8}" rx="6" fill="#ffffff" stroke="${C.grid}"/>` + s;
  return svg(height, s);
}
