// Framebuffers, "Rendering to a texture": the two passes of the chapter's program – the scene is drawn into a
// framebuffer of our own (a colour texture and a depth/stencil attachment), then a quad that fills the window samples
// that texture and is drawn into the window. The pictures are the simulator's render of the solution before the
// post-processing (the task screen-quad). One variant per API (its names) and language.
import { C, PAD, W, arrow, badge, image, perApi, svg, t, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = perApi("framebuffer-passes", ["opengl", "vulkan", "d3d12"], true);
export const lossy = true;

const names = {
  opengl: { fb: "framebuffer", colour: "textureColorbuffer", depth: "rbo", window: "framebuffer 0", quad: "screenShader" },
  vulkan: { fb: "offscreenFramebuffer", colour: "offscreenImage", depth: "offscreenDepthImage", window: "swapChainImages[i]", quad: "screenPipeline" },
  d3d12: { fb: "OMSetRenderTargets", colour: "m_offscreenTarget", depth: "m_depthStencil", window: "m_renderTargets[i]", quad: "m_screenPipelineState" },
};

const TW = 232, TH = 174; // a picture of the window
const FX = W - PAD - 2 * TW - 54, FY = PAD + 40; // the framebuffer's frame
export const height = FY + 30 + TH + 44 + 24 + 48 + 38 + TH / 2 + 48 + 14 + PAD;

export const renders = { scene: { api: "opengl", chapter: "framebuffers", from: "task:screen-quad", width: TW * 2 } };

export function draw(v, R) {
  const n = names[v.api];
  const img = R.scene[0].href;
  let s = "";
  // Pass 1: the scene into our framebuffer.
  s += badge(PAD + 14, PAD + 14, 1, { r: 13 });
  s += text(PAD + 36, PAD + 14, t(v, "Draw the scene", "Rita scenen"), { size: LBL, weight: 650 });
  const fw = W - PAD - FX, fh = 30 + TH + 44;
  s += `<rect x="${FX}" y="${FY}" width="${fw}" height="${fh}" rx="8" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
  s += text(FX + 14, FY + 18, n.fb, { mono: true, size: SML, weight: 600, fit: fw - 28 });
  const cx = FX + 14, cy = FY + 34;
  s += image(img, cx, cy, TW, TH);
  s += text(cx + TW / 2, cy + TH + 22, n.colour, { anchor: "middle", mono: true, size: SML, fit: TW + 20 });
  const dx = cx + TW + 26;
  s += `<rect x="${dx}" y="${cy}" width="${fw - (dx - FX) - 14}" height="${TH}" rx="6" fill="#ffffff" stroke="${C.boxStroke}"/>`;
  const dw = fw - (dx - FX) - 14;
  s += text(dx + dw / 2, cy + TH / 2 - 14, t(v, "depth +", "djup +"), { anchor: "middle", size: SML, weight: 600 });
  s += text(dx + dw / 2, cy + TH / 2 + 14, "stencil", { anchor: "middle", size: SML, weight: 600 });
  s += text(dx + dw / 2, cy + TH + 22, n.depth, { anchor: "middle", mono: true, size: SML, fit: dw + 10 });
  // The draw calls go in on the left.
  const lx = PAD, ly = cy + TH / 2;
  s += text(lx, ly - 30, t(v, "cubes,", "kuber,"), { size: SML, color: C.muted });
  s += text(lx, ly - 4, t(v, "floor", "golv"), { size: SML, color: C.muted });
  s += arrow(lx, ly + 22, FX - 8, ly + 22, { color: C.ink, width: 2 });
  // Pass 2: the quad samples the texture and goes into the window.
  const y2 = FY + fh + 24;
  s += badge(PAD + 14, y2 + 14, 2, { r: 13 });
  s += text(PAD + 36, y2 + 14, t(v, "Draw the screen quad", "Rita skärmquaden"), { size: LBL, weight: 650 });
  const by = y2 + 48, bh = 76, bx = PAD, bw = cx + TW - PAD;
  s += arrow(cx + TW / 2, cy + TH + 36, cx + TW / 2, by - 4, { color: C.accent, width: 2, dash: "6 4" });
  s += text(cx + TW / 2 + 12, (cy + TH + 36 + by) / 2 + 4, t(v, "sampled", "samplas"), { size: SML, color: C.accent, weight: 600 });
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += text(bx + bw / 2, by + 24, t(v, "a quad over the whole window", "en quad över hela fönstret"), { anchor: "middle", size: SML, weight: 600, fit: bw - 16 });
  s += text(bx + bw / 2, by + 52, n.quad, { anchor: "middle", mono: true, size: SML, fit: bw - 16 });
  const wx = W - PAD - TW, wy = by + bh / 2 - TH / 2;
  s += arrow(bx + bw + 6, by + bh / 2, wx - 6, by + bh / 2, { color: C.ink, width: 2 });
  s += image(img, wx, wy, TW, TH);
  s += text(wx + TW / 2, wy + TH + 22, t(v, "the window", "fönstret"), { anchor: "middle", size: SML, weight: 600, fit: TW });
  s += text(wx + TW / 2, wy + TH + 48, n.window, { anchor: "middle", mono: true, size: SML, fit: TW });
  return svg(height, s);
}
