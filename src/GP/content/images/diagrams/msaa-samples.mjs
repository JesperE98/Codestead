// Anti Aliasing, "Multisampling": a triangle's edge over a few pixels, with one sample point per pixel (a pixel is
// either covered or not: a staircase) and with four (the usual rotated-grid positions): each pixel gets the triangle's
// colour in proportion to its covered samples after the resolve – 0, ¼, ½, ¾ or all of it. The colours are the
// chapter's: the flat green cube on the dark grey background.
import { C, PAD, W, line, perLanguage, svg, t } from "./style.mjs";
import { caption } from "./_advgl.mjs";

export const variants = perLanguage("msaa-samples");

const COLS = 5, ROWS = 4, P = 64; // pixels per panel and their size
const GAP = W - 2 * PAD - 2 * COLS * P;
const GY = PAD;
export const height = GY + ROWS * P + 76;

// The edge: the triangle is below the line y = a + b·x (in pixel units, y down), i.e. points with y > a + b·x.
const a = 3.75, b = -0.62;
const inside = (x, y) => y > a + b * x;
const four = [[-2, -6], [6, -2], [-6, 2], [2, 6]].map(([x, y]) => [x / 16, y / 16]);
const bg = [26, 26, 26], green = [0, 255, 0];
const mix = (k) => `rgb(${bg.map((c, i) => Math.round(c + (green[i] - c) * k)).join(",")})`;

function panel(x0, samples) {
  let s = "";
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const pts = samples.map(([dx, dy]) => [c + 0.5 + dx, r + 0.5 + dy]);
    const k = pts.filter(([x, y]) => inside(x, y)).length / pts.length;
    s += `<rect x="${x0 + c * P}" y="${GY + r * P}" width="${P}" height="${P}" fill="${mix(k)}" stroke="#5b6370" stroke-width="1"/>`;
  }
  // The edge, then the sample points over everything.
  const y = (x) => GY + (a + b * x) * P;
  s += `<clipPath id="g${x0}"><rect x="${x0}" y="${GY}" width="${COLS * P}" height="${ROWS * P}"/></clipPath>`;
  s += `<g clip-path="url(#g${x0})">${line(x0, y(0), x0 + COLS * P, y(COLS), { color: "#ffffff", width: 2.5 })}</g>`;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    for (const [dx, dy] of samples) {
      const px = c + 0.5 + dx, py = r + 0.5 + dy, on = inside(px, py);
      s += `<circle cx="${x0 + px * P}" cy="${GY + py * P}" r="${samples.length > 1 ? 5 : 6}" fill="${on ? C.ink : "#ffffff"}" stroke="${on ? "#ffffff" : C.ink}" stroke-width="1.2"/>`;
    }
  return s + `<rect x="${x0}" y="${GY}" width="${COLS * P}" height="${ROWS * P}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
}

export function draw(v) {
  let s = "";
  const x1 = PAD, x2 = PAD + COLS * P + GAP;
  s += panel(x1, [[0, 0]]);
  s += panel(x2, four);
  const cy = GY + ROWS * P + 22;
  s += caption(x1 + (COLS * P) / 2, cy, t(v, "1 sample per pixel", "1 sample per pixel"), t(v, "covered or not: a staircase", "täckt eller inte: trappsteg"), { fit: COLS * P });
  s += caption(x2 + (COLS * P) / 2, cy, t(v, "4 samples per pixel", "4 samples per pixel"), t(v, "¼, ½ or ¾ green at the edge", "¼, ½ eller ¾ grön vid kanten"), { fit: COLS * P });
  return svg(height, s);
}
