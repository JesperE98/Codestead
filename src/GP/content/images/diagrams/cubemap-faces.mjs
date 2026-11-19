// Cubemaps, "Skybox": the course's six sky images laid out as an unfolded cube – the four sides in a row as you see
// them turning round inside the cube (-X, -Z, +X, +Z), the top above and the bottom below -Z, the face the default
// camera looks at. Each face with its axis and its file. Language-free.
import { C, PAD, W, asset, pill, svg } from "./style.mjs";
import { SML } from "./_advgl.mjs";

export const variants = [{ out: "cubemap-faces.webp", lang: "en" }];
export const lossy = true;

const S = 160; // a face
const X0 = (W - 4 * S) / 2, Y0 = PAD;
export const height = Y0 + 3 * S + PAD;

const faces = [
  // [column, row, axis, file, rotation of the image in degrees]
  [1, 0, "+Y", "top.png"],
  [0, 1, "−X", "left.png"],
  [1, 1, "−Z", "back.png"],
  [2, 1, "+X", "right.png"],
  [3, 1, "+Z", "front.png"],
  [1, 2, "−Y", "bottom.png"],
];

export function draw() {
  let s = "";
  for (const [col, row, axis, file] of faces) {
    const x = X0 + col * S, y = Y0 + row * S;
    s += `<image href="${asset(`opengl/cubemaps/solution/skybox/${file}`)}" x="${x}" y="${y}" width="${S}" height="${S}" preserveAspectRatio="none"/>`;
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="none" stroke="#ffffff" stroke-width="1.5"/>`;
    s += pill(x + 8, y + 22, axis, { size: SML, mono: true, w: 46 });
    s += pill(x + S / 2, y + S - 20, file, { size: SML, mono: true, anchor: "middle" });
  }
  s += `<rect x="${X0}" y="${Y0 + S}" width="${4 * S}" height="${S}" fill="none" stroke="${C.boxStroke}" stroke-width="1"/>`;
  return svg(height, s);
}
