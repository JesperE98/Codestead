// Deferred Shading, "The G-buffer": what the chapter's G-buffer holds for the nine boxes, drawn by the simulator (the
// lighting pass shows one target instead of lighting): the world-space positions (xyz as rgb, scaled into 0..1), the
// normals (n · 0.5 + 0.5), the albedo and the specular intensity. Language-free: the targets' names.
import { C, PAD, W, pill, svg } from "./style.mjs";
import { crop } from "./_advlight.mjs";

export const variants = [{ out: "g-buffer.webp", lang: "en" }];
export const lossy = true;

const GAP = 12, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + 2 * PH + GAP + PAD;

const show = (expr) => [{
  file: "deferred_shading.fs",
  find: "    FragColor = vec4(lighting, 1.0);",
  replace: `    if (length(Normal) < 0.5)\n        FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n    else\n        FragColor = vec4(${expr}, 1.0);`,
}];
const r = (expr) => ({ api: "opengl", chapter: "deferred-shading", from: "task:lighting-pass", edits: show(expr), width: Math.round(PW * 2) });
export const renders = {
  position: r("FragPos / 8.0 + 0.5"),
  normal: r("Normal * 0.5 + 0.5"),
  albedo: r("Diffuse"),
  specular: r("vec3(Specular)"),
};

export function draw(v, R) {
  let s = "";
  [["position", "gPosition"], ["normal", "gNormal"], ["albedo", "gAlbedoSpec.rgb"], ["specular", "gAlbedoSpec.a"]].forEach(([id, name], i) => {
    const x = PAD + (i % 2) * (PW + GAP), y = PAD + Math.floor(i / 2) * (PH + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, PW, PH);
    s += pill(x + 8, y + 20, name, { size: 19, mono: true, color: C.ink });
  });
  return svg(height, s);
}
