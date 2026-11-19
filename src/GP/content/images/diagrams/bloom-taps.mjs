// Physically Based Bloom, the 13-tap downsample: a 6 × 6 texel area of the source around the output pixel, the 13
// bilinear samples a … m (a … i two texels apart, j … m one texel diagonally from the centre), and the five 2 × 2 boxes
// they form – the four corner boxes weighted 0.125 each, the inner box j k l m 0.5. Language-free.
import { C, PAD, W, dot, line, svg } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = [{ out: "bloom-taps.webp", lang: "en" }];
const T = 64, N = 6, G = T * N;
const X0 = PAD + 20, Y0 = PAD + 10;
export const height = Y0 + G + PAD + 10;

export function draw() {
  const cx = X0 + G / 2, cy = Y0 + G / 2;
  const P = (u, v) => [cx + u * T, cy - v * T];
  let s = `<rect x="${X0}" y="${Y0}" width="${G}" height="${G}" fill="#fff" stroke="${C.boxStroke}"/>`;
  for (let i = 1; i < N; i++) s += line(X0 + i * T, Y0, X0 + i * T, Y0 + G, { color: C.grid, width: 1.5 }) + line(X0, Y0 + i * T, X0 + G, Y0 + i * T, { color: C.grid, width: 1.5 });
  const pts = { a: [-2, 2], b: [0, 2], c: [2, 2], d: [-2, 0], e: [0, 0], f: [2, 0], g: [-2, -2], h: [0, -2], i: [2, -2], j: [-1, 1], k: [1, 1], l: [-1, -1], m: [1, -1] };
  const quad = (names, color, dash, fill) => {
    const q = names.map((n) => P(...pts[n]));
    return `<path d="M${q[0]} L${q[1]} L${q[3]} L${q[2]} Z" fill="${fill}" fill-opacity="0.35" stroke="${color}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  };
  for (const b of [["a", "b", "d", "e"], ["b", "c", "e", "f"], ["d", "e", "g", "h"], ["e", "f", "h", "i"]]) s += quad(b, C.accent2, "6 4", "none");
  s += quad(["j", "k", "l", "m"], C.accent, null, C.accentSoft);
  for (const [n, [u, v]] of Object.entries(pts)) {
    const [x, y] = P(u, v), inner = "jklm".includes(n);
    s += dot(x, y, { r: 6, color: inner ? C.accent : C.accent2 });
    s += code(x + 9, y - 14, n, { weight: 700, color: inner ? C.accent : C.accent2 });
  }
  const lx = X0 + G + 40;
  s += `<rect x="${lx}" y="${Y0 + 60}" width="34" height="24" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="2.5"/>`;
  s += code(lx + 46, Y0 + 72, "j k l m: 0.5", { weight: 600, color: C.accent });
  s += `<rect x="${lx}" y="${Y0 + 120}" width="34" height="24" fill="none" stroke="${C.accent2}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
  s += code(lx + 46, Y0 + 132, "4 × 0.125", { weight: 600, color: C.accent2 });
  s += label(lx, Y0 + 200, "*e*: 0.125", { weight: 500 });
  s += label(lx, Y0 + 236, "*a c g i*: 0.03125", { weight: 500 });
  s += label(lx, Y0 + 272, "*b d f h*: 0.0625", { weight: 500 });
  s += label(lx, Y0 + 308, "*j k l m*: 0.125", { weight: 500 });
  return svg(height, s);
}
