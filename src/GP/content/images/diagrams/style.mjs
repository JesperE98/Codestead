// The look every diagram of Codestead GP's chapters shares (the style guide in docs/DEVELOPMENT.md, "Bilder i kapitlen"),
// and small helpers that write SVG in it. Coordinates are CSS pixels of the finished picture: 720 wide, rendered at 2×
// by make.mjs and scaled down.
import { readFileSync } from "node:fs";

/** The palette. Light card, dark ink; the axis colours are the usual x red, y green, z blue. */
export const C = {
  card: "#f7f8fa", // the picture's background (a light card that also sits well on the app's dark theme)
  cardBorder: "#d9dee6",
  ink: "#1f2430", // text and main lines
  muted: "#5b6370", // secondary text
  line: "#8a93a3", // helper lines, outlines of things that are not the point
  grid: "#e2e6ec",
  boxFill: "#ffffff",
  boxStroke: "#c3cad5",
  x: "#d63c3c",
  y: "#24944a",
  z: "#2d67d6",
  xSoft: "#fbe3e3",
  ySoft: "#ddf3e3",
  zSoft: "#e0e9fb",
  accent: "#e0731f", // the thing the picture is about
  accentSoft: "#fde9d9",
  accent2: "#7a4fd0", // a second thing, to compare with
  accent2Soft: "#ece5fa",
  good: "#24944a",
  bad: "#c62828",
  clear: "#334c4c", // the course's clear colour (0.2, 0.3, 0.3)
};

export const W = 720; // every picture's width
export const PAD = 20; // the margin inside the card
export const LINE = 1.5; // normal lines
export const BOLD = 2.5; // vectors, the lines the picture is about
export const FONT = "'Inter Variable', Inter, sans-serif";
export const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

export const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The whole picture: the card and what is on it. */
export function svg(h, body, w = W) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8" fill="${C.card}" stroke="${C.cardBorder}"/>${body}</svg>`;
}

/**
 * Text. `s` may mark *italic* (variables: x, θ) and `code` (identifiers, in the mono font); _{…} is a subscript and
 * ^{…} a superscript. Options: size (14), weight (500), color, anchor (start | middle | end), fit (the width it must
 * fit in – make.mjs reports text that doesn't), mono, italic.
 */
export function text(x, y, s, o = {}) {
  const size = o.size ?? 14;
  const attrs = [
    `x="${x}"`, `y="${y}"`, `font-size="${size}"`, `font-weight="${o.weight ?? 500}"`, `fill="${o.color ?? C.ink}"`,
    `text-anchor="${o.anchor ?? "start"}"`, `dominant-baseline="${o.baseline ?? "central"}"`,
    `font-family="${o.mono ? MONO : FONT}"`,
  ];
  if (o.italic) attrs.push(`font-style="italic"`);
  if (o.fit) attrs.push(`data-fit="${o.fit}"`);
  if (o.opacity !== undefined) attrs.push(`opacity="${o.opacity}"`);
  return `<text ${attrs.join(" ")}>${rich(String(s), size)}</text>`;
}

function rich(s, size) {
  let out = "";
  const re = /\*([^*]+)\*|`([^`]+)`|_\{([^}]+)\}|\^\{([^}]+)\}|([^*`_^]+|[_^])/g;
  for (const m of s.matchAll(re)) {
    if (m[1] !== undefined) out += `<tspan font-style="italic">${esc(m[1])}</tspan>`;
    else if (m[2] !== undefined) out += `<tspan font-family="${MONO}" font-weight="500" font-size="${size * 0.92}">${esc(m[2])}</tspan>`;
    else if (m[3] !== undefined) out += `<tspan font-size="${size * 0.72}" baseline-shift="sub">${rich(m[3], size * 0.72)}</tspan>`;
    else if (m[4] !== undefined) out += `<tspan font-size="${size * 0.72}" baseline-shift="super">${rich(m[4], size * 0.72)}</tspan>`;
    else out += esc(m[5]);
  }
  return out;
}

/** A straight line. */
export function line(x1, y1, x2, y2, o = {}) {
  const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? LINE}" stroke-linecap="round"${dash}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

