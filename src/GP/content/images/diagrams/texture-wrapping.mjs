// Textures, "Texture Wrapping": the four wrap (address) modes side by side, drawn by the simulator from the chapter's
// own OpenGL program with texture coordinates from 0 to 2 (the chapter's quiz and its "repeat" step). The face is
// drawn over the crate, both with the same mode. OpenGL puts (0, 0) at the bottom left; Vulkan and Direct3D at the
// top left – the second variant gets the same picture as they do.
import { C, PAD, W, image, pill, svg, t, text } from "./style.mjs";

export const variants = ["en", "sv"].flatMap((lang) => [
  { out: `${lang}/texture-wrapping-opengl.webp`, lang, origin: "bottom" },
  { out: `${lang}/texture-wrapping-vulkan-d3d12.webp`, lang, origin: "top" },
]);

const modes = ["GL_REPEAT", "GL_MIRRORED_REPEAT", "GL_CLAMP_TO_EDGE", "GL_CLAMP_TO_BORDER"];
const SIZE = 154;
const GAP = (W - 2 * PAD - 4 * SIZE) / 3;
export const height = PAD + SIZE + 36;
export const lossy = true;

function wrapEdits(mode) {
  const set = (find) => ({
    file: "main.cpp",
    find,
    replace: `    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, ${mode});
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, ${mode});
    float borderColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);`,
  });
  return [
    set(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // note that we set the container wrapping method to GL_CLAMP_TO_EDGE
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);`),
    set(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // set texture wrapping to GL_REPEAT (default wrapping method)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);`),
  ];
}

// A square window filled by the rectangle; (s, t) from 0 to 2 – with (0, 0) at the bottom left, or (as Vulkan's and
// Direct3D's (u, v)) at the top left: t then runs from 1 at the top to -1 at the bottom, which shows the same.
function common(origin) {
  const [top, bottom] = origin === "bottom" ? ["2.0f", "0.0f"] : ["1.0f", "-1.0f"];
  return [
    { file: "main.cpp", find: "const unsigned int SCR_WIDTH = 800;", replace: "const unsigned int SCR_WIDTH = 600;" },
    {
      file: "main.cpp",
      find: `         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   2.0f, 2.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   2.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 2.0f  // top left`,
      replace: `         1.0f,  1.0f, 0.0f,   1.0f, 0.0f, 0.0f,   2.0f, ${top}, // top right
         1.0f, -1.0f, 0.0f,   0.0f, 1.0f, 0.0f,   2.0f, ${bottom}, // bottom right
        -1.0f, -1.0f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, ${bottom}, // bottom left
        -1.0f,  1.0f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, ${top}  // top left`,
    },
    {
      file: "shader.fs",
      find: "    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), mixValue);",
      replace: "    vec4 face = texture(texture2, TexCoord);\n    FragColor = mix(texture(texture1, TexCoord), face, face.a);",
    },
  ];
}

export function renders(v) {
  return Object.fromEntries(
    modes.map((m) => [m, { api: "opengl", chapter: "textures", edits: [...common(v.origin), ...wrapEdits(m)], width: SIZE * 2 }]),
  );
}

export function draw(v, R) {
  const labels = t(v,
    ["Repeat", "Mirrored repeat", "Clamp to edge", "Clamp to border"],
    ["Upprepning", "Speglad upprepning", "Kanten dras ut", "Kantfärg"]);
  let s = "";
  modes.forEach((m, i) => {
    const x = PAD + i * (SIZE + GAP);
    s += image(R[m][0].href, x, PAD, SIZE, SIZE);
    s += text(x + SIZE / 2, PAD + SIZE + 18, labels[i], { anchor: "middle", weight: 600, fit: SIZE + GAP - 4 });
    // The texture's own square, (0, 0) to (1, 1): the bottom left (OpenGL) or top left quarter.
    const qy = v.origin === "bottom" ? PAD + SIZE / 2 : PAD;
    s += `<rect x="${x + 1}" y="${qy + 1}" width="${SIZE / 2 - 2}" height="${SIZE / 2 - 2}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-dasharray="5 3"/>`;
    if (i === 0) {
      const [y0, y1] = v.origin === "bottom" ? [PAD + SIZE - 12, PAD + 12] : [PAD + 12, PAD + SIZE - 12];
      s += pill(x + 4, y0, "(0, 0)", { size: 12 });
      s += pill(x + SIZE - 4, y1, "(2, 2)", { size: 12, anchor: "end" });
    }
  });
  return svg(height, s);
}
