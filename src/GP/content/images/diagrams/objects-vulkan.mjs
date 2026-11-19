// The Vulkan objects of the course's triangle program (vulkan-tutorial's initVulkan()): what is made from the instance,
// and what from the logical device. The same picture in three chapters: all of it (Vulkan, "What it takes to draw a
// triangle"), and with the objects of Creating a window or Hello Window highlighted. Language-free (type names).
import { C, PAD, W, arrow, box, svg, text } from "./style.mjs";

export const variants = [
  { out: "objects-vulkan.webp", lang: "en", highlight: null },
  { out: "objects-vulkan-setup.webp", lang: "en", highlight: ["VkInstance", "VkDebugUtilsMessengerEXT", "VkPhysicalDevice", "VkDevice", "VkQueue"] },
  {
    out: "objects-vulkan-window.webp",
    lang: "en",
    highlight: ["VkSurfaceKHR", "VkSwapchainKHR", "VkImageView", "VkFramebuffer", "VkRenderPass", "VkCommandPool", "VkCommandBuffer", "VkQueue", "VkSemaphore", "VkFence"],
  },
];

const BW = 136, BH = 32, GX = 6;
const rows = [58, 100, 142, 184, 226];
export const height = rows[4] + BH + 14 + PAD;

export function draw(v) {
  const on = (name) => v.highlight === null || v.highlight.includes(name);
  const style = (name) => (v.highlight !== null && on(name) ? "accent" : "plain");
  const node = (x, y, name, w = BW) => box(x, y, w, BH, { label: name, mono: true, size: 12, style: style(name), opacity: on(name) ? 1 : 0.35 });
  const container = (x, y, w, h, name) =>
    `<g opacity="${on(name) ? 1 : 0.45}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${v.highlight !== null && on(name) ? C.accentSoft : "#ffffff"}" fill-opacity="0.5" stroke="${v.highlight !== null && on(name) ? C.accent : C.line}" stroke-width="1.5"/>` +
    text(x + 12, y + 18, name, { mono: true, weight: 700, size: 13 }) + "</g>";

  let s = "";
  // The instance and what comes from it.
  const ix = PAD, iw = 212;
  s += container(ix, PAD, iw, height - 2 * PAD, "VkInstance");
  s += node(ix + 10, rows[0], "VkSurfaceKHR", iw - 20);
  s += node(ix + 10, rows[1], "VkDebugUtilsMessengerEXT", iw - 20);
  s += node(ix + 10, rows[2], "VkPhysicalDevice", iw - 20);
  // The logical device and what comes from it.
  const dx = ix + iw + 20, dw = W - PAD - dx;
  const col = (i) => dx + 12 + i * (BW + GX);
  s += container(dx, PAD, dw, height - 2 * PAD, "VkDevice");
  const grid = [
    ["VkSwapchainKHR", "VkRenderPass", "VkCommandPool"],
    ["VkImageView", "VkPipelineLayout", "VkCommandBuffer"],
    ["VkFramebuffer", "VkPipeline", "VkQueue"],
    ["VkBuffer", "VkDeviceMemory", "VkSemaphore"],
    [null, null, "VkFence"],
  ];
  grid.forEach((row, r) => row.forEach((name, c) => name !== null && (s += node(col(c), rows[r], name))));
  const mid = (r) => rows[r] + BH / 2;
  const link = (x1, y1, x2, y2, names) => arrow(x1, y1, x2, y2, { color: C.line, width: 1.5, opacity: names.every(on) ? 1 : 0.35 });
  // The physical device the logical one is made for; the surface the swap chain presents to.
  s += link(ix + iw - 10, mid(2), dx - 2, mid(2), ["VkPhysicalDevice", "VkDevice"]);
  s += link(ix + iw - 10, mid(0), col(0) - 2, mid(0), ["VkSurfaceKHR", "VkSwapchainKHR"]);
  // Inside the device: the chains the program builds.
  s += link(col(0) + BW / 2, rows[0] + BH, col(0) + BW / 2, rows[1] - 1, ["VkSwapchainKHR", "VkImageView"]);
  s += link(col(0) + BW / 2, rows[1] + BH, col(0) + BW / 2, rows[2] - 1, ["VkImageView", "VkFramebuffer"]);
  s += link(col(1) + BW / 2, rows[1] + BH, col(1) + BW / 2, rows[2] - 1, ["VkPipelineLayout", "VkPipeline"]);
  s += link(col(2) + BW / 2, rows[0] + BH, col(2) + BW / 2, rows[1] - 1, ["VkCommandPool", "VkCommandBuffer"]);
  s += link(col(1), mid(3), col(0) + BW + 1, mid(3), ["VkBuffer", "VkDeviceMemory"]);
  return svg(height, s);
}
