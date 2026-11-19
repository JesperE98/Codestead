// Helpers for the pictures of the parts *In Practice* and *Guest Articles* (not a picture itself: it has no variants,
// so make.mjs draws nothing from it). Bigger text than the Getting started pictures: the brief for these parts asks for
// labels of at least 14 px at the app's display size (about 0.73 ×), i.e. 19 px in the 720-px drawing.
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { C, MONO, text } from "./style.mjs";

export const variants = [];

/** Label size: 19 px in the drawing is 14 px in the app's text column. */
export const L = 19;
/** Code and small labels: never smaller than this. */
export const S = 19;

/** A label (19 px, weight 600 unless given). */
export const label = (x, y, s, o = {}) => text(x, y, s, { size: L, weight: 600, ...o });
/** Code (JetBrains Mono, 19 px). */
export const code = (x, y, s, o = {}) => text(x, y, s, { size: 19, weight: 500, mono: true, ...o });

/**
 * Part of a simulator render: the rectangle (sx, sy, sw, sh) of the program's window (in the window's pixels, e.g. 800 ×
 * 600) drawn into (x, y, w, h). `r` is the render ({ href, width, height }), `win` the window's size.
 */
export function crop(r, win, src, x, y, w, h, o = {}) {
  const k = r.width / win[0];
  const id = `crop${Math.round(x)}_${Math.round(y)}_${Math.round(w)}`;
  const vb = `${src[0] * k} ${src[1] * k} ${src[2] * k} ${src[3] * k}`;
  const rr = o.r ?? 6;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="none" overflow="hidden">` +
    `<image href="${r.href}" x="0" y="0" width="${r.width}" height="${r.height}"${o.pixelated ? ` style="image-rendering:pixelated"` : ""}/></svg></g>` +
    (o.border === false ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" fill="none" stroke="${C.boxStroke}" stroke-width="1"/>`);
}

/** A filter that multiplies a picture's colour by `rgb` (0…1), like the sprite shader's `spriteColor * texture(…)`. */
export function tintFilter(id, [r, g, b]) {
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0"/></filter>`;
}

/** A file of the course's content (relative to src/GP/content) as a data URL. */
export function content(path) {
  const file = new URL(`../../${path}`, import.meta.url);
  const type = path.endsWith(".png") ? "image/png" : "application/octet-stream";
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

/** One of the game's textures (src/GP/content/textures/game). */
export const gameTexture = (name) => content(`textures/game/${name}.png`);

// --- PNG ---------------------------------------------------------------------------------------------------------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An RGBA picture (Uint8Array, rows top first) as a PNG data URL. */
export function pngUrl(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6; // RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([sig, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

// --- The course's font, as FreeType renders it (the simulator's table) ------------------------------------------

let glyphTable = null;
/** A glyph of Inter Bold at 24 or 48 pixels: { width, rows, pitch, left, top, advance, bitmap: Uint8Array }. */
export function glyph(size, ch) {
  glyphTable ??= JSON.parse(readFileSync(new URL("../../../Codestead.GP.Gpu/Fonts/inter-bold.glyphs.json", import.meta.url), "utf8"));
  const g = glyphTable.sizes[String(size)][String(typeof ch === "number" ? ch : ch.codePointAt(0))];
  return { ...g, bitmap: Buffer.from(g.bitmap ?? "", "base64") };
}

/** A glyph's coverage as a PNG data URL in the colour `rgb` (alpha = coverage). */
export function glyphUrl(g, rgb = [31, 36, 48]) {
  const w = Math.max(g.width, 1), h = Math.max(g.rows, 1);
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < g.rows; y++)
    for (let x = 0; x < g.width; x++) {
      const p = (y * w + x) * 4;
      px[p] = rgb[0]; px[p + 1] = rgb[1]; px[p + 2] = rgb[2]; px[p + 3] = g.bitmap[y * g.pitch + x];
    }
  return pngUrl(w, h, px);
}

/** A pixelated image (no smoothing when scaled up). */
export function pixelImage(href, x, y, w, h) {
  return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
}

/** Numbers the Swedish way: a decimal comma (0,5) – the English text keeps the point. */
export const num = (v, x) => (v.lang === "sv" ? String(x).replace(".", ",") : String(x));

export { MONO };
