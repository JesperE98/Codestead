// Assimp, "The model of this part": the four textures planet.mtl names – each material's diffuse map (map_Kd) and
// specular map (map_Ks). The planet's maps are 512 × 256, the ring's 256 × 1 strips (16 rows high in the file),
// stretched here so that they can be seen. Language-free (the file and material names).
import { C, PAD, W, asset, image, svg, text } from "./style.mjs";
import { LS, code } from "./_lighting.mjs";

export const variants = [{ out: "planet-maps.webp", lang: "en" }];

const GAP = 20, PW = (W - 2 * PAD - GAP) / 2, PH = PW / 2, RH = 34;
const Y1 = PAD + 30, Y2 = Y1 + PH + 40 + 56;
export const height = Y2 + RH + 44;

export function draw() {
  const m = (f) => asset(`opengl/model/solution/models/${f}`);
  let s = "";
  s += code(PAD, PAD + 8, "newmtl planet", { weight: 650, color: C.accent });
  s += code(PAD, Y2 - 30, "newmtl rings", { weight: 650, color: C.accent });
  [["planet_diffuse.png", "map_Kd"], ["planet_specular.png", "map_Ks"]].forEach(([f, k], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(m(f), x, Y1, PW, PH);
    s += code(x + PW / 2, Y1 + PH + 22, `${k} ${f}`, { anchor: "middle", size: LS, color: C.muted, fit: PW + GAP - 4 });
  });
  [["rings.png", "map_Kd"], ["rings_specular.png", "map_Ks"]].forEach(([f, k], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(m(f), x, Y2, PW, RH, { pixelated: false });
    s += code(x + PW / 2, Y2 + RH + 22, `${k} ${f}`, { anchor: "middle", size: LS, color: C.muted, fit: PW + GAP - 4 });
  });
  return svg(height, s);
}
