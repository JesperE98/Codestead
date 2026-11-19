// Basic Lighting, the introduction: the three parts of the Phong lighting model, each alone and added up, drawn by
// the simulator from the chapter's OpenGL program after the task "specular" (the lamp at (1.2, 1.0, 2.0), the camera
// front-left of the cube). Each part is shown times the object's colour, so the sum is exactly the chapter's result.
import { C, PAD, W, svg, t, text, perLanguage } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("phong-components");
export const lossy = true;

const S = 146; // a panel's size
const GAP = (W - 2 * PAD - 4 * S) / 3;
export const height = PAD + S + 44;

const parts = {
  ambient: "ambient * objectColor",
  diffuse: "diffuse * objectColor",
  specular: "specular * objectColor",
  phong: "(ambient + diffuse + specular) * objectColor",
};

export const renders = Object.fromEntries(
  Object.entries(parts).map(([id, sum]) => [
    id,
    {
      api: "opengl",
      chapter: "basic-lighting",
      from: "task:specular",
      edits: [{ file: "basic_lighting.fs", find: "vec3 result = (ambient + diffuse + specular) * objectColor;", replace: `vec3 result = ${sum};` }],
      width: 800,
    },
  ]),
);

export function draw(v, R) {
  const names = t(v, ["Ambient", "Diffuse", "Specular", "Phong"], ["Ambient", "Diffust", "Spekulärt", "Phong"]);
  let s = "";
  ["ambient", "diffuse", "specular", "phong"].forEach((id, i) => {
    const x = PAD + i * (S + GAP);
    // The cube's region of the 800 × 600 window (the cube is at about x 100–355, y 265–475).
    s += crop(R[id][0], 78, 222, 300, 300, x, PAD, S, S);
    s += text(x + S / 2, PAD + S + 24, names[i], { size: L, weight: 650, anchor: "middle", fit: S + GAP - 4, color: i === 3 ? C.accent : C.ink });
    if (i < 3) s += text(x + S + GAP / 2, PAD + S / 2, i < 2 ? "+" : "=", { size: 30, weight: 600, anchor: "middle", color: C.muted });
  });
  return svg(height, s);
}
