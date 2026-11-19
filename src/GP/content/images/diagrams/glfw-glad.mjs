// Creating a window (OpenGL): who does what. GLFW asks the operating system for the window, the OpenGL context and
// the input; GLAD finds the addresses of the OpenGL functions in the driver (through glfwGetProcAddress), so the
// program's gl… calls reach the driver and the graphics card.
import { C, PAD, W, arrow, box, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("glfw-glad");
export const height = 300;

export function draw(v) {
  let s = "";
  const cw = (W - 2 * PAD - 140) / 2, lx = PAD, rx = W - PAD - cw;
  // The program.
  s += box(lx, PAD, W - 2 * PAD, 46, { label: t(v, "Your program", "Ditt program"), sub: "main.cpp", subMono: true });
  // GLFW and GLAD.
  const y1 = PAD + 92;
  s += box(lx, y1, cw, 56, { label: "GLFW", sub: t(v, "window · OpenGL context · input", "fönster · OpenGL-kontext · indata"), style: "accent" });
  s += box(rx, y1, cw, 56, { label: "GLAD", sub: t(v, "the addresses of the gl… functions", "adresserna till gl…-funktionerna"), style: "accent2" });
  // What they talk to.
  const y2 = PAD + 196;
  s += box(lx, y2, cw, 56, { label: t(v, "The operating system", "Operativsystemet"), sub: "Win32 · X11 / Wayland · Cocoa" });
  s += box(rx, y2, cw, 56, { label: t(v, "The OpenGL driver", "OpenGL-drivrutinen"), sub: t(v, "from the graphics card's maker → GPU", "från grafikkortets tillverkare → GPU") });
  // Calls.
  const call = (x1, y1_, x2, y2_, label, color, anchor = "start", dx = 8) =>
    arrow(x1, y1_, x2, y2_, { color, width: 2 }) + text(x1 + dx, (y1_ + y2_) / 2, label, { mono: true, size: 12.5, color, anchor });
  s += call(lx + cw / 2, PAD + 48, lx + cw / 2, y1 - 3, "glfwCreateWindow, glfwPollEvents …", C.accent);
  s += call(rx + cw / 2, PAD + 48, rx + cw / 2, y1 - 3, "gladLoadGLLoader(…)", C.accent2);
  s += arrow(lx + cw / 2, y1 + 58, lx + cw / 2, y2 - 3, { color: C.accent, width: 2 });
  // The program's own gl… calls go through the pointers GLAD loaded, straight to the driver.
  s += call(rx + cw / 2, y1 + 58, rx + cw / 2, y2 - 3, "glClear, glViewport …", C.accent2, "end", -8);
  s += arrow(rx - 4, y1 + 28, lx + cw + 4, y1 + 28, { color: C.accent2, width: 1.5, dash: "4 3" });
  s += text((lx + cw + rx) / 2, y1 + 16, "glfwGetProcAddress", { mono: true, size: 11.5, color: C.accent2, anchor: "middle" });
  return svg(height, s);
}
