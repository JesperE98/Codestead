// Model, "A note on texture orientation" (after its quiz): the unlit planet of the task "draw-model", drawn by the
// simulator from the OpenGL program – with one flip (aiProcess_FlipUVs), as the chapter does, the white north pole
// is at the top; with a second flip (stbi_set_flip_vertically_on_load(true) as well, as learnopengl's backpack
// program does) the two cancel out and the texture is upside down: the ice is at the south pole.
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("uv-flip");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + 46;

export const renders = {
  once: { api: "opengl", chapter: "model", from: "task:draw-model", width: 1000 },
  twice: {
    api: "opengl",
    chapter: "model",
    from: "task:draw-model",
    edits: [
      {
        file: "main.cpp",
        find: "    // (no stbi_set_flip_vertically_on_load(true) here: aiProcess_FlipUVs in model.h already turns the texture\n    // coordinates the right way up - doing both would turn the textures upside down)",
        replace: "    stbi_set_flip_vertically_on_load(true);",
      },
    ],
    width: 1000,
  },
};

export function draw(v, R) {
  let s = "";
  // The planet and its ring, the middle of the 1000 × 750 render.
  const box = [230, 172, 540, 405];
  s += crop(R.once[0], ...box, PAD, PAD, PW, PH);
  s += crop(R.twice[0], ...box, PAD + PW + GAP, PAD, PW, PH);
  s += text(PAD + PW / 2, PAD + PH + 26, t(v, "One flip ✓", "En vändning ✓"), { size: L, weight: 650, anchor: "middle", color: C.good });
  s += text(PAD + PW + GAP + PW / 2, PAD + PH + 26, t(v, "Two flips ✗", "Två vändningar ✗"), { size: L, weight: 650, anchor: "middle", color: C.bad });
  return svg(height, s);
}
