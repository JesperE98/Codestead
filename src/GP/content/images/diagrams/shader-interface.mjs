// Shaders, "Ins and outs": how the stages are connected – the vertex buffer feeds the vertex shader's input, the vertex
// shader's output reaches the fragment (pixel) shader's input, interpolated by the rasterizer, and the fragment shader's
// output goes to the colour buffer. What connects them differs: the name (OpenGL), the location (Vulkan), the semantic
// (Direct3D). The chapter's own declarations, one variant per API.
import { C, PAD, W, arrow, arrowPath, perApi, pill, svg, t, text } from "./style.mjs";

export const variants = perApi("shader-interface", ["opengl", "vulkan", "d3d12"], true);
export const height = 500;

const code = {
  opengl: {
    vs: "shader.vs", fs: "shader.fs",
    vsIn: "layout (location = 0) in vec3 aPos;", vsOut: "out vec4 vertexColor;",
    fsIn: "in vec4 vertexColor;", fsOut: "out vec4 FragColor;",
    feed: "glVertexAttribPointer(0, …)",
  },
  vulkan: {
    vs: "shaders/shader.vert", fs: "shaders/shader.frag",
    vsIn: "layout(location = 0) in vec3 inPosition;", vsOut: "layout(location = 0) out vec4 vertexColor;",
    fsIn: "layout(location = 0) in vec4 vertexColor;", fsOut: "layout(location = 0) out vec4 outColor;",
    feed: "attributeDescriptions[0].location = 0",
  },
  d3d12: {
    vs: "shaders.hlsl: VSMain", fs: "shaders.hlsl: PSMain",
    vsIn: "VSMain(float4 position : POSITION)", vsOut: "PSInput { … float4 color : COLOR; }",
    fsIn: "PSMain(PSInput input) … input.color", fsOut: "float4 PSMain(…) : SV_TARGET",
    feed: 'input layout: { "POSITION", 0, … }',
  },
};

export function draw(v) {
  const c = code[v.api];
  let s = "";
  // From top to bottom: the vertex buffer, the vertex shader, the fragment (pixel) shader, the colour buffer.
  const x = PAD, w = W - 2 * PAD, lineH = 34, boxH = 44 + 2 * (lineH + 8);
  const fsName = v.api === "d3d12" ? "Pixel shader" : "Fragment shader";
  const stage = (y, title, file, lines) => {
    let g = `<rect x="${x}" y="${y}" width="${w}" height="${boxH}" rx="8" fill="#fff" stroke="${C.line}" stroke-width="1.5"/>`;
    g += text(x + 14, y + 20, title, { weight: 700, size: 15 });
    g += text(x + w - 14, y + 20, file, { mono: true, size: 12.5, color: C.muted, anchor: "end" });
    lines.forEach(([line, kind], i) => {
      const ly = y + 40 + i * (lineH + 8);
      g += `<rect x="${x + 12}" y="${ly}" width="${w * 0.62}" height="${lineH}" rx="5" fill="${kind === "in" ? C.zSoft : C.accentSoft}" stroke="${kind === "in" ? C.z : C.accent}"/>`;
      g += text(x + 24, ly + lineH / 2, line, { mono: true, size: 13.5, fit: w * 0.62 - 20 });
    });
    return g;
  };
  const lineMid = (y, i) => y + 40 + i * (lineH + 8) + lineH / 2;
  const lineX = x + 12 + w * 0.31; // the middle of a code line
  // The vertex buffer feeds the vertex shader's input.
  const vbH = 46;
  s += `<rect x="${x}" y="${PAD}" width="${w * 0.62 + 12}" height="${vbH}" rx="8" fill="#fff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += text(x + 14, PAD + 15, t(v, "Vertex buffer", "Vertexbuffert"), { weight: 650, size: 14 });
  s += text(x + 14, PAD + 33, c.feed, { mono: true, size: 12.5, color: C.muted, fit: w * 0.62 - 10 });
  const vsY = PAD + vbH + 26;
  s += stage(vsY, "Vertex shader", c.vs, [[c.vsIn, "in"], [c.vsOut, "out"]]);
  s += arrow(lineX, PAD + vbH + 2, lineX, vsY + 40 - 2, { color: C.z, width: 2 });
  // Vertex shader out → fragment shader in, through the rasterizer.
  const fsY = vsY + boxH + 66;

  const match = { opengl: t(v, "same name and type", "samma namn och typ"), vulkan: t(v, "same location and type", "samma location och typ"), d3d12: t(v, "same semantic", "samma semantik") }[v.api];
  const my = (vsY + boxH + fsY) / 2;
  s += pill(lineX + 14, my - 11, match, { color: C.accent, stroke: C.accent, size: 13 });
  s += text(lineX + 14, my + 13, t(v, "The rasterizer interpolates the values between the vertices.", "Rasteriseraren interpolerar värdena mellan hörnen."), { size: 12.5, color: C.muted });
  s += stage(fsY, fsName, c.fs, [[c.fsIn, "in"], [c.fsOut, "out"]]);
  s += arrow(lineX, lineMid(vsY, 1) + lineH / 2 + 2, lineX, fsY + 40 - 2, { color: C.accent, width: 2.5 });
  // The fragment shader's output becomes the pixel's colour.
  const target = { opengl: t(v, "Colour buffer", "Färgbufferten"), vulkan: t(v, "Colour attachment 0: the swap chain image", "Color attachment 0: swap chain-bilden"), d3d12: t(v, "Render target 0: the back buffer", "Render target 0: den bakre bufferten") }[v.api];
  const ty = height - PAD - 40, tx = x + w * 0.5, tw = x + w - tx;
  s += `<rect x="${tx}" y="${ty}" width="${tw}" height="40" rx="8" fill="${C.clear}"/>`;
  s += text(tx + tw / 2, ty + 20, target, { anchor: "middle", size: 13, weight: 600, color: "#ffffff", fit: tw - 16 });
  const oy = lineMid(fsY, 1);
  s += arrowPath(`M${x + 12 + w * 0.62 + 2},${oy} L${tx + tw / 2 - 6},${oy} Q${tx + tw / 2},${oy} ${tx + tw / 2},${oy + 6} L${tx + tw / 2},${ty - 3}`, tx + tw / 2, ty - 3, 0, 1, { color: C.accent, width: 2 });
  return svg(height, s);
}
