// Links and file information: a relative link is followed from the directory the link is in. The chapter's link
// ~/fruits.txt -> documents/fruits.txt leads to ~/documents/fruits.txt; a link /tmp/f with the same contents looks for
// /tmp/documents/fruits.txt, which does not exist – a broken link. Names only (the learner's), no words.
import { C, FS, MONO, PAD, arrowPath, esc, file, folder, perLanguage, svg, textWidth, world } from "./style.mjs";
import { mark } from "./_system.mjs";

export const variants = perLanguage("symlink-relative");

const ROW = 38, INDENT = 32, X = PAD + 18, TOP = PAD + 4;
const LINK = "#1b9aaa"; // ls colours a link cyan
export const height = TOP + 10 * ROW + PAD - 2;

export function draw(v) {
  const n = world(v.lang).names;
  const target = `${n.documents}/${n.fruits}`;
  // depth, name, kind (dir, file, link, ghost-dir, ghost-file), path colour (the way the link leads from its directory).
  const items = [
    [0, "/", "dir"],
    [1, "home", "dir"],
    [2, n.user, "dir"],
    [3, n.documents, "dir", C.good],
    [4, n.fruits, "file", C.good],
    [3, n.fruits, "link"],
    [1, "tmp", "dir"],
    [2, n.documents, "ghost-dir", C.bad],
    [3, n.fruits, "ghost-file", C.bad],
    [2, "f", "link"],
  ];
  const rows = items.map(([depth, name, kind], i) => {
    const x = X + depth * INDENT;
    const y = TOP + ROW / 2 + i * ROW;
    const shown = kind === "link" ? `${name} -> ${target}` : name;
    return { x, y, end: x + 32 + textWidth(shown, FS, true) };
  });
  let lines = "", coloured = "", icons = "", names = "";
  items.forEach(([depth, name, kind, edge], i) => {
    const r = rows[i];
    if (depth > 0) {
      let p = i - 1;
      while (items[p][0] >= depth) p--;
      const px = rows[p].x + 11;
      const path = `M${px},${rows[p].y + 11} V${r.y} H${r.x - 4}`;
      if (edge) coloured += `<path d="${path}" fill="none" stroke="${edge}" stroke-width="3" stroke-linejoin="round"${kind.startsWith("ghost") ? ` stroke-dasharray="6 4"` : ""}/>`;
      else lines += `<path d="${path}" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    const ghost = kind.startsWith("ghost");
    const dim = { fill: C.card, stroke: C.line };
    if (kind === "dir" || kind === "ghost-dir") icons += folder(r.x, r.y - 9, ghost ? dim : {});
    else icons += file(r.x + 3, r.y - 10, ghost ? dim : kind === "link" ? { stroke: LINK } : {});
    if (kind === "link") icons += `<path d="M${r.x + 7},${r.y + 6} q0,-7 7,-7 h3 m-3,-3 l3,3 l-3,3" fill="none" stroke="${LINK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (ghost) icons += `<rect x="${r.x - 5}" y="${r.y - 15}" width="${r.end - r.x + 10}" height="30" rx="5" fill="none" stroke="${C.bad}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    const color = ghost ? C.line : kind === "link" ? LINK : edge ?? C.ink;
    const weight = kind === "link" || edge ? 700 : 500;
    names += `<text x="${r.x + 32}" y="${r.y}" font-size="${FS}" font-weight="${weight}" fill="${color}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">` +
      (kind === "link" ? `${esc(name)}<tspan fill="${C.muted}" font-weight="500"> -&gt; </tspan><tspan fill="${C.ink}" font-weight="600">${esc(target)}</tspan>` : esc(name)) + `</text>`;
  });
  let s = lines + coloured + icons + names;
  // From each link to what it leads to: ~/documents/fruits.txt (there) and /tmp/documents/fruits.txt (not there).
  const lead = (from, to, color, dash) => {
    const a = rows[from], b = rows[to];
    const right = Math.max(a.end, b.end) + 34;
    const d = `M${a.end + 10},${a.y} H${right - 12} Q${right},${a.y} ${right},${a.y - 12} V${b.y + 12} Q${right},${b.y} ${right - 12},${b.y} H${b.end + 46}`;
    return arrowPath(d, b.end + 46, b.y, -1, 0, { color, width: 2.5, dash });
  };
  s += lead(5, 4, C.good) + mark(rows[4].end + 22, rows[4].y, true);
  s += lead(9, 8, C.bad, "6 4") + mark(rows[8].end + 24, rows[8].y, false);
  return svg(height, s);
}
