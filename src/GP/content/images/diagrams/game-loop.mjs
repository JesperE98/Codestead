// Setting up: one frame of the game loop, per API – the frame's time, the events (the key callback, or the window
// procedure, writes the game's Keys array), ProcessInput reading it, Update, and drawing – and back to the next frame.
import { BOLD, C, PAD, W, arrow, arrowPath, badge, box, perApi, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perApi("game-loop", ["opengl", "vulkan", "d3d12"], true);

const steps = (v) => {
  const time = [t(v, "Measure the frame's time", "Mät bildrutans tid"), "deltaTime = now - lastFrame"];
  const input = [t(v, "Read the keys", "Läs tangenterna"), "ProcessInput(Hedgerow, deltaTime)", "reads"];
  const update = [t(v, "Move the ball, collide …", "Flytta bollen, kollisioner …"), "Update(Hedgerow, deltaTime)"];
  return {
    opengl: [time, [t(v, "Events: the key callback", "Händelser: key callback"), "glfwPollEvents()", "writes"], input, update,
      [t(v, "Draw the game", "Rita spelet"), "glClear(…); Render(Hedgerow)"], [t(v, "Show the frame", "Visa bildrutan"), "glfwSwapBuffers(window)"]],
    vulkan: [time, [t(v, "Events: the key callback", "Händelser: key callback"), "glfwPollEvents()", "writes"], input, update,
      [t(v, "Record, submit, present", "Spela in, skicka, visa"), "drawFrame() → Render(Hedgerow)"]],
    d3d12: [[t(v, "Messages: OnKeyDown, OnKeyUp", "Meddelanden: OnKeyDown, OnKeyUp"), "PeekMessage, DispatchMessage", "writes"],
      [time[0], "OnUpdate(): std::chrono"], input, update,
      [t(v, "Record, execute, present", "Spela in, kör, visa"), "OnRender() → Render(Hedgerow)"]],
  }[v.api];
};

const RH = 64, GAP = 10, TOP = PAD + 6;
const X = PAD + 44, RW = 450; // the steps
export const height = (v) => TOP + steps(v).length * (RH + GAP) - GAP + PAD;

export function draw(v) {
  const list = steps(v);
  let s = "";
  const rowY = (i) => TOP + i * (RH + GAP);
  list.forEach(([what, c, keys], i) => {
    const y = rowY(i);
    s += box(X, y, RW, RH, { style: keys ? "accent" : "plain" });
    s += badge(X - 22, y + RH / 2, i + 1, { r: 11 });
    s += label(X + 14, y + 21, what, { fit: RW - 24 });
    s += code(X + 14, y + 46, c, { fit: RW - 24, color: C.muted });
  });
  // The Keys array, written by the events step and read by ProcessInput.
  const iw = list.findIndex((r) => r[2] === "writes"), ir = list.findIndex((r) => r[2] === "reads");
  const ya = rowY(iw) + RH / 2, yb = rowY(ir) + RH / 2;
  const kx = X + RW + 74, kw = W - PAD - kx, ky0 = Math.min(ya, yb) - 26, ky1 = Math.max(ya, yb) + 26;
  s += box(kx, ky0, kw, ky1 - ky0, { style: "accent2", label: "Keys[ ]", mono: true, size: 19 });
  s += arrow(X + RW + 4, ya, kx - 4, ya, { color: C.accent2, width: BOLD });
  s += arrow(kx - 4, yb, X + RW + 4, yb, { color: C.accent2, width: BOLD });
  s += label(X + RW + 37, ya - 16, t(v, "writes", "skriver"), { color: C.accent2, anchor: "middle", fit: 72 });
  s += label(X + RW + 37, yb + 18, t(v, "reads", "läser"), { color: C.accent2, anchor: "middle", fit: 72 });
  // Back to the first step: the next frame.
  const y0 = rowY(0) + RH / 2, y1 = rowY(list.length - 1) + RH / 2;
  s += arrowPath(`M${X - 36},${y1 + 8} C${PAD - 8},${y1 - 10} ${PAD - 8},${y0 + 10} ${X - 36},${y0 - 8}`, X - 36, y0 - 8, 1, -0.4, { color: C.line, width: 1.5 });
  return svg(height(v), s);
}