/** The arrow head at (x, y) pointing in direction (dx, dy). Its size grows a little with the line width. */
function head(x, y, dx, dy, color, width) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const l = 7 + width * 2, h = 3 + width * 1.2;
  const bx = x - ux * l, by = y - uy * l;
  return `<path d="M${x},${y} L${bx - uy * h},${by + ux * h} L${bx + uy * h},${by - ux * h} Z" fill="${color}"/>`;
}

/** An arrow from (x1, y1) to (x2, y2): a line with a filled head (both: a head at each end). */
export function arrow(x1, y1, x2, y2, o = {}) {
  const color = o.color ?? C.ink, width = o.width ?? LINE;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const cut = 6 + width * 2; // the line stops inside the head, so its round end doesn't show at the tip
  const ex = x2 - ((x2 - x1) / len) * cut, ey = y2 - ((y2 - y1) / len) * cut;
  const sx = o.both ? x1 + ((x2 - x1) / len) * cut : x1, sy = o.both ? y1 + ((y2 - y1) / len) * cut : y1;
  let s = line(sx, sy, ex, ey, { color, width, dash: o.dash, opacity: o.opacity });
  s += head(x2, y2, x2 - x1, y2 - y1, color, width);
  if (o.both) s += head(x1, y1, x1 - x2, y1 - y2, color, width);
  return o.opacity !== undefined ? `<g opacity="${o.opacity}">${s}</g>` : s;
}

/** A path with an arrow head at its end; `d` is SVG path data, (tx, ty) the direction at the end. */
export function arrowPath(d, endX, endY, tx, ty, o = {}) {
  const color = o.color ?? C.ink, width = o.width ?? LINE;
  const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dash}/>` + head(endX, endY, tx, ty, color, width);
}

/** A circular arc around (cx, cy) from angle a1 to a2 (degrees, counter-clockwise on screen = up), with a head at a2. */
export function arcArrow(cx, cy, r, a1, a2, o = {}) {
  const rad = (a) => (a * Math.PI) / 180;
  const p = (a) => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
  const [x1, y1] = p(a1), [x2, y2] = p(a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 0 : 1;
  const d = `M${x1},${y1} A${r},${r} 0 ${large} ${sweep} ${x2},${y2}`;
  if (o.noHead) return `<path d="${d}" fill="none" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? LINE}"/>`;
  const dir = a2 > a1 ? 1 : -1; // tangent at a2
  return arrowPath(d, x2, y2, -Math.sin(rad(a2)) * dir, -Math.cos(rad(a2)) * dir, o);
}

/** A rounded box, optionally with a centred label (and a smaller second line). Style: "plain" | "accent" | "accent2" | "muted". */
export function box(x, y, w, h, o = {}) {
  const styles = {
    plain: [C.boxFill, C.boxStroke, C.ink],
    accent: [C.accentSoft, C.accent, C.ink],
    accent2: [C.accent2Soft, C.accent2, C.ink],
    muted: [C.card, C.boxStroke, C.muted],
    x: [C.xSoft, C.x, C.ink],
    y: [C.ySoft, C.y, C.ink],
    z: [C.zSoft, C.z, C.ink],
  };
  const [fill, stroke, ink] = styles[o.style ?? "plain"];
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 6}" fill="${o.fill ?? fill}" stroke="${o.stroke ?? stroke}" stroke-width="${o.width ?? LINE}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
  const fit = w - 16;
  if (o.label !== undefined && o.sub !== undefined) {
    s += text(x + w / 2, y + h / 2 - 9, o.label, { anchor: "middle", weight: 600, mono: o.mono, size: o.size ?? 14, color: ink, fit });
    s += text(x + w / 2, y + h / 2 + 10, o.sub, { anchor: "middle", size: o.subSize ?? 12, color: C.muted, mono: o.subMono, fit });
  } else if (o.label !== undefined) s += text(x + w / 2, y + h / 2, o.label, { anchor: "middle", weight: o.weight ?? 600, mono: o.mono, size: o.size ?? 14, color: ink, fit });
  return o.opacity !== undefined ? `<g opacity="${o.opacity}">${s}</g>` : s;
}

