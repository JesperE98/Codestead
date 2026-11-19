// Cascaded Shadow Mapping: three layers of the shadow map array as the depth pass fills them – the debug view of the
// task depth-maps, drawn by the simulator from the course's OpenGL project with the layers 0, 1 and 2 – and the cascade
// view of the task cascade-layer. Each layer covers its own slice of the view (0.1–10, 10–20, 20–50 units) as the
// light sees it: the near ones a small piece of floor, sharp; the far one the whole floor's far corner.
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("csm-layers");
const GAP = 12, PW = (W - 2 * PAD - 2 * GAP) / 3;
export const height = PAD + PW + 44 + (W - 2 * PAD) * 0.75 * 0.62 + 50 + PAD;
export const lossy = true;
const layer = (n) => [{ file: "main.cpp", find: "int debugLayer = 2; // the third cascade (20 to 50 units from the camera)", replace: `int debugLayer = ${n};` }];
export const renders = {
  l0: { api: "opengl", chapter: "csm", from: "task:depth-maps", edits: layer(0), width: Math.round(PW * 2 / 0.75) },
  l1: { api: "opengl", chapter: "csm", from: "task:depth-maps", edits: layer(1), width: Math.round(PW * 2 / 0.75) },
  l2: { api: "opengl", chapter: "csm", from: "task:depth-maps", width: Math.round(PW * 2 / 0.75) },
  tint: { api: "opengl", chapter: "csm", from: "task:cascade-layer", width: Math.round((W - 2 * PAD) * 0.62 * 2) },
};

export function draw(v, R) {
  let s = "";
  [["l0", "0.1 – 10"], ["l1", "10 – 20"], ["l2", "20 – 50"]].forEach(([id, d], i) => {
    const x = PAD + i * (PW + GAP), r = R[id][0];
    // the quad fills the window; show its middle square
    const id2 = `cl${i}`, w = PW / 0.75;
    s += `<clipPath id="${id2}"><rect x="${x}" y="${PAD}" width="${PW}" height="${PW}" rx="6"/></clipPath>`;
    s += `<g clip-path="url(#${id2})">${image(r.href, x - (w - PW) / 2, PAD, w, PW, { border: false, r: 0 })}</g>`;
    s += `<rect x="${x}" y="${PAD}" width="${PW}" height="${PW}" rx="6" fill="none" stroke="#c3cad5"/>`;
    s += label(x + PW / 2, PAD + PW + 22, `${t(v, "layer", "lager")} ${i}: ${t(v, d, d.replace(".", ","))}`, { anchor: "middle", fit: PW + GAP });
  });
  const tw = (W - 2 * PAD) * 0.62, th = tw * 0.75, ty = PAD + PW + 50;
  s += image(R.tint[0].href, (W - tw) / 2, ty, tw, th);
  s += label(W / 2, ty + th + 24, t(v, "the cascade of each fragment", "varje fragments kaskad"), { anchor: "middle" });
  return svg(height, s);
}
