// Textures, "Texture Filtering": a small part of the texture (around the heart) magnified a lot, read with nearest
// and with linear filtering – drawn by the simulator from the chapter's OpenGL program (the face over the crate).
import { C, PAD, image, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("texture-filtering");
export const lossy = true;

const THUMB = 150, BIG = 232, GAP = 16;
export const height = PAD + BIG + 40;

// The part of the texture that is magnified: s 0.64–0.80, t 0.33–0.49 (41 × 41 texels around the heart).
const S0 = 0.64, S1 = 0.8, T0 = 0.33, T1 = 0.49;

function edits(filter, s0, s1, t0, t1) {
  const f = (n) => n.toFixed(2) + "f";
  const list = [
    { file: "main.cpp", find: "const unsigned int SCR_WIDTH = 800;", replace: "const unsigned int SCR_WIDTH = 600;" },
    {
      file: "main.cpp",
      find: `         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   2.0f, 2.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   2.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 2.0f  // top left`,
      replace: `         1.0f,  1.0f, 0.0f,   1.0f, 0.0f, 0.0f,   ${f(s1)}, ${f(t1)}, // top right
         1.0f, -1.0f, 0.0f,   0.0f, 1.0f, 0.0f,   ${f(s1)}, ${f(t0)}, // bottom right
        -1.0f, -1.0f, 0.0f,   0.0f, 0.0f, 1.0f,   ${f(s0)}, ${f(t0)}, // bottom left
        -1.0f,  1.0f, 0.0f,   1.0f, 1.0f, 0.0f,   ${f(s0)}, ${f(t1)}  // top left`,
    },
    {
      file: "shader.fs",
      find: "    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), mixValue);",
      replace: "    vec4 face = texture(texture2, TexCoord);\n    FragColor = mix(texture(texture1, TexCoord), face, face.a);",
    },
  ];
  // Both textures (the first two GL_LINEAR magnification filters of the program).
  for (let i = 0; i < 2; i++)
    list.push({
      file: "main.cpp",
      find: "    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);\n    // load image",
      replace: `    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, ${filter});\n    // load image`,
    });
  return list;
}

export const renders = {
  whole: { api: "opengl", chapter: "textures", edits: edits("GL_LINEAR", 0, 1, 0, 1), width: THUMB * 2 },
  nearest: { api: "opengl", chapter: "textures", edits: edits("GL_NEAREST", S0, S1, T0, T1), width: BIG * 2 },
  linear: { api: "opengl", chapter: "textures", edits: edits("GL_LINEAR", S0, S1, T0, T1), width: BIG * 2 },
};

export function draw(v, R) {
  let s = "";
  const ty = PAD + (BIG - THUMB) / 2;
  s += image(R.whole[0].href, PAD, ty, THUMB, THUMB);
  // The magnified part, marked on the whole texture.
  const rx = PAD + S0 * THUMB, ry = ty + (1 - T1) * THUMB, rw = (S1 - S0) * THUMB, rh = (T1 - T0) * THUMB;
  s += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="${C.accent}" stroke-width="2"/>`;
  s += text(PAD + THUMB / 2, ty + THUMB + 18, t(v, "The whole texture", "Hela texturen"), { anchor: "middle", weight: 600, fit: THUMB + 20 });
  const bx = PAD + THUMB + 42;
  s += line(rx + rw, ry, bx, PAD, { color: C.accent, width: 1, dash: "4 3" });
  s += line(rx + rw, ry + rh, bx, PAD + BIG, { color: C.accent, width: 1, dash: "4 3" });
  const labels = [t(v, "Nearest neighbor", "Nearest neighbor"), t(v, "(Bi)linear", "(Bi)linjär")];
  ["nearest", "linear"].forEach((k, i) => {
    const x = bx + i * (BIG + GAP);
    s += image(R[k][0].href, x, PAD, BIG, BIG);
    s += `<rect x="${x}" y="${PAD}" width="${BIG}" height="${BIG}" rx="6" fill="none" stroke="${C.accent}" stroke-width="2"/>`;
    s += text(x + BIG / 2, PAD + BIG + 18, labels[i], { anchor: "middle", weight: 600, fit: BIG });
  });
  return svg(height, s);
}
