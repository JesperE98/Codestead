// PBR Theory, "Normal distribution function", "Geometry function" and "Fresnel equation": each function of the
// Cook-Torrance BRDF alone on a row of the PBR Lighting chapter's spheres, drawn by the simulator, with the light at the
// camera (so l = v and h = v). D and G over the roughness, from 0.05 (left) to 0.86 (right); D grows huge and tiny on
// smooth spheres and spreads out on rough ones, G darkens the rims of rough ones. F over the base reflectivity F0 of
// the chapter's table – water, plastic, glass, diamond, iron, copper and gold: every material reflects more at the rim.
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { crop, label } from "./_advlight.mjs";

export const variants = perLanguage("brdf-terms");
export const lossy = true;

const RW = 1400, CX0 = 0.13, CW = 0.74, CY0 = 0.428, CH = 0.144;
const PW = W - 2 * PAD, PH = (PW * CH * 0.75) / CW;
const ROW = 30 + PH + 32;
export const height = PAD + 3 * ROW - 4 + PAD;

const show = (body) => [{ file: "pbr.fs", find: "    FragColor = vec4(color, 1.0);", replace: `${body}\n    FragColor = vec4(pow(shown, vec3(1.0/2.2)), 1.0);` }];
const r = (body) => ({ api: "opengl", chapter: "pbr-lighting", from: "task:tone-map", edits: show(body), width: RW });
const f0s = ["vec3(0.02)", "vec3(0.04)", "vec3(0.08)", "vec3(0.17)", "vec3(0.56, 0.57, 0.58)", "vec3(0.95, 0.64, 0.54)", "vec3(1.00, 0.71, 0.29)"];
export const renders = {
  D: r("    float d = DistributionGGX(N, V, roughness); // the light at the camera: H = V\n    vec3 shown = vec3(d / (d + 1.0));"),
  G: r("    vec3 shown = vec3(GeometrySmith(N, V, V, roughness));"),
  F: r(`    int column = int(roughness * 7.0 + 0.5);\n    vec3 f0 = ${f0s[0]};\n${f0s.slice(1).map((f, i) => `    if (column == ${i + 1}) f0 = ${f};`).join("\n")}\n    vec3 shown = fresnelSchlick(max(dot(N, V), 0.0), f0);`),
};

export function draw(v, R) {
  const rows = [
    ["D", t(v, "*D*: normal distribution, roughness 0.05 → 0.86", "*D*: normalfördelning, roughness 0.05 → 0.86")],
    ["G", t(v, "*G*: geometry, roughness 0.05 → 0.86", "*G*: geometri, roughness 0.05 → 0.86")],
    ["F", t(v, "*F*: Fresnel, for the base reflectivity F_{0} of", "*F*: Fresnel, för basreflektiviteten F_{0} hos")],
  ];
  const names = t(v, ["water", "plastic", "glass", "diamond", "iron", "copper", "gold"], ["vatten", "plast", "glas", "diamant", "järn", "koppar", "guld"]);
  let s = "";
  rows.forEach(([id, name], j) => {
    const y = PAD + j * ROW, img = R[id][0];
    s += label(PAD, y + 10, name, { fit: PW });
    s += crop(img.href, img.width, img.height, img.width * CX0, img.height * CY0, img.width * CW, img.height * CH, PAD, y + 28, PW, PH);
    if (id === "F")
      names.forEach((n, i) => {
        const cx = PAD + ((i * 2.5 + 1.5) / 18) * PW;
        s += text(cx, y + 28 + PH + 16, n, { size: 19, anchor: "middle", color: C.muted, weight: 600 });
      });
  });
  return svg(height, s);
}
