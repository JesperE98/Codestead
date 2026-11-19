// Helpers for the pictures of the course parts "Lighting" and "Model loading" (not a picture itself: no variants, so
// make.mjs draws nothing from it). The labels of these pictures are at least 19 px, so that they are 14 px or more in
// the app's default window, where a picture is shown at about 0.73×.
import { C, MONO, line, text } from "./style.mjs";

export const variants = [];
export const height = 0;
export function draw() {
  return "";
}

/** The size of the labels (19 px or more, see above), of the small labels and of a picture's titles. */
export const L = 20;
export const LS = 19;
export const LT = 22;

/** The course's dark grey clear colour of the lighting chapters, (0.1, 0.1, 0.1). */
export const SCENE = "#1a1a1a";

/**
 * A part of a simulator render: the rectangle (sx, sy, sw, sh), in the render's own pixels (of a `iw` × `ih` picture),
 * shown at (x, y) with the size w × h, with rounded corners and a thin border.
 */
export function crop(r, sx, sy, sw, sh, x, y, w, h, o = {}) {
  const rad = o.r ?? 6;
  const id = `crop${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(sx)}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none">` +
    `<image href="${r.href}" x="0" y="0" width="${r.width}" height="${r.height}"/></svg></g>` +
    (o.border === false ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="none" stroke="${C.boxStroke}" stroke-width="1"/>`);
}

/** A lamp: a small glowing disc with rays (for a light source in a drawing). */
export function lamp(x, y, o = {}) {
  const r = o.r ?? 11, color = o.color ?? "#f2b134";
  let s = `<circle cx="${x}" cy="${y}" r="${r + 7}" fill="${color}" opacity="0.18"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    s += line(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), { color: "#c98a12", width: 2 });
  }
  return s + `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#c98a12" stroke-width="1.5"/>`;
}

/** An eye (the viewer, the camera) looking in the direction `angle` (degrees, 0 = right, counter-clockwise). */
export function eye(x, y, angle = 0, o = {}) {
  const s = o.size ?? 14;
  return `<g transform="translate(${x} ${y}) rotate(${-angle})">` +
    `<path d="M${-s},0 Q0,${-s * 0.95} ${s},0 Q0,${s * 0.95} ${-s},0 Z" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>` +
    `<circle cx="${s * 0.25}" cy="0" r="${s * 0.38}" fill="${C.ink}"/></g>`;
}

/** A surface seen edge-on: a thick line with short hatching underneath (the inside of the object). */
export function surface(x1, y1, x2, y2, o = {}) {
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const nx = uy, ny = -ux; // the side the hatching is on (below for a surface from left to right)
  let s = "";
  for (let d = 8; d < len; d += 12) {
    const px = x1 + ux * d, py = y1 + uy * d;
    s += line(px, py, px - nx * 9 - ux * 7, py - ny * 9 - uy * 7, { color: C.line, width: 1.2 });
  }
  return s + line(x1, y1, x2, y2, { color: o.color ?? C.ink, width: o.width ?? 3 });
}

/**
 * A memory layout in rows of 16 bytes (std140 / HLSL constant buffer packing): `fields` are
 * { name, from, to, kind: "field" | "pad" | "gap" , color? } with byte offsets; each row is one line of four 4-byte cells.
 * Returns SVG for the rows starting at byte `start` (a multiple of 16), `rows` of them, at (x, y) with a cell width `cw`
 * and a row height `rh`. The offsets are written on the left.
 */
export function rows16(fields, start, rows, x, y, cw, rh, o = {}) {
  let s = "";
  const labelW = o.labelW ?? 52;
  for (let r = 0; r < rows; r++) {
    const ry = y + r * rh, base = start + r * 16;
    s += text(x + labelW - 10, ry + rh / 2, String(base), { size: LS, anchor: "end", color: C.muted, mono: true });
    for (let c = 0; c < 4; c++)
      s += `<rect x="${x + labelW + c * cw}" y="${ry}" width="${cw}" height="${rh}" fill="#fff" stroke="${C.grid}" stroke-width="1"/>`;
  }
  for (const f of fields) {
    // A field may span several cells of one row (a field never crosses a row in these layouts, except a matrix).
    for (let b = f.from; b < f.to; b += 16 - (b % 16)) {
      const rowStart = b - (b % 16), end = Math.min(f.to, rowStart + 16);
      const r = (rowStart - start) / 16;
      if (r < 0 || r >= rows) continue;
      const fx = x + labelW + ((b % 16) / 4) * cw, fw = ((end - b) / 4) * cw, fy = y + r * rh;
      const style = f.kind === "pad"
        ? { fill: "#eef0f4", stroke: C.line, dash: "4 3" }
        : f.kind === "gap"
          ? { fill: "url(#hatch)", stroke: C.line, dash: "4 3" }
          : { fill: f.fill ?? C.accentSoft, stroke: f.color ?? C.accent };
      s += `<rect x="${fx + 2}" y="${fy + 3}" width="${fw - 4}" height="${rh - 6}" rx="5" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""}/>`;
      if (b === f.from && f.name)
        s += text(fx + fw / 2, fy + rh / 2, f.name, { size: f.size ?? LS, anchor: "middle", mono: f.kind !== "gap", weight: 600, color: f.kind === "field" || !f.kind ? C.ink : C.muted, fit: fw - 8 });
    }
  }
  return s;
}

/** The hatching pattern rows16's "gap" cells use; put it once into a picture that has gaps. */
export const hatchDef = `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
  `<rect width="8" height="8" fill="#f4f5f8"/><line x1="0" y1="0" x2="0" y2="8" stroke="#c9ced8" stroke-width="2"/></pattern></defs>`;

/** Mono text, a shortcut. */
export const code = (x, y, s, o = {}) => text(x, y, s, { mono: true, size: LS, ...o });

export { MONO };
