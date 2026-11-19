// Multiple lights, the complete uniform block (Vulkan) / constant buffer (Direct3D 12): every member with its offset
// and its size, 640 bytes in all. The point lights are an array with a stride of 80 bytes: each PointLight ends at 76,
// and the next element starts at the next multiple of 16 – the 4 hatched bytes, which the C++ struct fills with a
// padding float. Language-free (the code's names and the numbers).
import { C, PAD, svg, text } from "./style.mjs";
import { LS, hatchDef } from "./_lighting.mjs";

export const variants = [
  { out: "uniform-lights-vulkan.webp", lang: "en", api: "vulkan" },
  { out: "uniform-lights-d3d12.webp", lang: "en", api: "d3d12" },
];

const RH = 36, BX = 290, K = 2.1; // the row height, where the bars start, pixels per byte
export const height = PAD + 10 * RH + 18;

export function draw(v) {
  const rows = [
    [0, v.api === "vulkan" ? "view, proj" : "view, projection", 128, C.line],
    [128, "viewPos", 16, C.line],
    [144, "material", 16, C.line],
    [160, "dirLight", 64, C.y],
    [224, "pointLights[0]", 80, C.accent, 4],
    [304, "pointLights[1]", 80, C.accent, 4],
    [384, "pointLights[2]", 80, C.accent, 4],
    [464, "pointLights[3]", 80, C.accent, 4],
    [544, "spotLight", 96, C.accent2],
  ];
  let s = hatchDef;
  rows.forEach(([off, name, size, color, pad], i) => {
    const y = PAD + i * RH;
    s += text(PAD + 52, y + RH / 2, String(off), { size: LS, anchor: "end", mono: true, color: C.muted });
    s += text(PAD + 70, y + RH / 2, name, { size: LS, mono: true, weight: 600, fit: BX - PAD - 78 });
    const w = size * K, pw = (pad ?? 0) * K;
    s += `<rect x="${BX}" y="${y + 5}" width="${w - pw}" height="${RH - 10}" rx="4" fill="${color === C.line ? "#eef0f4" : color}" fill-opacity="${color === C.line ? 1 : 0.22}" stroke="${color}" stroke-width="1.5"/>`;
    if (pw) s += `<rect x="${BX + w - pw}" y="${y + 5}" width="${pw}" height="${RH - 10}" fill="url(#hatch)" stroke="${C.line}" stroke-width="1"/>`;
    s += text(BX + w + 10, y + RH / 2, pad ? `${size - pad} + ${pad}` : String(size), { size: LS, mono: true, color: pad ? C.accent : C.muted, weight: 600 });
  });
  s += text(PAD + 52, PAD + 9 * RH + RH / 2, "640", { size: LS, anchor: "end", mono: true, color: C.ink, weight: 650 });
  return svg(height, s);
}
