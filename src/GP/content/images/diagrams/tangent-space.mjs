// Normal Mapping, "Tangent space": the chapter's quad, turned, with its tangent space – T along the texture's u, B along
// its v, N out of the surface – and the TBN matrix (GLSL's mat3 takes them as columns, HLSL's float3x3 as rows). In OpenGL and
// Vulkan (the images flipped on load) v grows up the image and B points up the wall; in Direct3D v grows down the image
// and B points down.
import { BOLD, C, PAD, W, arrow, asset, dot, perApi, svg, t, text } from "./style.mjs";
import { label, panel } from "./_advlight.mjs";

export const variants = perApi("tangent-space", ["opengl-vulkan", "d3d12"], true);
export const lossy = true; // the brick texture

const PH = 330;
export const height = PAD + PH + PAD;

const ry = (-35 * Math.PI) / 180, rx = (20 * Math.PI) / 180;
function rot([x, y, z]) {
  const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

export function draw(v) {
  const down = v.api === "d3d12";
  let s = panel(PAD, PAD, W - 2 * PAD, PH);
  const P = (x, y) => [PAD + 200 + x * 112, PAD + PH / 2 + 4 - y * 112]; // the turned quad, seen straight on
  const S = (p) => P(...rot(p));
  const TL = S([-1, 1, 0]), TR = S([1, 1, 0]), BL = S([-1, -1, 0]), BR = S([1, -1, 0]);
  const m = [TR[0] - TL[0], TR[1] - TL[1], BL[0] - TL[0], BL[1] - TL[1], TL[0], TL[1]];
  s += `<g transform="matrix(${m.join(" ")})"><image href="${asset("opengl/normal-mapping/solution/brickwall.png")}" x="0" y="0" width="1" height="1" preserveAspectRatio="none"/></g>`;
  s += `<polygon points="${[TL, TR, BR, BL].map((p) => p.join(",")).join(" ")}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
  // T, B, N from the quad's centre.
  const o = S([0, 0, 0]);
  const vec = (d, color, name, off) => {
    const e = S(d);
    return arrow(o[0], o[1], e[0], e[1], { color, width: BOLD + 1 }) +
      `<circle cx="${e[0] + off[0]}" cy="${e[1] + off[1]}" r="15" fill="#fff" fill-opacity="0.9"/>` +
      text(e[0] + off[0], e[1] + off[1], `*${name}*`, { size: 22, weight: 700, anchor: "middle", color });
  };
  s += vec([0.9, 0, 0], C.x, "T", [16, 6]);
  s += vec([0, down ? -0.9 : 0.9, 0], C.y, "B", [-18, down ? 10 : -6]);
  s += vec([0, 0, 1.25], C.z, "N", [-14, 10]);
  s += dot(o[0], o[1], { r: 4.5 });
  // u and v at the image's corner where they start: (0, 0) bottom left (v up) or top left (v down).
  const c0 = down ? TL : BL;
  s += `<circle cx="${c0[0]}" cy="${c0[1]}" r="5" fill="${C.accent}"/>`;
  s += label(c0[0] - 10, c0[1] + (down ? -14 : 16), "(0, 0)", { anchor: "end", color: C.accent });
  // Right: what the letters mean, and the matrix.
  const x = PAD + 410, fit = W - PAD - x - 12;
  s += text(x, PAD + 40, "*T*", { size: 22, weight: 700, color: C.x });
  s += label(x + 26, PAD + 40, t(v, "where u grows", "där u växer"), { fit });
  s += text(x, PAD + 76, "*B*", { size: 22, weight: 700, color: C.y });
  s += label(x + 26, PAD + 76, down ? t(v, "where v grows: down", "där v växer: nedåt") : t(v, "where v grows: up", "där v växer: uppåt"), { fit });
  s += text(x, PAD + 112, "*N*", { size: 22, weight: 700, color: C.z });
  s += label(x + 26, PAD + 112, t(v, "out of the surface", "ut ur ytan"), { fit });
  s += text(x, PAD + 176, down ? "float3x3(T, B, N)" : "mat3(T, B, N)", { size: 19, mono: true, weight: 600 });
  s += label(x, PAD + 206, down ? t(v, "rows: world → tangent", "rader: värld → tangent") : t(v, "columns: tangent → world", "kolumner: tangent → värld"), { fit, color: C.muted });
  s += label(x, PAD + 262, t(v, "red · green · blue", "röd · grön · blå"), { fit, color: C.muted });
  s += label(x, PAD + 290, t(v, "measured along T · B · N", "mätt längs T · B · N"), { fit, color: C.muted });
  return svg(height, s);
}
