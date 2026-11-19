// Area Lights: the rectangular light's reflection on the wooden floor at four roughness values – the chapter's program
// after the task specular, drawn by the simulator with the constant ROUGHNESS changed. The reflection takes the light's
// shape when the floor is smooth and spreads out as it gets rougher.
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("area-roughness");
const GAP = 12, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + 2 * (PH + 40) + PAD - 6;
export const lossy = true;
const values = ["0.1", "0.3", "0.5", "0.8"];
export const renders = Object.fromEntries(values.map((r) => [`r${r}`, { api: "opengl", chapter: "area-lights", from: "task:specular", width: Math.round(PW * 2),
  edits: r === "0.5" ? [] : [{ file: "main.cpp", find: "const float ROUGHNESS = 0.5f;", replace: `const float ROUGHNESS = ${r}f;` }] }]));

export function draw(v, R) {
  let s = "";
  values.forEach((r, i) => {
    const x = PAD + (i % 2) * (PW + GAP), y = PAD + Math.floor(i / 2) * (PH + 40);
    s += image(R[`r${r}`][0].href, x, y, PW, PH);
    s += label(x + PW / 2, y + PH + 20, `${t(v, "roughness", "strävhet")} ${t(v, r, r.replace(".", ","))}`, { anchor: "middle" });
  });
  return svg(height, s);
}
