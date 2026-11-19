// Coordinate Systems, "Perspective projection": the chapter's scene with three fields of view, drawn by the simulator
// from the course's OpenGL solution with only the fov changed – a small fov zooms in, a large one shows more and
// distorts the edges. Each label has the angle drawn as a wedge. Language-free.
import { C, PAD, W, image, svg, text } from "./style.mjs";

export const variants = [{ out: "field-of-view.webp", lang: "en" }];
export const lossy = true;

const fovs = [30, 45, 90];
const GAP = 14, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = (PW * 3) / 4;
export const height = PAD + PH + 46;

export const renders = Object.fromEntries(
  fovs.map((f) => [
    `fov${f}`,
    {
      api: "opengl",
      chapter: "coordinate-systems",
      edits: [{ file: "main.cpp", find: "glm::radians(45.0f)", replace: `glm::radians(${f}.0f)` }],
      width: Math.round(PW * 2),
      times: [3.0],
    },
  ]),
);

export function draw(v, R) {
  let s = "";
  fovs.forEach((f, i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[`fov${f}`][0].href, x, PAD, PW, PH);
    // The label, with a wedge of the angle (opening to the right, like a camera looking right).
    const ly = PAD + PH + 22, wx = x + PW / 2 - 52, r = 22;
    const a = (f / 2) * (Math.PI / 180);
    s += `<path d="M${wx},${ly} L${wx + r * Math.cos(a)},${ly - r * Math.sin(a)} A${r},${r} 0 0 1 ${wx + r * Math.cos(a)},${ly + r * Math.sin(a)} Z" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
    s += text(wx + r + 10, ly, `fov = ${f}°`, { weight: 600, size: 15 });
  });
  return svg(height, s);
}
