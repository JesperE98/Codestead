// The Red Hat family: the capital letter is the answer Enter gives. apt asks [Y/n], so Enter goes on and installs;
// dnf asks [y/N], so Enter cancels. The questions and dnf's answer are the simulator's (and the real programs'). No
// words: one picture for every language.
import { C, FS, MONO, PAD, TERM, W, arrow, box, esc, shared, svg, textWidth } from "./style.mjs";
import { famBadge, verdict } from "./_distro.mjs";

export const variants = shared("yes-no-default");

const ROWS = [
  { family: "debian", name: "Debian", before: "Do you want to continue? [", capital: "Y", after: "/n] ", result: "Setting up htop (3.3.0-4build1) ...", ok: true },
  { family: "redhat", name: "Red Hat", before: "Is this ok [y/", capital: "N", after: "]: ", result: "Operation aborted by the user.", ok: false },
];
const ROWH = 150;
export const height = PAD + ROWS.length * ROWH + (ROWS.length - 1) * 14 + PAD;

/** A key on the keyboard with the Enter symbol, its top left corner at (x, y). */
function enterKey(x, y) {
  return `<rect x="${x}" y="${y + 3}" width="58" height="40" rx="7" fill="#c9ced6"/>` +
    `<rect x="${x}" y="${y}" width="58" height="37" rx="7" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>` +
    `<path d="M${x + 40},${y + 10} v10 h-22" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${x + 16},${y + 20} l7,-6 v12 z" fill="${C.ink}"/>`;
}

export function draw() {
  let s = "";
  ROWS.forEach((r, i) => {
    const y = PAD + i * (ROWH + 14);
    const color = r.ok ? C.good : C.bad;
    s += box(PAD, y, W - 2 * PAD, ROWH, { style: r.ok ? "y" : "x" });
    s += famBadge({ lang: "en" }, PAD + 14, y + 26, r.family, r.name);
    s += verdict(W - PAD - 30, y + 26, r.ok, 16);
    // The question in the terminal, the capital letter marked, and Enter pressed after it.
    const q = r.before + r.capital + r.after;
    const cw = FS * 0.6;
    const tw = textWidth(q, FS, true) + 28;
    const ty = y + 56;
    s += `<rect x="${PAD + 14}" y="${ty}" width="${tw}" height="36" rx="6" fill="${TERM.bg}"/>`;
    const capX = PAD + 28 + r.before.length * cw;
    s += `<rect x="${capX - 3}" y="${ty + 5}" width="${cw + 6}" height="26" rx="4" fill="${color}"/>`;
    s += `<text x="${PAD + 28}" y="${ty + 18}" font-size="${FS}" font-weight="500" fill="${TERM.text}" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(r.before)}<tspan font-weight="800" fill="#ffffff">${r.capital}</tspan>${esc(r.after)}</text>`;
    const kx = PAD + 14 + tw + 16;
    s += enterKey(kx, ty - 1);
    // What happens: an arrow down from Enter to the program's answer.
    const ry = y + ROWH - 20;
    s += arrow(kx + 29, ty + 40, kx + 29, ry - 4, { color, width: 2.5 });
    // The answer after the arrow if it fits there, else before it.
    const right = kx + 29 + 14 + textWidth(r.result, FS, true) < W - PAD - 10;
    s += `<text x="${right ? kx + 29 + 14 : kx + 29 - 14}" y="${ry + 4}" font-size="${FS}" font-weight="650" fill="${color}" text-anchor="${right ? "start" : "end"}" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(r.result)}</text>`;
  });
  return svg(height, s);
}
