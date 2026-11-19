// Face culling, "Winding order": back-face culling switched on for learnopengl's old cube and floor (the start with
// glEnable(GL_CULL_FACE)) and for the counter-clockwise cube and floor (the task cull-back), drawn by the simulator
// from the course's OpenGL project. With the old data, every face that is clockwise from outside disappears.
import { PAD, W, image, perLanguage, svg, t } from "./style.mjs";
import { caption } from "./_advgl.mjs";

export const variants = perLanguage("culling-old-cube");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = (PW * 3) / 4;
export const height = PAD + PH + 70;

export const renders = {
  old: {
    api: "opengl",
    chapter: "face-culling",
    from: "start",
    edits: [{ file: "main.cpp", find: "    // TODO: face culling: enable it, cull the back faces, and say which winding order is the front (glFrontFace)", replace: "    glEnable(GL_CULL_FACE);" }],
    width: Math.round(PW * 2),
  },
  fixed: { api: "opengl", chapter: "face-culling", from: "task:cull-back", width: Math.round(PW * 2) },
};

export function draw(v, R) {
  let s = "";
  const cols = [
    ["old", t(v, "The old cube and floor", "Den gamla kuben och golvet"), t(v, "mixed winding: faces vanish", "blandad ordning: sidor försvinner")],
    ["fixed", t(v, "Counter-clockwise", "Moturs"), t(v, "every triangle, seen from outside", "varje triangel, sedd utifrån")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    s += image(R[id][0].href, x, PAD, PW, PH);
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { fit: PW });
  });
  return svg(height, s);
}
