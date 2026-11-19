// Debugging: what the window shows as the mistakes are found and fixed, per API – drawn by the simulator from the
// course's own projects: the start with the built-in mistakes, the step after the first fix, the step after the last.
import { C, PAD, W, arrow, image, perApi, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perApi("debug-steps", ["opengl", "vulkan", "d3d12"], true);

const steps = {
  opengl: [["start", null], ["use-program", "task:use-program"], ["fix-texture", "task:fix-texture"]],
  vulkan: [["start", null], ["fix-attribute", "task:fix-attribute"]],
  d3d12: [["start", null], ["descriptor-heaps", "task:descriptor-heaps"], ["fix-texture", "task:fix-texture"]],
};

const GAP = 34;
const size = (n) => {
  const w = Math.min(230, (W - 2 * PAD - (n - 1) * GAP) / n);
  return [w, w * 0.75];
};
export const height = (v) => PAD + size(steps[v.api].length)[1] + 44 + PAD - 8;
export const lossy = true;

export function renders(v) {
  const [w] = size(steps[v.api].length);
  return Object.fromEntries(steps[v.api].map(([id, from]) => [id, { api: v.api, chapter: "debugging", from: from ?? "start", width: Math.round(w * 2) }]));
}

export function draw(v, R) {
  const list = steps[v.api];
  const [w, h] = size(list.length);
  const total = list.length * w + (list.length - 1) * GAP;
  const x0 = (W - total) / 2;
  let s = "";
  list.forEach(([id], i) => {
    const x = x0 + i * (w + GAP);
    s += image(R[id][0].href, x, PAD, w, h);
    s += label(x + w / 2, PAD + h + 24, id === "start" ? t(v, "The start", "Början") : `\`${id}\``, { anchor: "middle", fit: w + GAP - 6 });
    if (i < list.length - 1) s += arrow(x + w + 6, PAD + h / 2, x + w + GAP - 6, PAD + h / 2, { color: C.line, width: 2.5 });
  });
  return svg(height(v), s);
}
