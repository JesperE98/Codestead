// Transformations, "The order of transformations": the chapter's two programs side by side, animated over one full
// turn – drawn by the simulator from the course's OpenGL steps translate-rotate (the vertices are rotated, then
// moved: the container spins in place) and rotate-first (moved, then rotated: it circles the window's centre).
import { C, PAD, W, image, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("transform-order");
export const lossy = true;
export const quality = 80;
export const scale = 1; // 720 px: 24 frames at 2× would be several hundred KB

const PW = (W - 2 * PAD - 20) / 2, PH = (PW * 3) / 4;
export const height = PAD + PH + 50;
export const frames = 24;
export const frameMs = 125;
// One full turn (2π seconds of glfwGetTime) in 24 frames, so the animation loops without a jump.
const times = Array.from({ length: frames }, (_, i) => 1 + (i * 2 * Math.PI) / frames);

export const renders = {
  spin: { api: "opengl", chapter: "transformations", from: "task:translate-rotate", width: Math.round(PW * 2), times },
  orbit: { api: "opengl", chapter: "transformations", from: "task:rotate-first", width: Math.round(PW * 2), times },
};

export function draw(v, R, f) {
  let s = "";
  const panels = [
    ["spin", t(v, "Rotated, then moved", "Roterad, sedan flyttad"), t(v, "spins in place", "snurrar på stället")],
    ["orbit", t(v, "Moved, then rotated", "Flyttad, sedan roterad"), t(v, "circles the centre", "kretsar kring mitten")],
  ];
  panels.forEach(([id, label, sub], i) => {
    const x = PAD + i * (PW + 20);
    s += image(R[id][f].href, x, PAD, PW, PH);
    // The origin: the centre of the window, which every rotation turns about.
    const cx = x + PW / 2, cy = PAD + PH / 2;
    s += line(cx - 7, cy, cx + 7, cy, { color: "#ffffff", width: 1.5, opacity: 0.8 });
    s += line(cx, cy - 7, cx, cy + 7, { color: "#ffffff", width: 1.5, opacity: 0.8 });
    s += text(x + PW / 2, PAD + PH + 18, label, { anchor: "middle", weight: 600, fit: PW });
    s += text(x + PW / 2, PAD + PH + 36, sub, { anchor: "middle", size: 12, color: C.muted, fit: PW });
  });
  return svg(height, s);
}
