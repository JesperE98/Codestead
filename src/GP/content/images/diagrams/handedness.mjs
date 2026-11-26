// The maths of 3D, "Three axes": a right-handed system (x right, y up, +z out of the screen towards you – the
// course's convention in every API) next to a left-handed one (+z into the screen). Both drawn with the course's
// oblique view; the screen is the xy plane, drawn face on. One picture per language.
import { BOLD, C, PAD, W, arrow, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("handedness");
export const height = 262;

const PW = (W - 2 * PAD - 16) / 2; // a panel's width

function panel(v, i, zSign) {
  const x = PAD + i * (PW + 16), y = PAD;
  let s = `<rect x="${x}" y="${y}" width="${PW}" height="${height - 2 * PAD}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const right = zSign > 0;
  s += text(x + PW / 2, y + 22, right ? t(v, "Right-handed", "Högerhänt") : t(v, "Left-handed", "Vänsterhänt"), { size: 15, weight: 650, anchor: "middle" });
  const ox = x + PW / 2 + 6, oy = y + 118, L = 68;
  // The screen: the xy plane, face on.
  s += `<rect x="${ox - 92}" y="${oy - 58}" width="184" height="116" rx="4" fill="${C.card}" stroke="${C.line}" stroke-dasharray="4 3"/>`;
  // +z towards the viewer is drawn down and to the left; into the screen up and to the right.
  const zx = -0.55 * L * zSign, zy = 0.42 * L * zSign;
  s += line(ox, oy, ox - zx * 0.8, oy - zy * 0.8, { color: C.line, dash: "4 3" }); // −z
  s += arrow(ox, oy, ox + L, oy, { color: C.x, width: BOLD });
  s += arrow(ox, oy, ox, oy - L, { color: C.y, width: BOLD });
  s += arrow(ox, oy, ox + zx, oy + zy, { color: C.z, width: BOLD });
  s += text(ox + L + 8, oy, "+*x*", { size: 15, weight: 650, color: C.x });
  s += text(ox + 9, oy - L + 4, "+*y*", { size: 15, weight: 650, color: C.y });
  s += text(ox + zx + (right ? -8 : 8), oy + zy + (right ? 8 : -6), "+*z*", { size: 15, weight: 650, color: C.z, anchor: right ? "end" : "start" });
  s += text(x + PW / 2, y + 192, right ? t(v, "+z out of the screen, towards you", "+z ut ur skärmen, mot dig") : t(v, "+z into the screen, away from you", "+z in i skärmen, bort från dig"), { size: 13, weight: 600, anchor: "middle", fit: PW - 20 });
  s += text(x + PW / 2, y + 211, right ? t(v, "OpenGL, GLM, DirectXMath …RH – this course", "OpenGL, GLM, DirectXMath …RH – kursen") : t(v, "DirectXMath …LH (classic DirectX)", "DirectXMath …LH (klassisk DirectX)"), { size: 12, color: C.muted, anchor: "middle", fit: PW - 20 });
  return s;
}

export function draw(v) {
  return svg(height, panel(v, 0, 1) + panel(v, 1, -1));
}
