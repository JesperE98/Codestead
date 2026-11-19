// Camera, "Euler angles": the two triangles the chapter describes. From above (the xz-plane, +z towards the bottom
// of the page), the yaw is measured from the x axis: direction.x = cos(yaw), direction.z = sin(yaw). From the side,
// the pitch tilts the direction out of the plane: y = sin(pitch), and what stays in the plane is cos(pitch) long.
import { BOLD, C, PAD, W, arcArrow, arrow, line, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("yaw-pitch");
export const height = 300;

const PW = (W - 2 * PAD - 16) / 2;

export function draw(v) {
  let s = "";
  const top = PAD, ph = height - 2 * PAD;
  for (let i = 0; i < 2; i++) s += `<rect x="${PAD + i * (PW + 16)}" y="${top}" width="${PW}" height="${ph}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;

  // Seen from above: x to the right, z down the page; the direction at yaw = −60° points up and to the right.
  {
    const x = PAD, ox = x + 70, oy = top + 210, r = 150;
    s += text(x + 14, top + 20, t(v, "Seen from above", "Sett ovanifrån"), { size: 14, weight: 650 });
    s += arrow(ox - 30, oy, ox + r + 50, oy, { color: C.x, width: 1.5 });
    s += text(ox + r + 56, oy, "*x*", { size: 15, weight: 600, color: C.x });
    s += arrow(ox, oy - r - 20, ox, oy + 50, { color: C.z, width: 1.5 });
    s += text(ox + 8, oy + 52, "+*z*", { size: 14, weight: 600, color: C.z });
    s += text(ox + 8, oy - r - 18, "−*z*", { size: 14, color: C.muted });
    const yaw = -60, a = (yaw * Math.PI) / 180;
    const ex = ox + r * Math.cos(a), ey = oy + r * Math.sin(a); // +z is down the page, so z = sin(yaw) goes down
    s += line(ex, ey, ex, oy, { color: C.z, width: BOLD, dash: "6 4" });
    s += line(ox, oy, ex, oy, { color: C.x, width: BOLD, dash: "6 4" });
    s += arrow(ox, oy, ex, ey, { color: C.accent, width: BOLD });
    s += arcArrow(ox, oy, 40, 0, 60, { noHead: true, color: C.ink });
    s += text(ox + 46, oy - 24, "*yaw* = −60°", { size: 13, weight: 600 });
    s += text((ox + ex) / 2, oy + 16, "cos(*yaw*)", { size: 13, color: C.x, anchor: "middle", weight: 600 });
    s += text(ex + 8, (ey + oy) / 2, "sin(*yaw*)", { size: 13, color: C.z, weight: 600 });
    s += text(ex + 8, ey - 6, t(v, "direction", "riktning"), { size: 13, color: C.accent, weight: 650 });
  }
  // Seen from the side: the horizontal is the direction's part in the xz-plane, y is up.
  {
    const x = PAD + PW + 16, ox = x + 70, oy = top + 210, r = 150;
    s += text(x + 14, top + 20, t(v, "Seen from the side", "Sett från sidan"), { size: 14, weight: 650 });
    s += arrow(ox - 30, oy, ox + r + 50, oy, { color: C.line, width: 1.5 });
    s += text(ox + r + 46, oy + 16, t(v, "xz-plane", "xz-planet"), { size: 12, color: C.muted, anchor: "end" });
    s += arrow(ox, oy + 30, ox, oy - r - 20, { color: C.y, width: 1.5 });
    s += text(ox + 8, oy - r - 18, "*y*", { size: 15, weight: 600, color: C.y });
    const pitch = 35, a = (pitch * Math.PI) / 180;
    const ex = ox + r * Math.cos(a), ey = oy - r * Math.sin(a);
    s += line(ex, ey, ex, oy, { color: C.y, width: BOLD, dash: "6 4" });
    s += line(ox, oy, ex, oy, { color: C.line, width: BOLD, dash: "6 4" });
    s += arrow(ox, oy, ex, ey, { color: C.accent, width: BOLD });
    s += arcArrow(ox, oy, 46, 0, pitch, { noHead: true, color: C.ink });
    s += text(ox + 54, oy - 14, "*pitch* = 35°", { size: 13, weight: 600 });
    s += text((ox + ex) / 2, oy + 16, "cos(*pitch*)", { size: 13, color: C.muted, anchor: "middle", weight: 600 });
    s += text(ex + 8, (ey + oy) / 2, "sin(*pitch*)", { size: 13, color: C.y, weight: 600 });
    s += text(ex + 8, ey - 6, t(v, "direction", "riktning"), { size: 13, color: C.accent, weight: 650 });
  }
  return svg(height, s);
}
