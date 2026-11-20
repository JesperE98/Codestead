// Users, permissions and sudo: how the permissions become digits – the three sets (owner, group, others), r = 4, w = 2
// and x = 1 under every letter, and each set's sum as one digit – for the chapter's 755 and 644.
import { C, FS, PAD, W, code, label, perLanguage, svg, tr } from "./style.mjs";
import { words as systemWords } from "./_system.mjs";

export const variants = perLanguage("perm-octal");

export const words = { type: systemWords.type, owner: systemWords.owner, group: systemWords.group, others: systemWords.others };

const CELL = 42, IN = 4, GAP = 26;
const TYPE_X = PAD + 22;
const G0 = TYPE_X + CELL + 34;
const GW = 3 * CELL + 2 * IN;
const groupX = (g) => G0 + g * (GW + GAP);
const SETS = [["owner", "u", C.y], ["group", "g", C.z], ["others", "o", C.accent2]];
const HEAD_Y = PAD + 16;
const FIRST = HEAD_Y + 62;
const BLOCK = 170;
const EXAMPLES = [["755", "-rwxr-xr-x"], ["644", "-rw-r--r--"]];
export const height = FIRST + EXAMPLES.length * BLOCK - 42 + PAD;

export function draw(v) {
  let s = "";
  // The headers: the type and the three sets, with their letters for chmod (u, g, o).
  s += label(v, TYPE_X + CELL / 2, HEAD_Y, tr(v, words.type), { anchor: "middle", color: C.muted, weight: 600, fit: CELL + 30 });
  SETS.forEach(([key, letter, color], g) => {
    const cx = groupX(g) + GW / 2;
    s += label(v, cx, HEAD_Y, tr(v, words[key]), { anchor: "middle", color, weight: 700, fit: GW + GAP - 6 });
    s += code(cx, HEAD_Y + 28, letter, { anchor: "middle", color, weight: 700 });
  });
  EXAMPLES.forEach(([digits, bits], i) => {
    const y = FIRST + i * BLOCK;
    if (i > 0) s += `<line x1="${PAD}" y1="${y - 22}" x2="${W - PAD}" y2="${y - 22}" stroke="${C.grid}" stroke-width="1"/>`;
    // The type: not part of the number.
    s += cell(TYPE_X, y, bits[0], C.line, true);
    SETS.forEach(([, , color], g) => {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        const ch = bits[1 + g * 3 + k];
        const x = groupX(g) + k * (CELL + IN);
        const value = ch === "-" ? 0 : [4, 2, 1][k];
        sum += value;
        s += cell(x, y, ch, color, ch === "-");
        s += code(x + CELL / 2, y + CELL + 20, String(value), { anchor: "middle", color: value === 0 ? C.line : C.muted, weight: 600 });
      }
      // The set's sum under a bracket: one digit of the number.
      const by = y + CELL + 38;
      s += `<path d="M${groupX(g) + 4},${by} v6 H${groupX(g) + GW - 4} v-6" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
      s += `<path d="M${groupX(g) + GW / 2},${by + 6} v8" stroke="${color}" stroke-width="2"/>`;
      s += `<circle cx="${groupX(g) + GW / 2}" cy="${by + 32}" r="18" fill="#ffffff" stroke="${color}" stroke-width="2.5"/>`;
      s += code(groupX(g) + GW / 2, by + 32, String(sum), { anchor: "middle", color, weight: 800, size: 23 });
      if (String(sum) !== digits[g]) throw new Error(`${bits}: set ${g} is ${sum}, not ${digits[g]}`);
    });
    // The number: the three digits side by side.
    const rx = groupX(2) + GW + 22;
    const ry = y + CELL + 70;
    s += code(rx, ry, "=", { color: C.muted, weight: 700, size: 24 });
    s += code(rx + 26, ry, digits, { color: C.accent, weight: 800, size: 30 });
  });
  return svg(height, s);
}

function cell(x, y, ch, color, off) {
  return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="5" fill="${off ? C.card : "#ffffff"}" stroke="${off ? C.boxStroke : color}" stroke-width="${off ? 1.2 : 2}"/>` +
    code(x + CELL / 2, y + CELL / 2, ch, { anchor: "middle", color: off ? C.line : C.ink, weight: 700, size: 24 });
}
