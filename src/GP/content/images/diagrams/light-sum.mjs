// Multiple lights, "Putting it all together": the three phases of the fragment shader, each on its own – the
// directional light, the four point lights and the flashlight – drawn by the simulator from the chapter's OpenGL
// solution with main() writing only that phase's colour. Their sum is the chapter's result.
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { L, crop } from "./_lighting.mjs";

export const variants = perLanguage("light-sum");
export const lossy = true;

const OP = 30, PW = (W - 2 * PAD - 2 * OP) / 3, PH = PW * 0.75;
export const height = PAD + PH + 46;

const phases = {
  dir: "    FragColor = vec4(CalcDirLight(dirLight, norm, viewDir), 1.0);",
  point: "    vec3 points = vec3(0.0);\n    for (int i = 0; i < NR_POINT_LIGHTS; i++)\n        points += CalcPointLight(pointLights[i], norm, FragPos, viewDir);\n    FragColor = vec4(points, 1.0);",
  spot: "    FragColor = vec4(CalcSpotLight(spotLight, norm, FragPos, viewDir), 1.0);",
};

export const renders = Object.fromEntries(
  Object.entries(phases).map(([id, out]) => [
    id,
    { api: "opengl", chapter: "multiple-lights", edits: [{ file: "multiple_lights.fs", find: "    FragColor = vec4(result, 1.0);", replace: out }], width: Math.round(PW * 2) },
  ]),
);

export function draw(v, R) {
  const names = t(v, ["Directional light", "4 point lights", "Flashlight"], ["Riktat ljus", "4 punktljus", "Ficklampa"]);
  let s = "";
  ["dir", "point", "spot"].forEach((id, i) => {
    const x = PAD + i * (PW + OP);
    const r = R[id][0];
    s += crop(r, 0, 0, r.width, r.height, x, PAD, PW, PH);
    s += text(x + PW / 2, PAD + PH + 24, names[i], { size: L, weight: 650, anchor: "middle", fit: PW + OP - 4 });
    if (i < 2) s += text(x + PW + OP / 2, PAD + PH / 2, "+", { size: 30, weight: 600, anchor: "middle", color: C.muted });
  });
  return svg(height, s);
}
