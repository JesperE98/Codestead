// Colors, after the quiz about the padding float (Vulkan and Direct3D 12): the uniform block / constant buffer of the
// chapter in 16-byte rows. view and proj(ection) take bytes 0–127; objectColor 128–139; a vec3 / float3 can't start
// at 140 (std140: a vec3 starts at a multiple of 16; HLSL: a float3 never crosses a row), so lightColor starts at 144,
// and the C++ struct fills the gaps with a float. Language-free (the code's names and the offsets).
import { C, PAD, W, svg, text } from "./style.mjs";
import { LS, rows16 } from "./_lighting.mjs";

export const variants = [
  { out: "uniform-colors-vulkan.webp", lang: "en", api: "vulkan" },
  { out: "uniform-colors-d3d12.webp", lang: "en", api: "d3d12" },
];
const CW = 150, RH = 50, X = PAD + 4;
export const height = PAD + RH + 2 * RH + 50;

export function draw(v) {
  const vk = v.api === "vulkan";
  let s = "";
  // Bytes 0–127, the two matrices, as one block.
  s += text(X + 52 - 10, PAD + RH / 2, "0", { size: LS, anchor: "end", color: C.muted, mono: true });
  s += `<rect x="${X + 52 + 2}" y="${PAD + 3}" width="${4 * CW - 4}" height="${RH - 6}" rx="5" fill="#eef0f4" stroke="${C.line}" stroke-width="1.5"/>`;
  s += text(X + 52 + 2 * CW, PAD + RH / 2, vk ? "view, proj  (0–127)" : "view, projection  (0–127)", { size: LS, anchor: "middle", mono: true, weight: 600, color: C.muted });
  const f = [
    { name: "objectColor", from: 128, to: 140 },
    { name: vk ? "pad1" : "padding0", from: 140, to: 144, kind: "pad" },
    { name: "lightColor", from: 144, to: 156, fill: C.accent2Soft, color: C.accent2 },
    { name: vk ? "pad2" : "padding1", from: 156, to: 160, kind: "pad" },
  ];
  s += rows16(f, 128, 2, X, PAD + RH + 8, CW, RH);
  s += text(X + 52 - 10, PAD + 3 * RH + 8 + 20, "160", { size: LS, anchor: "end", color: C.muted, mono: true });
  return svg(height, s);
}
