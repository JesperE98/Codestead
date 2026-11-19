// Helpers for the pictures of the Advanced Lighting and PBR parts (not a picture itself: it has no variants, so
// make.mjs draws nothing for it). The pictures are shown at about 0.73× in the app's default window, so their labels
// are at least 19 px here (14 px on the screen) – fewer and bigger words than the Getting-started pictures.
import { C, LINE, esc, line, text } from "./style.mjs";

export const variants = [];
export const height = 0;
export const draw = () => "";

/** Label sizes: L for labels, S for the smallest text (numbers on axes), T for panel titles. */
export const L = 19;
export const S = 19;
export const T = 21;

/** A label in the part's size (19 px, weight 600 unless given). */
export const label = (x, y, s, o = {}) => text(x, y, s, { size: L, weight: 600, ...o });

/**
 * A part of a picture (a simulator render): the source rectangle (sx, sy, sw, sh) of an image of size iw × ih, shown in
 * the rectangle (x, y, w, h) with rounded corners and a thin border.
 */
export function crop(href, iw, ih, sx, sy, sw, sh, x, y, w, h, o = {}) {
  const id = `crop${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(sx)}_${Math.round(sy)}`;
  const r = o.r ?? 6;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" overflow="hidden">` +
    `<image href="${href}" x="0" y="0" width="${iw}" height="${ih}"${o.pixelated ? ` style="image-rendering:pixelated"` : ""}/></svg></g>` +
    (o.border === false ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${o.stroke ?? C.boxStroke}" stroke-width="${o.strokeWidth ?? 1}"/>`);
}

/** A rectangle outline (a zoom frame, a highlight). */
export function frame(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 3}" fill="none" stroke="${o.color ?? C.accent}" stroke-width="${o.width ?? 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
}

/** A polyline / curve through points [[x, y], …]. */
export function polyline(points, o = {}) {
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return `<path d="${d}" fill="${o.fill ?? "none"}" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? LINE}" stroke-linejoin="round" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

/**
 * A plot area: (x, y) the top left, w × h pixels, the ranges [x0, x1] and [y0, y1]. Returns { X, Y, P, curve, axes }:
 * X(v) and Y(v) map values to pixels, P(vx, vy) both, curve(f, o) draws f over the x range, axes(o) draws the axes,
 * the ticks and their numbers (o.xticks, o.yticks: values; o.xfmt, o.yfmt: formats).
 */
export function plot(x, y, w, h, [x0, x1], [y0, y1]) {
  const X = (v) => x + ((v - x0) / (x1 - x0)) * w;
  const Y = (v) => y + h - ((v - y0) / (y1 - y0)) * h;
  const P = (vx, vy) => [X(vx), Y(vy)];
  const curve = (f, o = {}) => {
    const n = o.steps ?? 200, a = o.from ?? x0, b = o.to ?? x1;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const vx = a + ((b - a) * i) / n;
      const vy = f(vx);
      pts.push([X(vx), Y(Math.max(y0 - (y1 - y0) * 0.02, Math.min(y1 + (y1 - y0) * 0.02, vy)))]);
    }
    return polyline(pts, o);
  };
  const axes = (o = {}) => {
    let s = "";
    for (const v of o.ygrid ?? []) s += line(x, Y(v), x + w, Y(v), { color: C.grid, width: 1 });
    for (const v of o.xgrid ?? []) s += line(X(v), y, X(v), y + h, { color: C.grid, width: 1 });
    s += line(x, y + h, x + w, y + h, { color: C.line }) + line(x, y, x, y + h, { color: C.line });
    const fx = o.xfmt ?? ((v) => String(v)), fy = o.yfmt ?? ((v) => String(v));
    for (const v of o.xticks ?? []) {
      s += line(X(v), y + h, X(v), y + h + 5, { color: C.line });
      s += text(X(v), y + h + 18, fx(v), { size: o.size ?? S, anchor: "middle", color: C.muted, weight: 500 });
    }
    for (const v of o.yticks ?? []) {
      s += line(x - 5, Y(v), x, Y(v), { color: C.line });
      s += text(x - 9, Y(v), fy(v), { size: o.size ?? S, anchor: "end", color: C.muted, weight: 500 });
    }
    return s;
  };
  return { X, Y, P, curve, axes, x, y, w, h };
}

/** A filled polygon. */
export function poly(points, o = {}) {
  return `<polygon points="${points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ")}" fill="${o.fill ?? "none"}" stroke="${o.color ?? "none"}" stroke-width="${o.width ?? LINE}"${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} stroke-linejoin="round"/>`;
}

/** A panel: a white rounded rectangle with the part's border. */
export function panel(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${o.fill ?? C.boxFill}" stroke="${o.stroke ?? C.boxStroke}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
}

/** An angle mark: an arc of radius r around (cx, cy) between two directions (in screen coordinates, any length). */
export function angle(cx, cy, r, [ax, ay], [bx, by], o = {}) {
  const a1 = Math.atan2(ay, ax), a2 = Math.atan2(by, bx);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], p2 = [cx + r * Math.cos(a1 + d), cy + r * Math.sin(a1 + d)];
  const sweep = d > 0 ? 1 : 0;
  return `<path d="M${p1[0]},${p1[1]} A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]}" fill="${o.fill ?? "none"}" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? LINE}"/>`;
}

/** A point on the arc of an angle mark (for its label): the middle direction at radius r. */
export function angleMid(cx, cy, r, [ax, ay], [bx, by]) {
  const a1 = Math.atan2(ay, ax), a2 = Math.atan2(by, bx);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const m = a1 + d / 2;
  return [cx + r * Math.cos(m), cy + r * Math.sin(m)];
}

/** A unit vector in screen space for an angle in degrees measured from +x towards up (counter-clockwise on screen). */
export const dir = (deg) => [Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180)];

/** Raw SVG text with escaping, for <title>-less groups. */
export const raw = (s) => esc(s);