/**
 * A small label on a white pill, for text on top of a picture or a busy drawing. The width is estimated from the
 * length (Inter at 12 px is about 6.6 px per character); `w` sets it. anchor: start | middle | end.
 */
export function pill(x, y, s, o = {}) {
  const size = o.size ?? 12;
  const w = o.w ?? Math.round(String(s).replace(/[*`]/g, "").length * size * (o.mono ? 0.62 : 0.56) + 14);
  const h = size + 8;
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${o.fill ?? "#ffffff"}" fill-opacity="0.92" stroke="${o.stroke ?? C.boxStroke}" stroke-width="1"/>` +
    text(x0 + w / 2, y, s, { size, anchor: "middle", weight: o.weight ?? 600, color: o.color ?? C.ink, mono: o.mono, fit: w - 4 });
}

/** A numbered step: a small filled circle with the number in it. */
export function badge(x, y, n, o = {}) {
  const r = o.r ?? 9;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.color ?? C.accent}"/>` +
    text(x, y + 0.5, String(n), { size: r * 1.25, weight: 700, color: "#ffffff", anchor: "middle" });
}

/** A dot (a point, a vertex). */
export function dot(x, y, o = {}) {
  return `<circle cx="${x}" cy="${y}" r="${o.r ?? 4}" fill="${o.color ?? C.ink}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="1.5"` : ""}/>`;
}

/** A picture (a simulator render, a texture) with rounded corners and a thin border. */
export function image(href, x, y, w, h, o = {}) {
  const id = `clip${Math.round(x)}_${Math.round(y)}_${Math.round(w)}`;
  const r = o.r ?? 6;
  const fit = o.fit ?? "none"; // "none" stretches (sizes are chosen to match); "xMidYMid slice" crops
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${fit}" clip-path="url(#${id})"${o.pixelated ? ` style="image-rendering:pixelated"` : ""}/>` +
    (o.border === false ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${C.boxStroke}" stroke-width="1"/>`);
}

/** A light grid with spacing `step` over a rectangle. */
export function grid(x, y, w, h, step, o = {}) {
  let s = "";
  for (let gx = x; gx <= x + w + 0.01; gx += step) s += line(gx, y, gx, y + h, { color: o.color ?? C.grid, width: 1 });
  for (let gy = y; gy <= y + h + 0.01; gy += step) s += line(x, gy, x + w, gy, { color: o.color ?? C.grid, width: 1 });
  return s;
}

/** A panel title, left-aligned at the top of a panel. */
export function title(x, y, s, o = {}) {
  return text(x, y, s, { size: 15, weight: 650, ...o });
}

/** The variants of a picture with text in it: one per language. */
export function perLanguage(name, extra = {}) {
  return ["en", "sv"].map((lang) => ({ out: `${lang}/${name}.webp`, lang, ...extra }));
}

/** The variants of a picture for each API (`name-<api>.webp`), per language when `languages` is true. */
export function perApi(name, apis, languages) {
  return apis.flatMap((api) => (languages ? perLanguage(`${name}-${api}`, { api }) : [{ out: `${name}-${api}.webp`, lang: "en", api }]));
}

/** Picks the text for a variant's language: t(v, "Hello", "Hej"). */
export const t = (v, en, sv) => (v.lang === "sv" ? sv : en);

/** A file of a course project as a data URL, e.g. asset("opengl/textures/solution/container.png"). */
export function asset(path) {
  const file = new URL(`../../projects/${path}`, import.meta.url);
  const type = path.endsWith(".png") ? "image/png" : path.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream";
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

/**
 * The course's 3D view for diagrams: an oblique projection of right-handed axes – x to the right, y up, z towards the
 * viewer (drawn down and to the left). Returns (x, y, z) → [sx, sy] around the origin (ox, oy), `unit` pixels per unit.
 */
export function oblique(ox, oy, unit) {
  return (x, y, z) => [ox + unit * (x - 0.55 * z), oy - unit * (y - 0.42 * z)];
}
