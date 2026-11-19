// Materials, after the quiz about the shininess: the chapter's coral cube (after the task "light") with five
// shininess values, drawn by the simulator – the higher the exponent, the smaller and sharper the highlight. Only the
// front face is shown, and the lamp is moved from (1.2, 1.0, 2.0) to (2.0, 0.2, 2.0), so that the highlight lands in the
// middle of the face instead of at its upper-left edge. Language-free (numbers only).
import { C, PAD, W, svg, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = [{ out: "shininess.webp", lang: "en" }];
export const lossy = true;

const values = [2, 8, 32, 128, 256];
const GAP = 12;
const S = (W - 2 * PAD - 4 * GAP) / 5;
export const height = PAD + S + 44;

export const renders = Object.fromEntries(
  values.map((n) => [
    `s${n}`,
    {
      api: "opengl",
      chapter: "materials",
      from: "task:light",
      edits: [
        { file: "main.cpp", find: `lightingShader.setFloat("material.shininess", 32.0f);`, replace: `lightingShader.setFloat("material.shininess", ${n}.0f);` },
        { file: "main.cpp", find: "glm::vec3 lightPos(1.2f, 1.0f, 2.0f);", replace: "glm::vec3 lightPos(2.0f, 0.2f, 2.0f);" },
      ],
      width: 800,
    },
  ]),
);

export function draw(v, R) {
  let s = "";
  values.forEach((n, i) => {
    const x = PAD + i * (S + GAP);
    // The front face of the cube (x about 230–355, y 265–475 of the 800 × 600 window).
    s += crop(R[`s${n}`][0], 214, 250, 160, 160, x, PAD, S, S);
    s += text(x + S / 2, PAD + S + 24, String(n), { size: L, weight: 650, anchor: "middle", mono: true, color: n === 32 ? C.accent : C.ink });
  });
  return svg(height, s);
}
