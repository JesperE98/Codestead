// Tessellation: the stages between the vertex shader and the rasterizer, per API family – GLSL's tessellation control
// and evaluation shaders (OpenGL, Vulkan), HLSL's hull and domain shaders (Direct3D 12) – with what each receives and
// passes on: the patch's control points, the levels, the (u, v) points of the tessellator, and the vertices.
import { BOLD, C, PAD, W, arrow, box, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = ["en", "sv"].flatMap((lang) => [
  { out: `${lang}/tess-stages-opengl-vulkan.webp`, lang, api: "glsl" },
  { out: `${lang}/tess-stages-d3d12.webp`, lang, api: "hlsl" },
]);
const BH = 56, GAPY = 46;
export const height = PAD + 5 * BH + 4 * GAPY + PAD;

export function draw(v) {
  const g = v.api === "glsl";
  const stages = [
    [t(v, "vertex shader", "vertex shader"), t(v, "passes the control points on", "skickar kontrollpunkterna vidare"), "plain"],
    [g ? t(v, "tessellation control shader", "tessellation control shader") : t(v, "hull shader", "hull shader"), t(v, "how finely: the levels", "hur fint: nivåerna"), "accent"],
    [t(v, "tessellator", "tessellatorn"), t(v, "fixed function: (u, v) points", "fast funktion: (u, v)-punkter"), "muted"],
    [g ? t(v, "tessellation evaluation shader", "tessellation evaluation shader") : t(v, "domain shader", "domain shader"), t(v, "where: position, height", "var: position, höjd"), "accent2"],
    [t(v, "rasterizer", "rasteriseraren"), t(v, "ordinary triangles", "vanliga trianglar"), "muted"],
  ];
  const flows = [t(v, "4 control points", "4 kontrollpunkter"), g ? "gl_TessLevelOuter/Inner" : "SV_TessFactor", g ? "gl_TessCoord" : "SV_DomainLocation", g ? "gl_Position" : "SV_Position"];
  let s = "";
  const bw = 330, bx = PAD + 10;
  stages.forEach(([name, what, style], i) => {
    const y = PAD + i * (BH + GAPY);
    s += box(bx, y, bw, BH, { style, label: name, size: 19, fit: bw });
    s += label(bx + bw + 20, y + BH / 2, what, { weight: 500, color: C.muted, fit: W - PAD - bx - bw - 24 });
    if (i < 4) {
      s += arrow(bx + 40, y + BH + 4, bx + 40, y + BH + GAPY - 4, { color: C.ink, width: BOLD });
      s += code(bx + 58, y + BH + GAPY / 2, flows[i], { weight: 600, color: C.accent });
    }
  });
  return svg(height, s);
}
