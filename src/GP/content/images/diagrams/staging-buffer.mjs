// Mesh (Vulkan), after the quiz about the staging buffer: the vertices' way into device-local memory – memcpy into a
// host-visible staging buffer (TRANSFER_SRC), then vkCmdCopyBuffer on the GPU into the vertex buffer
// (TRANSFER_DST | VERTEX_BUFFER) in DEVICE_LOCAL memory, which the draw reads; the staging buffer is destroyed after
// the copy. Language-free (the code's names and flags).
import { C, PAD, W, arrow, arrowPath, svg } from "./style.mjs";
import { L, LS, code } from "./_lighting.mjs";

export const variants = [{ out: "staging-buffer.webp", lang: "en" }];
export const height = 380;

function region(x, y, w, h, tag) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    code(x + 12, y + 20, tag, { size: LS, color: C.muted, weight: 600 });
}

function buf(x, y, w, h, name, lines, color, soft) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${soft}" stroke="${color}" stroke-width="2"/>`;
  s += code(x + 14, y + 24, name, { size: L, weight: 700 });
  lines.forEach((l, i) => (s += code(x + 14, y + 52 + i * 24, l, { size: LS, color: C.muted })));
  return s;
}

export function draw() {
  let s = "";
  const lw = 300, rx = PAD + lw + 60, rw = W - PAD - rx;
  s += buf(PAD, PAD, lw, 62, "vertices", ["std::vector<Vertex>"], C.line, "#fff");
  s += arrow(PAD + 60, PAD + 66, PAD + 60, PAD + 136, { color: C.ink, width: 2 });
  s += code(PAD + 74, PAD + 101, "memcpy", { size: L, weight: 650 });
  s += region(PAD, PAD + 140, lw, 150, "HOST_VISIBLE");
  s += buf(PAD + 16, PAD + 176, lw - 32, 98, "stagingBuffer", ["TRANSFER_SRC"], C.accent2, C.accent2Soft);
  s += region(rx, PAD + 140, rw, 150, "DEVICE_LOCAL");
  s += buf(rx + 16, PAD + 176, rw - 32, 98, "vertexBuffer", ["TRANSFER_DST |", "VERTEX_BUFFER"], C.accent, C.accentSoft);
  // The copy, recorded into a command buffer and run by the GPU: from the staging buffer into the vertex buffer.
  const ax = PAD + lw / 2, bx = rx + rw / 2, ly = PAD + 322;
  s += arrowPath(`M${ax},${PAD + 274} L${ax},${ly} L${bx},${ly} L${bx},${PAD + 280}`, bx, PAD + 280, 0, -1, { color: C.ink, width: 2.5 });
  s += `<rect x="${(ax + bx) / 2 - 104}" y="${ly - 16}" width="208" height="32" fill="${C.card}"/>`;
  s += code((ax + bx) / 2, ly, "vkCmdCopyBuffer", { size: L, weight: 650, anchor: "middle" });
  return svg(height, s);
}
