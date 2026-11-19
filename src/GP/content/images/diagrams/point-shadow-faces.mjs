// Point Shadows, "Light space transform": the chapter's room seen from above. The light in the middle looks along
// +X, −X, +Z and −Z (and up and down, ±Y, not seen from above) with a field of view of exactly 90°: the frusta fill all
// directions without gaps or overlaps. The cube map is looked up with fragToLight, the vector from the light to the
// fragment: the wall fragment behind the cube finds the cube's distance stored there (closestDepth), which is
// smaller than its own distance – in shadow.
import { BOLD, C, PAD, W, arrow, dot, line, perLanguage, svg, t, text } from "./style.mjs";
import { label, panel, poly } from "./_advlight.mjs";

export const variants = perLanguage("point-shadow-faces");

const S = 320; // the room's side in pixels (10 units)
export const height = PAD + S + 40 + PAD;

export function draw(v) {
  let s = panel(PAD, PAD, W - 2 * PAD, height - 2 * PAD);
  const ox = PAD + 24 + S / 2, oy = PAD + 20 + S / 2; // the light, the room's centre
  const U = S / 10; // pixels per unit
  const P = (x, z) => [ox + x * U, oy + z * U]; // top view: x to the right, z down (towards the camera)
  const c = [P(-5, -5), P(5, -5), P(5, 5), P(-5, 5)];
  // The four frusta, tinted in turn.
  const faces = [
    ["+X", [c[1], c[2]], C.xSoft, P(3.4, 0)],
    ["−X", [c[3], c[0]], C.xSoft, P(-3.4, 0)],
    ["+Z", [c[2], c[3]], C.zSoft, P(0, 3.6)],
    ["−Z", [c[0], c[1]], C.zSoft, P(0, -3.6)],
  ];
  for (const [, [a, b], fill] of faces) s += poly([[ox, oy], a, b], { fill, color: C.boxStroke, width: 1 });
  s += poly(c, { color: C.ink, width: 2 });
  for (const [name, , , [lx, ly]] of faces) s += text(lx, ly, name, { size: 21, weight: 700, mono: true, anchor: "middle", color: name.endsWith("X") ? C.x : C.z });
  // 90° at the −Z face.
  s += `<path d="M${ox - 22},${oy - 22} A31,31 0 0 1 ${ox + 22},${oy - 22}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  s += text(ox, oy - 46, "90°", { size: 19, weight: 650, anchor: "middle" });
  // The cube at (-1.5, -3), 1 unit wide, and a wall fragment behind it.
  const [cx, cz] = [-1.5, -3];
  const cub = [P(cx - 0.5, cz - 0.5), P(cx + 0.5, cz - 0.5), P(cx + 0.5, cz + 0.5), P(cx - 0.5, cz + 0.5)];
  // The wall fragment: on the back wall, on the line from the light through the cube.
  const fz = -5, fx = (cx / cz) * fz;
  const [Fx, Fy] = P(fx, fz);
  const hit = P(cx * ((cz + 0.5) / cz), cz + 0.5); // where the line enters the cube (its near side)
  s += line(ox, oy, Fx, Fy, { color: C.accent, width: BOLD });
  s += `<polygon points="${cub.map((p) => p.join(",")).join(" ")}" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="2"/>`;
  s += arrow(hit[0], hit[1], Fx, Fy, { color: C.accent, width: BOLD, dash: "5 4" });
  s += dot(hit[0], hit[1], { r: 5, color: C.accent2 });
  s += dot(Fx, Fy, { r: 6, color: C.bad });
  // The light.
  s += `<circle cx="${ox}" cy="${oy}" r="10" fill="${C.accent}" stroke="#fff" stroke-width="2"/>`;
  // Explanations on the right.
  const x = ox + S / 2 + 34;
  const fit = W - PAD - x - 10;
  s += label(x, PAD + 40, t(v, "Six 90° views around the light:", "Sex vyer à 90° runt ljuset:"), { fit });
  s += label(x, PAD + 66, t(v, "the four sides, and ±Y", "de fyra sidorna, och ±Y"), { fit, color: C.muted });
  s += text(x, PAD + 124, "fragToLight", { size: 19, mono: true, color: C.accent, weight: 600 });
  s += label(x, PAD + 150, t(v, "picks face and texel", "väljer sida och texel"), { fit, color: C.muted });
  s += text(x, PAD + 206, "closestDepth", { size: 19, mono: true, color: C.accent2, weight: 600 });
  s += label(x, PAD + 232, t(v, "the cube's distance", "kubens avstånd"), { fit, color: C.muted });
  s += text(x, PAD + 288, "length(…) >", { size: 19, mono: true, color: C.bad, weight: 600 });
  s += label(x, PAD + 314, t(v, "farther: in shadow", "längre bort: i skugga"), { fit, color: C.bad });
  return svg(height, s);
}
