// Lighting maps, "Specular maps": the course's two maps of the crate side by side – the diffuse map container2.png
// (the colours) and the specular map container2_specular.png (how strongly each part shines: the steel frame bright,
// the wooden planks almost black). The Swedish chapter uses the same two terms, so the picture is shared.
import { C, PAD, W, asset, image, svg, text } from "./style.mjs";
import { L, LS } from "./_lighting.mjs";

export const variants = [{ out: "lighting-maps-textures.webp", lang: "en" }];

const GAP = 24, S = 250, X0 = (W - 2 * S - GAP) / 2;
export const height = PAD + S + 74;

export function draw() {
  const maps = [
    [asset("opengl/lighting-maps/solution/container2.png"), "Diffuse map", "container2.png"],
    [asset("opengl/lighting-maps/solution/container2_specular.png"), "Specular map", "container2_specular.png"],
  ];
  let s = "";
  maps.forEach(([href, name, file], i) => {
    const x = X0 + i * (S + GAP);
    s += image(href, x, PAD, S, S);
    s += text(x + S / 2, PAD + S + 24, name, { size: L, weight: 650, anchor: "middle" });
    s += text(x + S / 2, PAD + S + 52, file, { size: LS, mono: true, anchor: "middle", color: C.muted, fit: S + GAP });
  });
  return svg(height, s);
}
