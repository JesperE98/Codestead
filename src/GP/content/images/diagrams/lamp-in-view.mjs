// Colors, "The default camera" (after its quiz): the scene from above – the cube at the origin, the lamp at
// (1.2, 1.0, 2.0) – and what a camera sees with a 45° field of view in an 800 × 600 window (about 29° to each side).
// From learnopengl's (0, 0, 3), looking down −z, the lamp is outside the view; from the course's (−3, 0, 3), looking
// along (3.5, 0.4, −2.2), the cube and the lamp are both in it. Language-free (coordinates only).
import { C, PAD, W, arrow, line, svg, text } from "./style.mjs";
import { L, LS, lamp } from "./_lighting.mjs";

export const variants = [{ out: "lamp-in-view.webp", lang: "en" }];

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 292, U = 52;
export const height = PAD + PH + 46;
const HALF = (Math.atan(Math.tan((22.5 * Math.PI) / 180) * (800 / 600)) * 180) / Math.PI; // ≈ 28.9°

function panel(x, y, cam, dir, ok, label) {
  // x to the right, z downwards (towards the viewer of the course's usual pictures); (0, 0) a little right of centre.
  const ox = x + PW * 0.62, oy = y + 92;
  const P = (wx, wz) => [ox + wx * U, oy + wz * U];
  let s = `<rect x="${x}" y="${y}" width="${PW}" height="${PH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  const [cx, cy] = P(...cam);
  const a = Math.atan2(dir[1], dir[0]);
  const r = 9 * U;
  const wedge = (d) => [cx + r * Math.cos(a + (d * Math.PI) / 180), cy + r * Math.sin(a + (d * Math.PI) / 180)];
  const [w1x, w1y] = wedge(-HALF), [w2x, w2y] = wedge(HALF);
  s += `<clipPath id="pc${Math.round(x)}"><rect x="${x}" y="${y}" width="${PW}" height="${PH}" rx="6"/></clipPath>`;
  s += `<g clip-path="url(#pc${Math.round(x)})"><path d="M${cx},${cy} L${w1x},${w1y} L${w2x},${w2y} Z" fill="${C.accent2Soft}" opacity="0.85"/>` +
    line(cx, cy, w1x, w1y, { color: C.accent2, width: 1.5, dash: "5 4" }) + line(cx, cy, w2x, w2y, { color: C.accent2, width: 1.5, dash: "5 4" }) + "</g>";
  // The cube (1 × 1 around the origin) and the lamp.
  const [qx, qy] = P(-0.5, -0.5);
  s += `<rect x="${qx}" y="${qy}" width="${U}" height="${U}" fill="${"#ff8050"}" stroke="${C.ink}" stroke-width="1.5"/>`;
  const [lx, ly] = P(1.2, 2.0);
  s += lamp(lx, ly, { r: 10 });
  s += arrow(cx, cy, cx + Math.cos(a) * 62, cy + Math.sin(a) * 62, { color: C.accent2, width: 2.5 });
  s += `<circle cx="${cx}" cy="${cy}" r="7" fill="${C.accent2}" stroke="#fff" stroke-width="2"/>`;
  s += text(cx + (cam[0] < -1 ? 0 : -12), cy + 26, label, { size: LS, mono: true, weight: 650, anchor: cam[0] < -1 ? "start" : "end", color: C.accent2 });
  s += text(lx + 20, ly - 4, ok ? "✓" : "✗", { size: L + 4, weight: 700, color: ok ? C.good : C.bad });
  return s;
}

export function draw() {
  let s = "";
  s += panel(PAD, PAD, [0, 3], [0, -1], false, "(0, 0, 3)");
  s += panel(PAD + PW + GAP, PAD, [-3, 3], [3.5, -2.2], true, "(−3, 0, 3)");
  // The axes of the view, once, under the left panel.
  const ax = PAD + 8, ay = PAD + PH + 24;
  s += arrow(ax, ay, ax + 40, ay, { color: C.x, width: 2 }) + text(ax + 48, ay, "*x*", { size: LS, color: C.x, weight: 650 });
  s += arrow(ax + 84, ay - 12, ax + 84, ay + 14, { color: C.z, width: 2 }) + text(ax + 94, ay + 2, "*z*", { size: LS, color: C.z, weight: 650 });
  s += lamp(W - PAD - 238, ay, { r: 8 }) + text(W - PAD - 218, ay, "(1.2, 1.0, 2.0)", { size: LS, mono: true, weight: 600 });
  return svg(height, s);
}
