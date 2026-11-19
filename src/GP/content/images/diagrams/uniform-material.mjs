// Materials, after the quiz about the padding (Vulkan and Direct3D 12): the Material struct in 16-byte rows – ambient,
// diffuse and specular each start a row; the C++ struct fills the rest of the first two rows with a float, while
// shininess, a single float, fits into the 4 bytes after specular (offset 44). 48 bytes in all. Language-free.
import { C, PAD, svg, text } from "./style.mjs";
import { LS, rows16 } from "./_lighting.mjs";

export const variants = [
  { out: "uniform-material-vulkan.webp", lang: "en", api: "vulkan" },
  { out: "uniform-material-d3d12.webp", lang: "en", api: "d3d12" },
];
const CW = 150, RH = 50, X = PAD + 4;
export const height = PAD + 3 * RH + 44;

export function draw(v) {
  const vk = v.api === "vulkan";
  const f = [
    { name: "ambient", from: 0, to: 12 },
    { name: vk ? "pad1" : "padding0", from: 12, to: 16, kind: "pad" },
    { name: "diffuse", from: 16, to: 28 },
    { name: vk ? "pad2" : "padding1", from: 28, to: 32, kind: "pad" },
    { name: "specular", from: 32, to: 44 },
    { name: "shininess", from: 44, to: 48, fill: C.accent2Soft, color: C.accent2 },
  ];
  let s = rows16(f, 0, 3, X, PAD, CW, RH);
  s += text(X + 52 - 10, PAD + 3 * RH + 20, "48", { size: LS, anchor: "end", color: C.muted, mono: true });
  return svg(height, s);
}
