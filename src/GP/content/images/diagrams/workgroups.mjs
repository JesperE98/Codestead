// Compute Shaders: the dispatch of 80 × 60 work groups of 10 × 10 invocations over the 800 × 600 texture. The top-left
// corner of the grid of work groups, work group (2, 5) enlarged, and in it the invocation with the local ID (3, 7): its
// global ID is group ID × group size + local ID = (23, 57) – the texel it writes. GLSL's names for OpenGL and Vulkan,
// HLSL's for Direct3D 12.
import { C, PAD, W, line, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = ["en", "sv"].flatMap((lang) => [
  { out: `${lang}/workgroups-opengl-vulkan.webp`, lang, glsl: true },
  { out: `${lang}/workgroups-d3d12.webp`, lang, glsl: false },
]);
export const height = 440;

export function draw(v) {
  const names = v.glsl ? ["gl_WorkGroupID", "gl_LocalInvocationID", "gl_GlobalInvocationID"] : ["SV_GroupID", "SV_GroupThreadID", "SV_DispatchThreadID"];
  let s = "";
  // the grid of work groups (the top-left 8 × 7 of 80 × 60)
  const g = 34, gx0 = PAD + 10, gy0 = PAD + 40;
  s += label(gx0, PAD + 14, t(v, "work groups", "arbetsgrupper"), { weight: 700 });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) {
    const hit = i === 2 && j === 5;
    s += `<rect x="${gx0 + i * g}" y="${gy0 + j * g}" width="${g - 3}" height="${g - 3}" rx="3" fill="${hit ? C.accentSoft : "#fff"}" stroke="${hit ? C.accent : C.boxStroke}" stroke-width="${hit ? 2.5 : 1}"/>`;
  }
  s += code(gx0 + 8 * g + 4, gy0 + 7 * g + 4, "…", { color: C.muted });
  // the enlarged group (2, 5)
  const c = 24, ex = W - PAD - 10 * c - 10, ey = gy0;
  s += line(gx0 + 3 * g - 3, gy0 + 5 * g, ex, ey, { color: C.accent, width: 1.2, dash: "4 3" });
  s += line(gx0 + 3 * g - 3, gy0 + 6 * g - 3, ex, ey + 10 * c, { color: C.accent, width: 1.2, dash: "4 3" });
  s += label(ex, PAD + 14, `${t(v, "group", "grupp")} (2, 5): 10 × 10`, { weight: 700 });
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    const hit = i === 3 && j === 7;
    s += `<rect x="${ex + i * c}" y="${ey + j * c}" width="${c - 2}" height="${c - 2}" rx="2" fill="${hit ? C.accent2 : C.accentSoft}" stroke="${hit ? C.accent2 : C.accent}" stroke-width="1"/>`;
  }
  const ty = gy0 + 7 * g + 50;
  s += code(PAD + 10, ty, `${names[0]} = (2, 5)`, { weight: 600, color: C.accent });
  s += code(PAD + 10, ty + 32, `${names[1]} = (3, 7)`, { weight: 600, color: C.accent2 });
  s += code(PAD + 10, ty + 64, `${names[2]} = (2·10 + 3, 5·10 + 7) = (23, 57)`, { weight: 700, fit: W - 2 * PAD - 10 });
  return svg(height, s);
}
