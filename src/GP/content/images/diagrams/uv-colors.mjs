// Model (Vulkan), after the task "load-model": the planet still drawn in its texture coordinates – u as red, v as
// green – by the simulator from the chapter's Vulkan program. The pole at the top is almost pure red (v ≈ 0, the top
// of the image, after the flip), and the ring's seam is a sharp edge where its u wraps from 1 back to 0. The square on
// the right is the key. Language-free.
import { C, PAD, W, svg, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = [{ out: "uv-colors.webp", lang: "en" }];
export const lossy = true;

const PW = 520, PH = PW * 0.75, K = 120;
export const height = PAD * 2 + PH;

export const renders = { uv: { api: "vulkan", chapter: "model", from: "task:load-model", width: 1040 } };

export function draw(v, R) {
  const r = R.uv[0];
  let s = crop(r, r.width * 0.12, r.height * 0.12, r.width * 0.76, r.height * 0.76, PAD, PAD, PW, PH);
  // The key: u to the right (red), v downwards (green), as Vulkan's texture coordinates run.
  const kx = PAD + PW + 40, ky = PAD + 60;
  s += `<defs><linearGradient id="gu" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>` +
    `<linearGradient id="gv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient></defs>`;
  s += `<rect x="${kx}" y="${ky}" width="${K}" height="${K}" fill="url(#gu)"/><rect x="${kx}" y="${ky}" width="${K}" height="${K}" fill="url(#gv)" style="mix-blend-mode:screen"/>`;
  s += `<rect x="${kx}" y="${ky}" width="${K}" height="${K}" fill="none" stroke="${C.boxStroke}"/>`;
  s += text(kx + K / 2, ky - 18, "*u* →", { size: L, weight: 650, anchor: "middle", color: C.x });
  s += text(kx - 10, ky + K / 2, "*v*", { size: L, weight: 650, anchor: "end", color: C.y });
  s += text(kx - 10, ky + K / 2 + 22, "↓", { size: L, weight: 650, anchor: "end", color: C.y });
  s += text(kx, ky + K + 22, "0", { size: 19, mono: true, color: C.muted, anchor: "middle" });
  s += text(kx + K, ky + K + 22, "1", { size: 19, mono: true, color: C.muted, anchor: "middle" });
  return svg(height, s);
}
