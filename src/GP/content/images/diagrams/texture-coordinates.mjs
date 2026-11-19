// Textures, "Texture coordinates": the texture with its coordinate axes – OpenGL's s/t from the bottom left, Vulkan's
// and Direct3D's u/v from the top left – and the chapter's example triangle: its corners' texture coordinates, and the
// triangle on the screen with the part of the texture they cut out. Language-free (coordinates and axis names only).
import { C, PAD, arrow, asset, dot, pill, svg, text } from "./style.mjs";

export const variants = [
  { out: "texture-coordinates-opengl.webp", lang: "en", gl: true },
  { out: "texture-coordinates-vulkan-d3d12.webp", lang: "en", gl: false },
];
export const height = 300;

const crate = asset("opengl/textures/solution/container.png");
const S = 220; // the texture's size in the picture

export function draw(v) {
  let s = "";
  const x0 = PAD + 60, y0 = PAD + 22;
  s += `<image href="${crate}" x="${x0}" y="${y0}" width="${S}" height="${S}" opacity="0.9"/>`;
  s += `<rect x="${x0}" y="${y0}" width="${S}" height="${S}" fill="none" stroke="${C.boxStroke}"/>`;
  // Axes: s/t from the bottom left (t up) or u/v from the top left (v down).
  const ox = x0, oy = v.gl ? y0 + S : y0;
  const [h, vname] = v.gl ? ["s", "t"] : ["u", "v"];
  s += arrow(ox, oy, ox + S + 34, oy, { color: C.x, width: 2 });
  s += text(ox + S + 40, oy, h, { italic: true, weight: 600, size: 16, color: C.x });
  s += arrow(ox, oy, ox, v.gl ? oy - S - 16 : oy + S + 16, { color: C.y, width: 2 });
  s += text(ox + 10, v.gl ? oy - S - 12 : oy + S + 12, vname, { italic: true, weight: 600, size: 16, color: C.y });
  // The corners' coordinates.
  const corner = (cx, cy, label, anchor) => text(cx, cy, label, { size: 12, color: C.muted, anchor, weight: 600 });
  if (v.gl) {
    s += corner(x0 - 8, y0 + S + 12, "(0, 0)", "end");
    s += corner(x0 + S + 8, y0 + S + 12, "(1, 0)", "start");
    s += corner(x0 - 8, y0 - 4, "(0, 1)", "end");
    s += corner(x0 + S + 8, y0 - 4, "(1, 1)", "start");
  } else {
    s += corner(x0 - 8, y0 - 4, "(0, 0)", "end");
    s += corner(x0 + S, y0 - 14, "(1, 0)", "middle");
    s += corner(x0 - 8, y0 + S + 12, "(0, 1)", "end");
    s += corner(x0 + S + 8, y0 + S + 12, "(1, 1)", "start");
  }
  // The triangle: bottom left, bottom right, top middle of the image.
  const tri = [[x0, y0 + S], [x0 + S, y0 + S], [x0 + S / 2, y0]];
  s += `<polygon points="${tri.map((p) => p.join(",")).join(" ")}" fill="${C.accent}" fill-opacity="0.12" stroke="${C.accent}" stroke-width="2.5" stroke-linejoin="round"/>`;
  // The bottom corners' coordinates are the texture's corners (labelled above); the top one is new.
  const coords = v.gl ? ["(0, 0)", "(1, 0)", "(0.5, 1)"] : ["(0, 1)", "(1, 1)", "(0.5, 0)"];
  tri.forEach(([px, py]) => (s += dot(px, py, { r: 5, color: C.accent, stroke: "#fff" })));
  s += pill(tri[2][0], tri[2][1] + 20, coords[2], { anchor: "middle", mono: true, color: C.accent, stroke: C.accent });

  // On the screen: the triangle, filled with the part of the texture its coordinates cut out.
  const sx = 470, sy = y0 + 20, sw = 200, sh = 180;
  s += arrow(x0 + S + 74, y0 + S / 2, sx - 22, y0 + S / 2, { color: C.line, width: 2 });
  const screen = [[sx, sy + sh], [sx + sw, sy + sh], [sx + sw / 2, sy]];
  s += `<clipPath id="tri"><polygon points="${screen.map((p) => p.join(",")).join(" ")}"/></clipPath>`;
  s += `<rect x="${sx - 30}" y="${sy - 30}" width="${sw + 60}" height="${sh + 60}" rx="6" fill="${C.clear}"/>`;
  s += `<image href="${crate}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" preserveAspectRatio="none" clip-path="url(#tri)"/>`;
  screen.forEach(([px, py]) => (s += dot(px, py, { r: 4, color: C.accent, stroke: "#fff" })));
  return svg(height, s);
}
