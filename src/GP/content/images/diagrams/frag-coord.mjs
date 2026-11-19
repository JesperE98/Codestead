// Advanced GLSL, "gl_FragCoord": the task frag-coord – red where the fragment's window x is below 400, green elsewhere –
// drawn by the simulator from the course's OpenGL project, with the window coordinates over it: (0, 0) at the bottom
// left in OpenGL, at the top left in Vulkan and Direct3D (the picture is the same). Language-free.
import { BOLD, C, PAD, W, arrow, image, line, pill, svg } from "./style.mjs";
import { SML } from "./_advgl.mjs";

export const variants = [
  { out: "frag-coord-opengl.webp", lang: "en", api: "opengl" },
  { out: "frag-coord-vulkan-d3d12.webp", lang: "en", api: "vulkan-d3d12" },
];
export const lossy = true;

const PW = 560, PH = 420, X = (W - PW) / 2, Y = PAD;
export const height = Y + PH + PAD;

export const renders = { split: { api: "opengl", chapter: "advanced-glsl", from: "task:frag-coord", width: PW * 2 } };

export function draw(v, R) {
  let s = image(R.split[0].href, X, Y, PW, PH);
  s += line(X + PW / 2, Y + 4, X + PW / 2, Y + PH - 4, { color: "#ffffff", width: 2, dash: "8 6" });
  s += pill(X + PW / 2, Y + 26, "x = 400", { size: SML, mono: true, anchor: "middle" });
  const up = v.api === "opengl";
  const [oy, fy] = up ? [Y + PH, Y] : [Y, Y + PH];
  const dy = up ? -1 : 1;
  // The axes from the origin.
  s += arrow(X + 2, oy + dy * 2, X + 120, oy + dy * 2, { color: C.x, width: BOLD + 1 });
  s += arrow(X + 2, oy + dy * 2, X + 2, oy + dy * 110, { color: C.y, width: BOLD + 1 });
  s += pill(X + 14, oy + dy * 28 + (up ? -14 : 14), "(0, 0)", { size: SML, mono: true });
  s += pill(X + PW - 12, fy - dy * 26, "(800, 600)", { size: SML, mono: true, anchor: "end" });
  return svg(height, s);
}
