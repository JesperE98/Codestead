// Advanced Lighting, after "Implementing Blinn-Phong": the chapter's floor drawn by the simulator with Phong and with
// Blinn-Phong – with the exponent 1.0 of learnopengl's comparison, where Phong's highlight is cut off, and with the
// chapter's exponents 8 (Phong) and 32 (Blinn-Phong). Only the floor's lower half (where the highlight is) is shown.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop, label } from "./_advlight.mjs";

export const variants = perLanguage("blinn-phong-floor");
export const lossy = true;

const GAP = 16;
const PW = (W - 2 * PAD - GAP) / 2; // a render's width
const RW = Math.round(PW * 2), RH = Math.round((RW * 3) / 4); // the render, 4:3
const CY = 0.5, CH = 0.5; // the part shown: the lower half of the window
const PH = PW * 0.75 * CH;
const ROW = 32 + PH + 14;
export const height = PAD + 2 * ROW - 14 + PAD - 6;

const fs = "advanced_lighting.fs";
const phong = (exp) => [
  { file: "main.cpp", find: "bool blinn = true;", replace: "bool blinn = false;" },
  { file: fs, find: "spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);", replace: `spec = pow(max(dot(viewDir, reflectDir), 0.0), ${exp});` },
];
const blinn = (exp) => [
  { file: fs, find: "spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);", replace: `spec = pow(max(dot(normal, halfwayDir), 0.0), ${exp});` },
];
// Only the specular term, as a grey: spec itself, 0 to 1.
const only = [{ file: fs, find: "    FragColor = vec4(ambient + diffuse + specular, 1.0);", replace: "    FragColor = vec4(vec3(spec), 1.0);" }];
const r = (edits) => ({ api: "opengl", chapter: "advanced-lighting", edits, width: RW });

export const renders = {
  phong1: r([...phong("1.0"), ...only]),
  blinn1: r([...blinn("1.0"), ...only]),
  phong8: r(phong("8.0")),
  blinn32: r(blinn("32.0")),
};

export function draw(v, R) {
  const rows = [
    [t(v, "Only the specular term, exponent 1", "Bara den spekulära termen, exponent 1"), [["phong1", "Phong"], ["blinn1", "Blinn-Phong"]]],
    [t(v, "The whole lighting", "Hela belysningen"), [["phong8", "Phong, 8"], ["blinn32", "Blinn-Phong, 32"]]],
  ];
  let s = "";
  rows.forEach(([heading, row], j) => {
    const y = PAD + j * ROW;
    s += label(W / 2, y + 12, heading, { anchor: "middle", fit: W - 2 * PAD, color: C.muted });
    row.forEach(([id, name], i) => {
      const x = PAD + i * (PW + GAP);
      const img = R[id][0];
      s += crop(img.href, img.width, img.height, 0, img.height * CY, img.width, img.height * CH, x, y + 30, PW, PH);
      s += pill(x + 10, y + 30 + 20, name, { size: L, color: i === 1 ? C.accent2 : C.ink });
    });
  });
  return svg(height, s);
}
