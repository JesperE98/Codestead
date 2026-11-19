// PBR Lighting, after the task fresnel: the 7 × 7 spheres drawn by the simulator after each task of the chapter's
// OpenGL project – Lambert's diffuse alone, the NDF added (unlimited), the geometry function and the normalization,
// Fresnel (the rows differ), and the tone mapping. Metallic grows upwards, the roughness to the right.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { crop, label } from "./_advlight.mjs";

export const variants = perLanguage("pbr-steps");
export const lossy = true;

const GAP = 10, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = PW * 0.75;
export const height = PAD + 2 * PH + GAP + PAD;
const r = (from) => ({ api: "opengl", chapter: "pbr-lighting", from, width: Math.round(PW * 2) });
export const renders = { lambert: r("task:lambert"), ndf: r("task:ndf"), geometry: r("task:geometry"), fresnel: r("task:fresnel"), tonemap: r("task:tone-map") };

export function draw(v, R) {
  let s = "";
  ["lambert", "ndf", "geometry", "fresnel", "tonemap"].forEach((id, i) => {
    const x = PAD + (i % 3) * (PW + GAP), y = PAD + Math.floor(i / 3) * (PH + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, PW, PH);
    s += pill(x + 6, y + PH - 16, id === "tonemap" ? "tone-map" : id, { size: 19, mono: true, color: C.accent });
  });
  // The sixth cell: what the axes are.
  const x = PAD + 2 * (PW + GAP), y = PAD + PH + GAP;
  s += label(x + 8, y + 30, t(v, "↑ metallic", "↑ metallic"), { fit: PW - 16 });
  s += label(x + 8, y + 62, t(v, "→ roughness", "→ roughness"), { fit: PW - 16 });
  s += label(x + 8, y + 104, t(v, "albedo (0.5, 0, 0)", "albedo (0.5, 0, 0)"), { color: C.muted, fit: PW - 16 });
  return svg(height, s);
}
