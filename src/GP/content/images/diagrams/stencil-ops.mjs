// Stencil testing, "Stencil functions": which of the three stencil operations is applied to a fragment – the stencil
// test fails, the depth test fails, or both pass – with each API's names for them. One variant per API and language.
import { C, PAD, W, arrow, box, perApi, svg, t, text } from "./style.mjs";
import { LBL, SML } from "./_advgl.mjs";

export const variants = perApi("stencil-ops", ["opengl", "vulkan", "d3d12"], true);

const names = {
  opengl: ["glStencilOp(sfail, dpfail, dppass)", "sfail", "dpfail", "dppass"],
  vulkan: ["VkStencilOpState", "failOp", "depthFailOp", "passOp"],
  d3d12: ["D3D12_DEPTH_STENCILOP_DESC", "StencilFailOp", "StencilDepthFailOp", "StencilPassOp"],
};

const RH = 64, VG = 50, TOP = PAD + 44;
const TX = PAD, TW = 236, OX = W - PAD - 300, OW = 300;
export const height = TOP + 3 * RH + 2 * VG + PAD;

export function draw(v) {
  const [header, ...ops] = names[v.api];
  let s = text(PAD, PAD + 14, header, { mono: true, size: SML, color: C.muted });
  const tests = [t(v, "Stencil test", "Stenciltestet"), t(v, "Depth test", "Djuptestet"), t(v, "Both passed", "Båda gick igenom")];
  const results = [t(v, "the fragment is discarded", "fragmentet kastas"), t(v, "the fragment is discarded", "fragmentet kastas"), t(v, "the fragment is drawn", "fragmentet ritas")];
  for (let i = 0; i < 3; i++) {
    const y = TOP + i * (RH + VG);
    s += box(TX, y, TW, RH, { style: i === 2 ? "accent2" : "plain", label: tests[i], size: LBL });
    s += `<rect x="${OX}" y="${y}" width="${OW}" height="${RH}" rx="6" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
    s += text(OX + 16, y + 21, ops[i], { mono: true, size: LBL, weight: 600, fit: OW - 24 });
    s += text(OX + 16, y + 46, results[i], { size: SML, color: C.muted, fit: OW - 24 });
    s += arrow(TX + TW + 6, y + RH / 2, OX - 6, y + RH / 2, { color: i === 2 ? C.good : C.bad, width: 2 });
    if (i < 2) {
      s += text((TX + TW + OX) / 2, y + RH / 2 - 16, t(v, "fails", "misslyckas"), { anchor: "middle", size: SML, weight: 600, color: C.bad });
      s += arrow(TX + TW / 2, y + RH + 4, TX + TW / 2, y + RH + VG - 4, { color: C.good, width: 2 });
      s += text(TX + TW / 2 + 14, y + RH + VG / 2, t(v, "passes", "går igenom"), { size: SML, weight: 600, color: C.good });
    }
  }
  return svg(height, s);
}
