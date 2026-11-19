// Blending, "Don't break the order": the windows drawn in the list's order (the task blend) and sorted from far to near
// (the task sort), by the simulator from the course's OpenGL project, around the nearest window: unsorted, its glass
// hides the window behind it; sorted, you see the far window through it.
import { PAD, W, perLanguage, svg, t } from "./style.mjs";
import { caption, crop } from "./_advgl.mjs";

export const variants = perLanguage("blending-order");
export const lossy = true;

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 260;
export const height = PAD + PH + 70;

const RW = 1200;
export const renders = {
  unsorted: { api: "opengl", chapter: "blending", from: "task:blend", width: RW },
  sorted: { api: "opengl", chapter: "blending", width: RW },
};

const VIEW = { x: 300, y: 120, w: 400 }; // the part of the 800 × 600 window shown

export function draw(v, R) {
  let s = "";
  const cols = [
    ["unsorted", t(v, "In the list's order", "I listans ordning"), t(v, "the far window is lost", "fönstret bakom försvinner")],
    ["sorted", t(v, "Sorted far to near", "Sorterade bakifrån"), t(v, "two layers of glass", "två lager glas")],
  ];
  cols.forEach(([id, name, sub], i) => {
    const x = PAD + i * (PW + GAP);
    const r = R[id][0], k = r.width / 800;
    s += crop(r.href, r.width, r.height, VIEW.x * k, VIEW.y * k, VIEW.w * k, VIEW.w * k * (PH / PW), x, PAD, PW, PH);
    s += caption(x + PW / 2, PAD + PH + 20, name, sub, { fit: PW });
  });
  return svg(height, s);
}
