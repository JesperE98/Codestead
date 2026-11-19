// Model, after the quiz about the faint highlight: the lit planet of the task "lighting", drawn by the simulator from
// the OpenGL solution – from the chapter's camera at (0, 0, 3) the light's reflection falls on land, where the
// specular map is dark, so the highlight is faint; from a camera up and to the left, looking at the planet, it falls
// on an ocean, where the specular map is bright, and the highlight is a small bright spot.
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("planet-highlight");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + 46;

// The moved camera: 3 units from the planet, 60° to the left and 40° up, looking at it.
const az = (-60 * Math.PI) / 180, el = (40 * Math.PI) / 180;
const CAM = [3 * Math.sin(az) * Math.cos(el), 3 * Math.sin(el), 3 * Math.cos(az) * Math.cos(el)];
const f3 = (a) => a.map((x) => `${x.toFixed(4)}f`).join(", ");

export const renders = {
  start: { api: "opengl", chapter: "model", width: 1000 },
  moved: {
    api: "opengl",
    chapter: "model",
    edits: [
      { file: "main.cpp", find: "glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);", replace: `glm::vec3 cameraPos   = glm::vec3(${f3(CAM)});` },
      { file: "main.cpp", find: "glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);", replace: `glm::vec3 cameraFront = glm::vec3(${f3(CAM.map((x) => -x / 3))});` },
    ],
    width: 1000,
  },
};

export function draw(v, R) {
  let s = "";
  const box = [290, 218, 420, 315];
  s += crop(R.start[0], ...box, PAD, PAD, PW, PH);
  s += crop(R.moved[0], ...box, PAD + PW + GAP, PAD, PW, PH);
  s += text(PAD + PW / 2, PAD + PH + 26, t(v, "Highlight on land", "Högdager på land"), { size: L, weight: 650, anchor: "middle", color: C.muted });
  s += text(PAD + PW + GAP + PW / 2, PAD + PH + 26, t(v, "Highlight on an ocean", "Högdager på ett hav"), { size: L, weight: 650, anchor: "middle", color: C.accent });
  return svg(height, s);
}
