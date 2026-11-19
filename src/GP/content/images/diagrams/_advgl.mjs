// Helpers for the pictures of the course part Advanced OpenGL (depth-testing … anti-aliasing). Not a picture itself:
// it has no variants, so make.mjs draws nothing for it. The sizes follow the brief for these chapters: the text column
// shows a 720-px picture at about 0.73×, so labels are at least 19 px here (about 14 px on the screen).
import { C, MONO, esc, text } from "./style.mjs";

export const variants = [];
export const height = 0;
export const draw = () => "";

export const LBL = 20; // labels
export const SML = 19; // the smallest text
export const TTL = 21; // panel titles

/** A caption under a simulator picture: a main line (optionally mono) and a muted second line. */
export function caption(cx, y, main, sub, o = {}) {
  let s = text(cx, y, main, { anchor: "middle", weight: 650, size: LBL, mono: o.mono, fit: o.fit });
  if (sub) s += text(cx, y + 26, sub, { anchor: "middle", size: SML, color: C.muted, fit: o.fit });
  return s;
}

/**
 * A part of a picture (sx, sy, sw, sh in its own pixels, the whole being iw × ih) shown at (x, y, w, h), e.g. a magnified
 * crop of a simulator render; `pixelated` keeps the pixels square.
 */
export function crop(href, iw, ih, sx, sy, sw, sh, x, y, w, h, o = {}) {
  const r = o.r ?? 6;
  const id = `crop${Math.round(x)}_${Math.round(y)}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none">` +
    `<image href="${href}" x="0" y="0" width="${iw}" height="${ih}" preserveAspectRatio="none"${o.pixelated ? ` style="image-rendering:pixelated"` : ""}/></svg></g>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${o.stroke ?? C.boxStroke}" stroke-width="${o.strokeWidth ?? 1}"/>`;
}

/** A polyline through points [[x, y], …]. */
export function poly(points, o = {}) {
  const d = points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return `<path d="${d}${o.close ? " Z" : ""}" fill="${o.fill ?? "none"}" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? 1.5}" stroke-linejoin="round" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

/** Mono text in a light box, for a short piece of code. */
export function code(x, y, s, o = {}) {
  const size = o.size ?? SML;
  const w = o.w ?? Math.round(String(s).length * size * 0.6 + 16);
  const h = size + 14;
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="5" fill="${o.fill ?? "#ffffff"}" stroke="${o.stroke ?? C.boxStroke}" stroke-width="1"/>` +
    `<text x="${x0 + w / 2}" y="${y}" font-size="${size}" font-weight="500" fill="${o.color ?? C.ink}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" data-fit="${w - 4}">${esc(s)}</text>`;
}
