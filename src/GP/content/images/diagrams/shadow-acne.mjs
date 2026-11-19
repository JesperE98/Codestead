// Shadow Mapping, "Shadow acne": a close-up of the floor, which is tilted to the light. Each texel of the depth map
// stores one depth, measured at its centre – a little flat tile held across the light. Along each tile the real floor
// is partly in front of it (lit) and partly behind it (in shadow): the stripes. With the bias the comparison moves
// the tiles a little away from the light, behind the floor, and the whole floor is lit.
import { BOLD, C, PAD, W, arrow, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";

export const variants = perLanguage("shadow-acne");

const PH = 214;
export const height = PAD + 2 * PH + 16 + PAD;

const TILT = 18; // the angle between the floor and the tiles (across the light), in degrees
const TEX = 74; // a texel's width along the tiles
const N = 8;

/** A panel, drawn in the light's frame (light from straight above, tiles horizontal) and turned so the floor is level. */
function scene(y, bias, v) {
  const x = PAD, w = W - 2 * PAD;
  let s = panel(x, y, w, PH);
  s += label(x + 16, y + 24, bias ? t(v, "With the bias", "Med bias") : t(v, "Without bias: shadow acne", "Utan bias: shadow acne"), { size: 21, weight: 650 });
  const k = Math.tan((TILT * Math.PI) / 180);
  const L = N * TEX;
  // In the light frame: u along the tiles (0 … L), depth grows downwards; the floor is depth = k·u.
  let g = "";
  const off = bias ? 16 : 0; // the bias, as a distance away from the light
  for (let i = 0; i < N; i++) {
    const u0 = i * TEX, u1 = u0 + TEX, uc = u0 + TEX / 2;
    const dc = k * uc + off; // the tile's depth (+ the bias)
    // The floor along this texel: in front of the tile (lit) where k·u < dc, behind it (shadow) where k·u > dc.
    const um = Math.min(u1, Math.max(u0, dc / k));
    g += line(u0, k * u0, um, k * um, { color: C.good, width: 7 });
    if (um < u1) g += line(um, k * um, u1, k * u1, { color: C.bad, width: 7 });
    // The tile.
    g += line(u0 + 2, dc, u1 - 2, dc, { color: C.ink, width: BOLD });
    g += `<circle cx="${uc}" cy="${dc}" r="3.5" fill="${C.ink}"/>`;
  }
  // Turn the light frame so that the floor is level; the light then comes from the upper left.
  const cx = x + w / 2 - 8, cy = y + PH / 2 + 34;
  s += `<g transform="translate(${cx} ${cy}) rotate(${-TILT}) translate(${-L / 2} ${-k * L / 2})">${g}</g>`;
  // The light's direction (perpendicular to the tiles).
  const a = ((90 - TILT) * Math.PI) / 180; // the rays' direction on screen: down and to the right
  for (const [sx, sy] of [[x + 80, y + 46], [x + 140, y + 46]]) s += arrow(sx, sy, sx + Math.cos(a) * 52, sy + Math.sin(a) * 52, { color: C.accent, width: 2 });
  s += label(x + 196, y + 64, t(v, "light", "ljus"), { color: C.accent });
  return s;
}

export function draw(v) {
  let s = scene(PAD, false, v) + scene(PAD + PH + 16, true, v);
  // The legend, top right.
  const lx = W - PAD - 250, ly = PAD + 26;
  s += line(lx, ly, lx + 26, ly, { color: C.ink, width: BOLD }) + label(lx + 34, ly, t(v, "depth map texel", "texel i depth map"));
  s += line(lx, ly + 28, lx + 26, ly + 28, { color: C.good, width: 7 }) + label(lx + 34, ly + 28, t(v, "lit", "belyst"));
  s += line(lx + 110, ly + 28, lx + 136, ly + 28, { color: C.bad, width: 7 }) + label(lx + 144, ly + 28, t(v, "in shadow", "i skugga"));
  return svg(height, s);
}
