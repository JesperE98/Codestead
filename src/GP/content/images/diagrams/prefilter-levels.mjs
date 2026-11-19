// Specular IBL, "Pre-filtering an HDR environment map": the pre-filter map's five mip levels, each drawn as the
// background by the simulator (the chapter's OpenGL project after the task prefilter-map, the spheres left out):
// level n holds the environment blurred for the roughness n / 4, from 64 × 64 down to 4 × 4 texels per face.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { crop } from "./_advlight.mjs";

export const variants = perLanguage("prefilter-levels");
export const lossy = true;

const GAP = 10, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW * 0.75;
export const height = PAD + 2 * PH + GAP + PAD;
const r = (lod) => ({
  api: "opengl", chapter: "specular-ibl", from: "task:prefilter-map", width: Math.round(PW * 2),
  edits: [
    { file: "main.cpp", find: "    int nrRows    = 7;", replace: "    int nrRows    = 0;" },
    { file: "background.fs", find: "textureLod(environmentMap, WorldPos, 1.2)", replace: `textureLod(environmentMap, WorldPos, ${lod}.0)` },
  ],
});
export const renders = Object.fromEntries([0, 1, 2, 3, 4].map((l) => [`l${l}`, r(l)]));

export function draw(v, R) {
  let s = "";
  for (let l = 0; l < 5; l++) {
    const i = l + (l >= 3 ? 1 : 0); // leave the middle of the second row free … no: fill in order
    const k = l;
    const x = PAD + (k % 3) * (PW + GAP), y = PAD + Math.floor(k / 3) * (PH + GAP), img = R[`l${l}`][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, PW, PH);
    s += pill(x + 6, y + 18, `mip ${l}: ${(l / 4).toFixed(2)}`, { size: 19, color: C.ink });
    void i;
  }
  const x = PAD + 2 * (PW + GAP), y = PAD + PH + GAP;
  s += `<text x="${x + 8}" y="${y + 40}" font-size="19" font-weight="600" fill="${C.muted}" font-family="'Inter Variable', Inter, sans-serif">${t(v, "mip n: roughness n / 4", "mip n: roughness n / 4")}</text>`;
  s += `<text x="${x + 8}" y="${y + 70}" font-size="19" font-weight="600" fill="${C.muted}" font-family="'Inter Variable', Inter, sans-serif">${t(v, "64 × 64 → 4 × 4 texels", "64 × 64 → 4 × 4 texlar")}</text>`;
  return svg(height, s);
}
