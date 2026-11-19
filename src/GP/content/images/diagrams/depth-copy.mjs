// Deferred Shading, after the OpenGL quiz on copying the G-buffer's depth: the light cubes drawn by the simulator
// without and with glBlitFramebuffer (the chapter's OpenGL project). Without the copy the window's depth buffer holds
// only the screen quad's flat depth (0.5), which is nearer than the cubes: it hides almost all of them. OpenGL only –
// in the other APIs the lighting pass leaves no such depth behind.
import { C, PAD, W, perLanguage, pill, svg, t } from "./style.mjs";
import { L, crop } from "./_advlight.mjs";

export const variants = perLanguage("depth-copy-opengl");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 0.75;
export const height = PAD + PH + PAD;
const blit = "        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST);";
export const renders = {
  without: { api: "opengl", chapter: "deferred-shading", from: "task:light-cubes", edits: [{ file: "main.cpp", find: blit, replace: "        // (no depth copy)" }], width: Math.round(PW * 2) },
  with: { api: "opengl", chapter: "deferred-shading", from: "task:light-cubes", width: Math.round(PW * 2) },
};

export function draw(v, R) {
  let s = "";
  [["without", t(v, "Without `glBlitFramebuffer`", "Utan `glBlitFramebuffer`"), C.bad], ["with", t(v, "With `glBlitFramebuffer`", "Med `glBlitFramebuffer`"), C.good]].forEach(([id, name, color], i) => {
    const x = PAD + i * (PW + GAP), img = R[id][0];
    s += crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, PAD, PW, PH);
    s += pill(x + 8, PAD + 20, name, { size: L, color });
  });
  return svg(height, s);
}
