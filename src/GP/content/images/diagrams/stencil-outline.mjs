// Stencil testing, "Object outlining": the three steps of the outline, drawn by the simulator from the course's OpenGL
// solution and shown around the left cube. 1: what the stencil buffer holds after the cubes – drawn here as white
// (1) and black (0): the floor is not drawn, the cubes are white, the outline pass draws nothing. 2: the 1.1× cubes in
// the outline colour without the stencil test (ALWAYS instead of NOTEQUAL). 3: the solution, NOTEQUAL 1.
import { C, PAD, W, badge, perLanguage, pill, svg, t } from "./style.mjs";
import { caption, crop } from "./_advgl.mjs";

export const variants = perLanguage("stencil-outline");
export const lossy = true;

const GAP = 14, PW = (W - 2 * PAD - 2 * GAP) / 3, PH = 200;
export const height = PAD + PH + 76;

const RW = 1200; // the renders' width; the window is 800 × 600
const notEqual = "        glStencilFunc(GL_NOTEQUAL, 1, 0xFF);";
export const renders = {
  mask: {
    api: "opengl",
    chapter: "stencil-testing",
    edits: [
      { file: "main.cpp", find: "glClearColor(0.1f, 0.1f, 0.1f, 1.0f);", replace: "glClearColor(0.0f, 0.0f, 0.0f, 1.0f);" },
      { file: "main.cpp", find: "glDrawArrays(GL_TRIANGLES, 0, 6);", replace: "glDrawArrays(GL_TRIANGLES, 0, 0);" },
      { file: "main.cpp", find: notEqual, replace: "        glStencilFunc(GL_NEVER, 1, 0xFF);" },
      { file: "stencil_testing.fs", find: "FragColor = texture(texture1, TexCoords);", replace: "FragColor = vec4(1.0);" },
    ],
    width: RW,
  },
  scaled: { api: "opengl", chapter: "stencil-testing", edits: [{ file: "main.cpp", find: notEqual, replace: "        glStencilFunc(GL_ALWAYS, 1, 0xFF);" }], width: RW },
  outline: { api: "opengl", chapter: "stencil-testing", width: RW },
};

export function draw(v, R) {
  let s = "";
  const cols = [
    ["mask", t(v, "Stencil buffer", "Stencilbufferten"), t(v, "after the cubes", "efter kuberna")],
    ["scaled", t(v, "Cubes × 1.1", "Kuberna × 1.1"), t(v, "without the test", "utan testet")],
    ["outline", t(v, "Where ≠ 1", "Där ≠ 1"), t(v, "only the ring", "bara ringen")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    const r = R[id][0];
    // Around the left cube: x 40..370 and y 150..440 of the 800 × 600 window.
    const k = r.width / 800, sw = 330 * k, sh = sw * (PH / PW);
    s += crop(r.href, r.width, r.height, 40 * k, 150 * k, sw, sh, x, PAD, PW, PH);
    s += badge(x + 16, PAD + 16, i + 1, { r: 12 });
    if (id === "mask") {
      s += pill(x + PW / 2 - 6, PAD + PH / 2 + 10, "1", { size: 19, w: 34 });
      s += pill(x + PW - 26, PAD + 26, "0", { size: 19, w: 34 });
    }
    s += caption(x + PW / 2, PAD + PH + 22, name, sub, { fit: PW });
  });
  return svg(height, s);
}
