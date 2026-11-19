// Specular IBL, after the quizzes on the BRDF integration map: the lookup texture as the simulator draws it after the
// task brdf-lut (red = the scale of F0, green = the bias), with its axes: NdotV from 0 (grazing) to 1 (head-on) to the
// right, the roughness from 0 to 1 upwards.
import { C, PAD, W, arrow, perLanguage, svg, t, text } from "./style.mjs";
import { crop, label } from "./_advlight.mjs";

export const variants = perLanguage("brdf-lut");
export const lossy = true;

const S = 290;
export const height = PAD + S + 70;
export const renders = { lut: { api: "opengl", chapter: "specular-ibl", from: "task:brdf-lut", width: 800 } };

export function draw(v, R) {
  const img = R.lut[0];
  const x = PAD + 118, y = PAD + 10;
  // The quad covers the whole window: show it square, as the texture is.
  let s = crop(img.href, img.width, img.height, 0, 0, img.width, img.height, x, y, S, S, { r: 2 });
  s += arrow(x, y + S + 16, x + S, y + S + 16, { color: C.ink, width: 2 });
  s += text(x, y + S + 38, "0", { size: 19, color: C.muted, anchor: "middle" }) + text(x + S, y + S + 38, "1", { size: 19, color: C.muted, anchor: "middle" });
  s += text(x + S / 2, y + S + 40, "NdotV", { size: 19, mono: true, anchor: "middle", weight: 600 });
  s += arrow(x - 16, y + S, x - 16, y, { color: C.ink, width: 2 });
  s += text(x - 30, y + S, "0", { size: 19, color: C.muted, anchor: "middle" }) + text(x - 30, y, "1", { size: 19, color: C.muted, anchor: "middle" });
  s += label(x - 26, y + S / 2, "roughness", { anchor: "end", size: 19 });
  const lx = x + S + 30, fit = W - PAD - lx;
  s += `<rect x="${lx}" y="${y + 20}" width="22" height="22" rx="4" fill="#e01010"/>` + label(lx + 32, y + 31, t(v, "red: scale of F0", "röd: skala för F0"), { fit: fit - 32 });
  s += `<rect x="${lx}" y="${y + 60}" width="22" height="22" rx="4" fill="#10c010"/>` + label(lx + 32, y + 71, t(v, "green: bias", "grön: bias"), { fit: fit - 32 });
  s += label(lx, y + 130, t(v, "right: head-on,", "höger: rakt framifrån,"), { color: C.muted, fit });
  s += label(lx, y + 156, t(v, "F0 counts fully", "F0 räknas fullt"), { color: C.muted, fit });
  s += label(lx, y + 200, t(v, "bottom left: grazing", "nere till vänster: flackt"), { color: C.muted, fit });
  s += label(lx, y + 226, t(v, "and smooth: the bias", "och slätt: bias"), { color: C.muted, fit });
  s += label(lx, y + 252, t(v, "takes over", "tar över"), { color: C.muted, fit });
  return svg(height, s);
}
