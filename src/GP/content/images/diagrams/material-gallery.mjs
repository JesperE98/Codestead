// Materials, after the paragraph about the table of real materials: the chapter's cube with five materials of that
// table (the values of the OpenGL teapot table), lit by a white light at full strength as the exercise says, drawn by
// the simulator. The shininess is the table's value times 128.
import { PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("material-gallery");
export const lossy = true;

const materials = [
  { id: "emerald", en: "Emerald", sv: "Smaragd", a: [0.0215, 0.1745, 0.0215], d: [0.07568, 0.61424, 0.07568], s: [0.633, 0.727811, 0.633], n: 0.6 },
  { id: "ruby", en: "Ruby", sv: "Rubin", a: [0.1745, 0.01175, 0.01175], d: [0.61424, 0.04136, 0.04136], s: [0.727811, 0.626959, 0.626959], n: 0.6 },
  { id: "gold", en: "Gold", sv: "Guld", a: [0.24725, 0.1995, 0.0745], d: [0.75164, 0.60648, 0.22648], s: [0.628281, 0.555802, 0.366065], n: 0.4 },
  { id: "silver", en: "Silver", sv: "Silver", a: [0.19225, 0.19225, 0.19225], d: [0.50754, 0.50754, 0.50754], s: [0.508273, 0.508273, 0.508273], n: 0.4 },
  { id: "cyan", en: "Cyan plastic", sv: "Cyan plast", a: [0.0, 0.1, 0.06], d: [0.0, 0.50980392, 0.50980392], s: [0.50196078, 0.50196078, 0.50196078], n: 0.25 },
];

const GAP = 12;
const S = (W - 2 * PAD - 4 * GAP) / 5;
export const height = PAD + S + 44;

const f = (x) => `${x}f`;
const v3 = (c) => c.map(f).join(", ");

export const renders = Object.fromEntries(
  materials.map((m) => [
    m.id,
    {
      api: "opengl",
      chapter: "materials",
      from: "task:light",
      edits: [
        {
          file: "main.cpp",
          find: `        lightingShader.setVec3("material.ambient", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.diffuse", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.specular", 0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
        lightingShader.setFloat("material.shininess", 32.0f);`,
          replace: `        lightingShader.setVec3("material.ambient", ${v3(m.a)});
        lightingShader.setVec3("material.diffuse", ${v3(m.d)});
        lightingShader.setVec3("material.specular", ${v3(m.s)});
        lightingShader.setFloat("material.shininess", ${f(m.n * 128)});`,
        },
        {
          file: "main.cpp",
          find: `        lightingShader.setVec3("light.ambient", 0.2f, 0.2f, 0.2f);
        lightingShader.setVec3("light.diffuse", 0.5f, 0.5f, 0.5f); // darken diffuse light a bit`,
          replace: `        lightingShader.setVec3("light.ambient", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("light.diffuse", 1.0f, 1.0f, 1.0f);`,
        },
      ],
      width: 800,
    },
  ]),
);

export function draw(v, R) {
  let s = "";
  materials.forEach((m, i) => {
    const x = PAD + i * (S + GAP);
    s += crop(R[m.id][0], 88, 236, 280, 280, x, PAD, S, S);
    s += text(x + S / 2, PAD + S + 24, t(v, m.en, m.sv), { size: L - 1, weight: 650, anchor: "middle", fit: S + GAP - 2 });
  });
  return svg(height, s);
}
