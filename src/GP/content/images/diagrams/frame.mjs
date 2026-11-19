// Hello Window, the end: one frame of the chapter's program, step by step, with the calls that do each step – and the
// loop back to the next frame. One variant per API (its own steps and calls).
import { C, PAD, W, arrowPath, badge, perApi, svg, t, text } from "./style.mjs";

export const variants = perApi("frame", ["opengl", "vulkan", "d3d12"], true);

const steps = {
  opengl: (v) => [
    [t(v, "Stop when the window should close", "Sluta när fönstret ska stängas"), "glfwWindowShouldClose(window)"],
    [t(v, "Handle the keyboard", "Hantera tangentbordet"), "processInput(window)"],
    [t(v, "Clear the back buffer", "Rensa den bakre bufferten"), "glClearColor(…);  glClear(…)"],
    [t(v, "Show it: swap back and front buffer", "Visa den: byt bakre och främre buffert"), "glfwSwapBuffers(window)"],
    [t(v, "Process the window's events", "Behandla fönstrets händelser"), "glfwPollEvents()"],
  ],
  vulkan: (v) => [
    [t(v, "Process the window's events", "Behandla fönstrets händelser"), "glfwPollEvents()"],
    [t(v, "Wait for the previous frame", "Vänta på förra framen"), "vkWaitForFences, vkResetFences"],
    [t(v, "Get an image from the swap chain", "Hämta en bild från swap chain"), "vkAcquireNextImageKHR"],
    [t(v, "Record the commands: clear the image", "Spela in kommandona: rensa bilden"), "recordCommandBuffer(…)"],
    [t(v, "Submit them to the graphics queue", "Skicka dem till grafikkön"), "vkQueueSubmit"],
    [t(v, "Present the image", "Visa bilden"), "vkQueuePresentKHR"],
  ],
  d3d12: (v) => [
    [t(v, "Process the window's messages", "Behandla fönstrets meddelanden"), "PeekMessage, DispatchMessage"],
    [t(v, "Record the commands: clear the back buffer", "Spela in kommandona: rensa den bakre bufferten"), "PopulateCommandList()"],
    [t(v, "Submit them to the command queue", "Skicka dem till kommandokön"), "ExecuteCommandLists"],
    [t(v, "Present the back buffer", "Visa den bakre bufferten"), "m_swapChain->Present(1, 0)"],
    [t(v, "Wait for the GPU to finish the frame", "Vänta tills GPU:n är klar med framen"), "WaitForPreviousFrame()"],
  ],
};

const RH = 42, GAP = 8;
export const height = (v) => PAD + 30 + steps[v.api](v).length * (RH + GAP) - GAP + PAD;

export function draw(v) {
  const list = steps[v.api](v);
  let s = text(PAD + 44, PAD + 12, t(v, "One frame", "En frame"), { weight: 700, size: 15 });
  s += text(W - PAD, PAD + 12, v.api === "opengl" ? "while (…) { … }" : v.api === "vulkan" ? "mainLoop() → drawFrame()" : "while (msg.message != WM_QUIT)", { mono: true, size: 12, color: C.muted, anchor: "end" });
  const x = PAD + 44, w = W - PAD - x, split = x + 350;
  list.forEach(([what, code], i) => {
    const y = PAD + 30 + i * (RH + GAP);
    s += `<rect x="${x}" y="${y}" width="${w}" height="${RH}" rx="6" fill="#fff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
    s += `<rect x="${split}" y="${y}" width="${x + w - split}" height="${RH}" rx="6" fill="${C.accentSoft}"/>`;
    s += `<rect x="${split}" y="${y}" width="${x + w - split}" height="${RH}" rx="6" fill="none" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
    s += badge(x - 20, y + RH / 2, i + 1);
    s += text(x + 14, y + RH / 2, what, { size: 13.5, weight: 600, fit: split - x - 20 });
    s += text(split + 14, y + RH / 2, code, { mono: true, size: 12, fit: x + w - split - 20 });
  });
  // Back to the first step: the next frame.
  const y0 = PAD + 30 + RH / 2, y1 = PAD + 30 + (list.length - 1) * (RH + GAP) + RH / 2;
  s += arrowPath(`M${x - 30},${y1 + 6} C${PAD - 6},${y1 + 20} ${PAD - 6},${y0 - 20} ${x - 30},${y0 - 6}`, x - 30, y0 - 6, 1, 0.4, { color: C.line, width: 1.5 });
  return svg(height(v), s);
}
