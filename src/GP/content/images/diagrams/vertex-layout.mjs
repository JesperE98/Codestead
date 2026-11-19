// Mesh, after the quiz about stride and offset: the Vertex struct in memory – its members one after the other, so an
// array of vertices is an interleaved vertex buffer. The offsets are what offsetof gives (glVertexAttribPointer's
// offset, the input layout's AlignedByteOffset, the attribute description's offset), sizeof(Vertex) is the stride;
// the next vertex follows right after. Per API: the member names differ, and Vulkan's vertex has the material number.
import { C, PAD, W, arrow, line, svg, text } from "./style.mjs";
import { LS, code } from "./_lighting.mjs";

export const variants = [
  { out: "vertex-layout-opengl.webp", lang: "en", api: "opengl" },
  { out: "vertex-layout-d3d12.webp", lang: "en", api: "d3d12" },
  { out: "vertex-layout-vulkan.webp", lang: "en", api: "vulkan" },
];

const members = {
  opengl: [["Position", 12], ["Normal", 12], ["TexCoords", 8]],
  d3d12: [["position", 12], ["normal", 12], ["texCoord", 8]],
  vulkan: [["pos", 12], ["normal", 12], ["texCoord", 8], ["materialIndex", 4]],
};
const COLORS = [C.accent, C.y, C.accent2, C.z];
const SOFT = [C.accentSoft, C.ySoft, C.accent2Soft, C.zSoft];
const BY = PAD + 40, BH = 48;
export const height = (v) => BY + BH + (v.api === "vulkan" ? 118 : 86);

export function draw(v) {
  const list = members[v.api];
  const size = list.reduce((s, [, n]) => s + n, 0);
  const K = (W - 2 * PAD - 70) / (size + 8); // pixels per byte: one vertex and the start of the next
  const X = (b) => PAD + 6 + b * K;
  let s = "";
  let off = 0;
  list.forEach(([name, n], i) => {
    s += `<rect x="${X(off) + 1.5}" y="${BY}" width="${n * K - 3}" height="${BH}" rx="5" fill="${SOFT[i]}" stroke="${COLORS[i]}" stroke-width="1.5"/>`;
    if (n >= 8) s += code(X(off + n / 2), BY + BH / 2, name, { anchor: "middle", weight: 650 });
    else {
      s += line(X(off + n / 2), BY + BH + 2, X(off + n / 2), BY + BH + 20, { color: COLORS[i] });
      s += code(X(off + n), BY + BH + 34, name, { anchor: "end", weight: 650, color: COLORS[i] });
    }
    s += code(X(off), BY - 18, String(off), { anchor: "middle", color: C.muted });
    off += n;
  });
  s += code(X(size), BY - 18, String(size), { anchor: "middle", weight: 650 });
  // The next vertex: its first members, faded.
  s += `<g opacity="0.45">`;
  let o2 = size;
  list.slice(0, 2).forEach(([name, n], i) => {
    const w = Math.min(n, size + 8 - o2);
    if (w <= 0) return;
    s += `<rect x="${X(o2) + 1.5}" y="${BY}" width="${w * K - 3}" height="${BH}" rx="5" fill="${SOFT[i]}" stroke="${COLORS[i]}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    o2 += n;
  });
  s += `</g>`;
  s += line(X(size), BY - 8, X(size), BY + BH + 8, { color: C.ink, width: 2 });
  // The stride.
  const sy = BY + BH + (v.api === "vulkan" ? 66 : 32);
  s += arrow(X(0), sy, X(size), sy, { both: true, color: C.ink, width: 1.5 });
  s += `<rect x="${X(size / 2) - 128}" y="${sy - 14}" width="256" height="28" fill="${C.card}"/>`;
  s += code(X(size / 2), sy, `sizeof(Vertex) = ${size}`, { anchor: "middle", weight: 650 });
  return svg(typeof height === "function" ? height(v) : height, s);
}
