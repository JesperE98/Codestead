// Coordinate Systems, end of "Perspective projection": perspective and orthographic side by side – above, the frustum
// seen from the side with two equal cubes at different distances; below, the chapter's ten cubes drawn by the
// simulator with the chapter's perspective matrix and with an orthographic one (the course's OpenGL solution).
import { BOLD, C, PAD, W, image, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("projections");
export const lossy = true;

const PW = (W - 2 * PAD - 20) / 2, PH = (PW * 3) / 4, SH = 120;
export const height = PAD + SH + 12 + PH + 46;

export const renders = {
  perspective: { api: "opengl", chapter: "coordinate-systems", width: Math.round(PW * 2), times: [3.0] },
  orthographic: {
    api: "opengl",
    chapter: "coordinate-systems",
    edits: [{
      file: "main.cpp",
      find: "projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);",
      replace: "projection = glm::ortho(-4.0f, 4.0f, -3.0f, 3.0f, 0.1f, 100.0f);",
    }],
    width: Math.round(PW * 2),
    times: [3.0],
  },
};

/** The view volume seen from the side: the camera on the left, looking right. */
function side(x, y, perspective, v) {
  let s = `<rect x="${x}" y="${y}" width="${PW}" height="${SH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const cy = y + SH / 2 + 4, camX = x + 26;
  const nearX = x + 70, farX = x + PW - 26;
  const half = (px) => (perspective ? ((px - camX) / (farX - camX)) * 46 : 30);
  const poly = [[nearX, cy - half(nearX)], [farX, cy - half(farX)], [farX, cy + half(farX)], [nearX, cy + half(nearX)]];
  s += `<polygon points="${poly.map((p) => p.join(",")).join(" ")}" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
  if (perspective) {
    s += line(camX, cy, nearX, cy - half(nearX), { color: C.accent, width: 1, dash: "3 3" });
    s += line(camX, cy, nearX, cy + half(nearX), { color: C.accent, width: 1, dash: "3 3" });
  }
  // The camera: a small body with a lens, looking right.
  s += `<rect x="${camX - 14}" y="${cy - 8}" width="16" height="16" rx="3" fill="${C.ink}"/><path d="M${camX + 2},${cy - 4} L${camX + 9},${cy - 8} L${camX + 9},${cy + 8} L${camX + 2},${cy + 4} Z" fill="${C.ink}"/>`;
  // Two equal cubes, near and far.
  for (const cx of [nearX + 48, farX - 70]) s += `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="2" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="${BOLD - 1}"/>`;
  s += line(nearX, cy - half(nearX), nearX, cy + half(nearX), { color: C.accent, width: BOLD });
  s += line(farX, cy - half(farX), farX, cy + half(farX), { color: C.accent, width: BOLD });
  s += text(nearX, y + 12, t(v, "near plane", "nära planet"), { size: 12, color: C.muted, anchor: "middle" });
  s += text(farX + 4, y + 12, t(v, "far plane", "bortre planet"), { size: 12, color: C.muted, anchor: "end" });
  return s;
}

export function draw(v, R) {
  let s = "";
  const cols = [
    ["perspective", true, t(v, "Perspective", "Perspektiv"), t(v, "far cubes look smaller", "kuber långt bort ser mindre ut")],
    ["orthographic", false, t(v, "Orthographic", "Ortografisk"), t(v, "every cube the same size", "alla kuber lika stora")],
  ];
  cols.forEach(([id, persp, label, sub], i) => {
    const x = PAD + i * (PW + 20);
    s += side(x, PAD, persp, v);
    s += image(R[id][0].href, x, PAD + SH + 12, PW, PH);
    s += text(x + PW / 2, PAD + SH + 12 + PH + 18, label, { anchor: "middle", weight: 600, fit: PW });
    s += text(x + PW / 2, PAD + SH + 12 + PH + 36, sub, { anchor: "middle", size: 12, color: C.muted, fit: PW });
  });
  return svg(height, s);
}
