// Lighting maps, after the task "specular-map": the front face of the crate before and after the specular map, drawn
// by the simulator from the chapter's OpenGL program, with the lamp moved from (1.2, 1.0, 2.0) to (2.0, 0.2, 2.0) so
// that the highlight lands in the middle of the face. With the diffuse map only, the highlight covers wood and steel
// alike; with the specular map only the steel frame shines.
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("specular-map-effect");
export const lossy = true;

const GAP = 16, S = (W - 2 * PAD - GAP) / 2;
export const height = PAD + S + 46;

const lamp = [{ file: "main.cpp", find: "glm::vec3 lightPos(1.2f, 1.0f, 2.0f);", replace: "glm::vec3 lightPos(2.0f, 0.2f, 2.0f);" }];
export const renders = {
  before: { api: "opengl", chapter: "lighting-maps", from: "task:diffuse-map", edits: lamp, width: 1600 },
  after: { api: "opengl", chapter: "lighting-maps", from: "task:specular-map", edits: lamp, width: 1600 },
};

export function draw(v, R) {
  let s = "";
  // The front face of the cube in the 1600 × 1200 render (x about 465–715, y 530–955 at this size).
  const box = [418, 572, 340, 340];
  s += crop(R.before[0], ...box, PAD, PAD, S, S);
  s += crop(R.after[0], ...box, PAD + S + GAP, PAD, S, S);
  s += text(PAD + S / 2, PAD + S + 26, t(v, "Diffuse map only", "Bara diffuse map"), { size: L, weight: 650, anchor: "middle", color: C.muted });
  s += text(PAD + S + GAP + S / 2, PAD + S + 26, t(v, "With the specular map", "Med specular map"), { size: L, weight: 650, anchor: "middle", color: C.accent });
  return svg(height, s);
}
