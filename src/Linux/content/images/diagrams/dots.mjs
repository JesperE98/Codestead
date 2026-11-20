// Navigating: where the special names lead from one place in the tree. The terminal (the simulator) has been in /etc
// and is now in /var/log; from there . is /var/log, .. is /var, ~ is the home directory, / the root and cd - goes back
// to /etc.
import { C, FS, PAD, W, arrowPath, perLanguage, svg, tag, terminal, textWidth, tr, tree, world } from "./style.mjs";

export const variants = perLanguage("dots");

export const words = {
  here: { en: "you are here", sv: "du står här", de: "hier bist du", fr: "vous êtes ici", es: "estás aquí", pt: "você está aqui", ru: "вы здесь", zh: "你在这里", ja: "今ここ", ar: "أنت هنا", hi: "आप यहाँ हैं" },
};

export const terminals = { history: { commands: ["cd /etc", "cd /var/log", "pwd"] } };

const ROW = 42;
const termHeight = (R) => terminal(0, 0, W, R.history.lines).height;
export const height = (v, R) => PAD + termHeight(R) + 22 + 6 * ROW + PAD;

export function draw(v, R) {
  const n = world(v.lang).names;
  const t = terminal(PAD, PAD, W - 2 * PAD, R.history.lines);
  const TREE_Y = PAD + t.height + 22;
  let s = t.svg;
  const items = [
    { name: "/", depth: 0 },
    { name: "etc", depth: 1 },
    { name: "home", depth: 1 },
    { name: n.user, depth: 2 },
    { name: "var", depth: 1 },
    { name: "log", depth: 2, color: C.accent },
  ];
  const tr0 = tree(PAD + 20, TREE_Y, items, { row: ROW });
  s += tr0.svg;
  const log = tr0.rows[5];
  const here = tr(v, words.here);
  const hereX = log.end + 14;
  s += tag(v, hereX, log.y, here, { fill: "#fff6d6", stroke: "#c99a2e" });
  const hereEnd = hereX + Math.round(textWidth(here) + 28);
  // . – a loop back to where you are.
  const lx = hereEnd + 12;
  s += arrowPath(`M${lx},${log.y - 9} C${lx + 50},${log.y - 46} ${lx + 50},${log.y + 46} ${lx + 6},${log.y + 10}`, lx + 6, log.y + 10, -1, -0.5, { color: C.accent, width: 2 });
  s += chip(lx + 46, log.y, ".", C.accent);
  // The others: from where you are along one line to the right, then up to their directory; the name sits on the
  // arrow next to the directory it leads to.
  const sx = lx + 76;
  const to = [
    ["/", 0, 200, C.x],
    ["cd -", 1, 150, C.z],
    ["~", 3, 100, C.y],
    ["..", 4, 50, C.accent2],
  ];
  for (const [name, row, bulge, color] of to) {
    const e = tr0.rows[row];
    const ex = e.end + 12, cx = sx + bulge;
    s += arrowPath(`M${sx},${log.y} L${cx - 14},${log.y} Q${cx},${log.y} ${cx},${log.y - 14} L${cx},${e.y + 14} Q${cx},${e.y} ${cx - 14},${e.y} L${ex},${e.y}`, ex, e.y, -1, 0, { color, width: 2.5 });
    s += `<circle cx="${sx}" cy="${log.y}" r="4" fill="${C.ink}"/>`;
    s += chip(ex + 34 + (name.length * FS * 0.6) / 2, e.y, name, color);
  }
  return svg(height(v, R), s);
}

function chip(x, y, s, color) {
  const w = s.length * FS * 0.6 + 18;
  return `<rect x="${x - w / 2}" y="${y - 16}" width="${w}" height="32" rx="7" fill="#ffffff" stroke="${color}" stroke-width="2"/>` +
    `<text x="${x}" y="${y}" font-size="${FS + 2}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono', monospace" style="white-space:pre">${s}</text>`;
}
