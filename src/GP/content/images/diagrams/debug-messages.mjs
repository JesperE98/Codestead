// Debugging: where a mistake in an API call is reported, per API. The program's calls go down (through the validation or
// debug layer, which only exists while debugging, to the driver); the ways back up to the program are the channels the
// chapter uses – OpenGL's error flag and debug output, Vulkan's VkResult and debug messenger, Direct3D 12's HRESULT,
// info queue and message callback.
import { BOLD, C, PAD, W, arrow, arrowPath, box, perApi, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perApi("debug-messages", ["opengl", "vulkan", "d3d12"], true);

const spec = (v) => ({
  opengl: [
    { name: t(v, "OpenGL driver", "OpenGL-drivrutinen"), style: "accent", channels: [
      { name: t(v, "error flag, read later", "felflaggan, läses senare"), code: "glGetError()", dash: "6 4" },
      { name: t(v, "debug output, inside the call", "debug output, inuti anropet"), code: "glDebugOutput(…)" },
    ] },
  ],
  vulkan: [
    { name: t(v, "validation layer", "valideringslagret"), style: "accent", channels: [
      { name: t(v, "debug messenger", "debug messenger"), code: "debugCallback(…)" },
    ] },
    { name: t(v, "driver", "drivrutinen"), style: "plain", channels: [
      { name: t(v, "run-time errors only", "bara körtidsfel"), code: "VkResult", dash: "6 4" },
    ] },
  ],
  d3d12: [
    { name: t(v, "debug layer", "debuglagret"), style: "accent", channels: [
      { name: t(v, "info queue, read later", "info queue, läses senare"), code: "CheckDebugMessages()", dash: "6 4" },
      { name: t(v, "callback, at the call", "callback, vid anropet"), code: "D3D12DebugOutput(…)" },
    ] },
    { name: t(v, "runtime and driver", "runtime och drivrutin"), style: "plain", channels: [
      { name: t(v, "run-time errors only", "bara körtidsfel"), code: "HRESULT", dash: "6 4" },
    ] },
  ],
}[v.api]);

const PH = 58; // the program's box
const CH = 76; // one channel's row
const BX = 250; // the layer and driver boxes' width
const DOWN = 64; // the gap with the "calls" arrow

function layout(v) {
  let y = PAD + PH + DOWN;
  return spec(v).map((b) => {
    const h = Math.max(90, 24 + b.channels.length * CH);
    const r = { ...b, y, h };
    y += h + DOWN;
    return r;
  });
}

export const height = (v) => {
  const l = layout(v).at(-1);
  return l.y + l.h + PAD;
};

export function draw(v) {
  const boxes = layout(v);
  let s = box(PAD, PAD, W - 2 * PAD, PH, { label: t(v, "Your program", "Ditt program"), size: 19 });
  const all = boxes.flatMap((b) => b.channels.map((c, i) => ({ ...c, y: b.y + 24 + i * CH + CH / 2 - 6 })));
  const xs = all.map((_, k) => W - PAD - 24 - (all.length - 1 - k) * 26);
  let prevBottom = PAD + PH;
  boxes.forEach((b, bi) => {
    s += arrow(PAD + BX / 2, prevBottom + 4, PAD + BX / 2, b.y - 4, { color: C.ink, width: BOLD });
    if (bi === 0) s += label(PAD + BX / 2 + 16, (prevBottom + b.y) / 2, t(v, "calls", "anrop"), { color: C.muted });
    s += box(PAD, b.y, BX, b.h, { style: b.style, label: b.name, sub: b.sub, size: 19, subSize: 15, subMono: true });
    prevBottom = b.y + b.h;
  });
  all.forEach((c, k) => {
    const x0 = PAD + BX, x1 = xs[k], top = PAD + PH;
    const color = c.dash ? C.muted : C.accent;
    s += arrowPath(`M${x0},${c.y} L${x1 - 10},${c.y} Q${x1},${c.y} ${x1},${c.y - 10} L${x1},${top + 4}`, x1, top + 2, 0, -1, { color, width: 2.5, dash: c.dash });
    s += label(x0 + 16, c.y - 16, c.name, { fit: x1 - x0 - 30, color: C.ink });
    s += code(x0 + 16, c.y + 18, c.code, { fit: x1 - x0 - 30, color: c.dash ? C.muted : C.accent, weight: 600 });
  });
  return svg(height(v), s);
}
