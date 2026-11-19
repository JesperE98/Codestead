// Colors, the three examples at the start: the light's colour times the coral object's colour, component by
// component, is the colour we see – for the white, the green and the dark olive-green light of the chapter.
// Language-free: a lamp, the object and an eye head the columns; the numbers are the chapter's.
import { C, PAD, W, svg, text } from "./style.mjs";
import { L, LS, eye, lamp } from "./_lighting.mjs";

export const variants = [{ out: "light-times-color.webp", lang: "en" }];

const rows = [
  [1.0, 1.0, 1.0],
  [0.0, 1.0, 0.0],
  [0.33, 0.42, 0.18],
];
const coral = [1.0, 0.5, 0.31];
const SW = 176, SH = 42, OP = (W - 2 * PAD - 3 * SW) / 2, RH = 88, TOP = PAD + 54;
export const height = TOP + rows.length * RH + 4;

const hex = (c) => "#" + c.map((x) => Math.round(Math.min(1, x) * 255).toString(16).padStart(2, "0")).join("");
const num = (c) => `(${c.map((x) => (x === 0 || x === 1 ? x.toFixed(1) : String(x))).join(", ")})`;

function cube(x, y, color) {
  const s = 15, d = 8;
  return `<path d="M${x - s},${y - s + d} L${x + s - d},${y - s + d} L${x + s - d},${y + s} L${x - s},${y + s} Z" fill="${color}" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${x - s},${y - s + d} L${x - s + d},${y - s} L${x + s},${y - s} L${x + s - d},${y - s + d} Z" fill="#ffb595" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${x + s - d},${y - s + d} L${x + s},${y - s} L${x + s},${y + s - d} L${x + s - d},${y + s} Z" fill="#c85f3c" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

export function draw() {
  let s = "";
  const col = (i) => PAD + i * (SW + OP);
  s += lamp(col(0) + SW / 2, PAD + 22, { color: "#fff6d8" });
  s += cube(col(1) + SW / 2, PAD + 22, hex(coral));
  s += eye(col(2) + SW / 2, PAD + 22, 0, { size: 17 });
  rows.forEach((light, r) => {
    const y = TOP + r * RH;
    const seen = light.map((x, i) => Math.round(x * coral[i] * 100) / 100);
    [light, coral, seen].forEach((c, i) => {
      s += `<rect x="${col(i)}" y="${y}" width="${SW}" height="${SH}" rx="6" fill="${hex(c)}" stroke="${C.boxStroke}"/>`;
      s += text(col(i) + SW / 2, y + SH + 18, num(c), { size: LS, mono: true, anchor: "middle", weight: 600, fit: SW + OP - 6 });
    });
    s += text(col(0) + SW + OP / 2, y + SH / 2, "×", { size: L + 6, anchor: "middle", weight: 600, color: C.muted });
    s += text(col(1) + SW + OP / 2, y + SH / 2, "=", { size: L + 6, anchor: "middle", weight: 600, color: C.muted });
  });
  return svg(height, s);
}
