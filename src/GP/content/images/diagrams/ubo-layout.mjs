// Advanced GLSL, "Uniform block layout": the chapter's ExampleBlock in memory, 16 bytes per row and 4 bytes per slot,
// with the offsets of its members – in std140 (OpenGL's layout (std140), the default of Vulkan's GLSL) and as an HLSL
// cbuffer (Direct3D 12), where the float3 moves up into the first row. Padding is hatched. One variant per layout and
// language.
import { C, PAD, W, svg, t, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = ["en", "sv"].flatMap((lang) => [
  { out: `${lang}/ubo-layout-opengl-vulkan.webp`, lang, rules: "std140" },
  { out: `${lang}/ubo-layout-d3d12.webp`, lang, rules: "hlsl" },
]);

// Each row: [offset, [[name, slots, kind]…]] – kind "m" (a member) or "p" (padding).
const layouts = {
  std140: [
    [0, [["value", 1, "m"], ["", 3, "p"]]],
    [16, [["vector", 3, "m"], ["", 1, "p"]]],
    [32, [["matrix[0]", 4, "m"]]],
    [48, [["matrix[1]", 4, "m"]]],
    [64, [["matrix[2]", 4, "m"]]],
    [80, [["matrix[3]", 4, "m"]]],
    [96, [["values[0]", 1, "m"], ["", 3, "p"]]],
    [112, [["values[1]", 1, "m"], ["", 3, "p"]]],
    [128, [["values[2]", 1, "m"], ["", 3, "p"]]],
    [144, [["boolean", 1, "m"], ["integer", 1, "m"]]],
  ],
  hlsl: [
    [0, [["value", 1, "m"], ["vector", 3, "m"]]],
    [16, [["matrix[0]", 4, "m"]]],
    [32, [["matrix[1]", 4, "m"]]],
    [48, [["matrix[2]", 4, "m"]]],
    [64, [["matrix[3]", 4, "m"]]],
    [80, [["values[0]", 1, "m"], ["", 3, "p"]]],
    [96, [["values[1]", 1, "m"], ["", 3, "p"]]],
    [112, [["values[2]", 1, "m"]]],
  ],
};

const SW = 136, RH = 34, X0 = PAD + 64, Y0 = PAD + 66;
export const height = (v) => Y0 + layouts[v.rules].length * RH + 70;

export function draw(v) {
  const rows = layouts[v.rules];
  let s = `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="8" height="8" fill="#eef0f4"/><line x1="0" y1="0" x2="0" y2="8" stroke="${C.boxStroke}" stroke-width="3"/></pattern></defs>`;
  s += text(PAD, PAD + 14, v.rules === "std140" ? "layout (std140) uniform ExampleBlock" : "cbuffer ExampleBlock", { mono: true, size: SML, weight: 600 });
  s += text(X0 - 10, Y0 - 18, "offset", { mono: true, size: SML, color: C.muted, anchor: "end" });
  for (let i = 0; i < 4; i++) s += text(X0 + i * SW + SW / 2, Y0 - 18, `+${i * 4}`, { mono: true, size: SML, color: C.muted, anchor: "middle" });
  rows.forEach(([offset, parts], r) => {
    const y = Y0 + r * RH;
    s += text(X0 - 10, y + RH / 2, String(offset), { mono: true, size: SML, anchor: "end", weight: 600 });
    let slot = 0;
    for (const [name, n, kind] of parts) {
      const x = X0 + slot * SW, w = n * SW;
      const fill = kind === "p" ? "url(#hatch)" : name.startsWith("matrix") ? C.zSoft : name === "vector" ? C.accentSoft : "#ffffff";
      s += `<rect x="${x}" y="${y}" width="${w}" height="${RH}" fill="${fill}" stroke="${C.boxStroke}" stroke-width="1"/>`;
      if (name) s += text(x + w / 2, y + RH / 2, name, { mono: true, size: SML, anchor: "middle", fit: w - 6 });
      slot += n;
    }
  });
  s += `<rect x="${X0}" y="${Y0}" width="${4 * SW}" height="${rows.length * RH}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
  // The note under the table.
  const ny = Y0 + rows.length * RH + 34;
  s += `<rect x="${PAD}" y="${ny - 11}" width="22" height="22" fill="url(#hatch)" stroke="${C.boxStroke}"/>`;
  const note = v.rules === "std140"
    ? t(v, "padding – vector starts at a multiple of 16", "utfyllnad – vector börjar på en multipel av 16")
    : t(v, "padding – vector fits in the first row, at 4", "utfyllnad – vector ryms i första raden, på 4");
  s += text(PAD + 32, ny, note, { size: SML, fit: W - 2 * PAD - 32 });
  return svg(height(v), s);
}
