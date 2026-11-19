// Rendering Sprites, the rotation: the chapter's ball sprite – at (200, 200), 300 × 400, turned 45° – once without the two
// translations by half the size (it turns about (0, 0) of the quad, its top-left corner) and once with them (about its
// centre), drawn by the simulator from the course's OpenGL project. The dashed box is the unrotated sprite.
import { C, PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("sprite-pivot");
const GAP = 18, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75, K = PW / 800;
export const height = PAD + PH + 44 + PAD - 6;
export const lossy = true;

const corner = [
  { file: "main.cpp", find: "    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad\n", replace: "" },
  { file: "main.cpp", find: "    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back\n", replace: "" },
];
export const renders = {
  corner: { api: "opengl", chapter: "rendering-sprites", edits: corner, width: Math.round(PW * 2) },
  centre: { api: "opengl", chapter: "rendering-sprites", width: Math.round(PW * 2) },
};

export function draw(v, R) {
  let s = "";
  [["corner", t(v, "about the top-left corner", "kring övre vänstra hörnet")], ["centre", t(v, "about the centre", "kring mitten")]].forEach(([id, name], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[id][0].href, x, PAD, PW, PH);
    s += `<rect x="${x + 200 * K}" y="${PAD + 200 * K}" width="${300 * K}" height="${Math.min(400, 399) * K}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.8"/>`;
    const [px, py] = id === "corner" ? [200, 200] : [350, 400];
    s += `<circle cx="${x + px * K}" cy="${PAD + py * K}" r="5" fill="${C.accent}" stroke="#fff" stroke-width="1.5"/>`;
    s += label(x + PW / 2, PAD + PH + 24, name, { anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
