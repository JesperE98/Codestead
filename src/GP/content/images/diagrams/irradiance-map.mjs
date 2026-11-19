// Diffuse Irradiance, after the task irradiance-map: the environment cube map and the irradiance map convolved from
// it, each drawn as the background by the simulator (the chapter's OpenGL project, the spheres left out) – the same
// view, from the camera looking down -z.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("irradiance-map");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + PAD;
const noSpheres = { file: "main.cpp", find: "    int nrRows    = 7;", replace: "    int nrRows    = 0;" };
const r = (from) => ({ api: "opengl", chapter: "diffuse-irradiance", from, edits: [noSpheres], width: Math.round(PW * 2) });
export const renders = { env: r("task:environment-map"), irr: r("task:irradiance-map") };

export function draw(v, R) {
  let s = "";
  [["env", t(v, "Environment", "Miljön")], ["irr", t(v, "Irradiance map", "Irradiance map")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, name, { size: L, color: i === 1 ? C.accent : C.ink });
  });
  return svg(height, s);
}
