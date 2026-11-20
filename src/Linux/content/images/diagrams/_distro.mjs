// Shared by the pictures of the parts "Distributions and packages" and "Tools": neutral family badges that can be
// written right to left, servers (repositories), packages, files, computers and command strips, and the words for them.
// make.mjs skips this file (it starts with _).
import { C, FAMILY, FS, MONO, TERM, esc, file, label, textWidth } from "./style.mjs";

export const words = {
  debian: { en: "Debian family", sv: "Debian-familjen", de: "Debian-Familie", fr: "Famille Debian", es: "Familia Debian", pt: "Família Debian", ru: "Семейство Debian", zh: "Debian 家族", ja: "Debian ファミリー", ar: "عائلة Debian", hi: "Debian family" },
  arch: { en: "Arch family", sv: "Arch-familjen", de: "Arch-Familie", fr: "Famille Arch", es: "Familia Arch", pt: "Família Arch", ru: "Семейство Arch", zh: "Arch 家族", ja: "Arch ファミリー", ar: "عائلة Arch", hi: "Arch family" },
  redhat: { en: "Red Hat family", sv: "Red Hat-familjen", de: "Red-Hat-Familie", fr: "Famille Red Hat", es: "Familia Red Hat", pt: "Família Red Hat", ru: "Семейство Red Hat", zh: "Red Hat 家族", ja: "Red Hat ファミリー", ar: "عائلة Red Hat", hi: "Red Hat family" },
};

/**
 * A family badge as style.mjs's familyBadge (the family's colour, white bold text – never a logo), but with the text in
 * the variant's language (right to left in Arabic) and as wide as the text. (x, y): the left end and the middle.
 */
export function famBadge(v, x, y, family, s, o = {}) {
  const size = o.size ?? FS;
  const w = o.w ?? Math.round(textWidth(s, size) + 28);
  const h = size + 12;
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${FAMILY[family] ?? C.muted}"/>` +
    label(v, x0 + w / 2, y, s, { size, weight: 700, color: "#ffffff", anchor: "middle", fit: w - 8 });
}
export const famBadgeWidth = (s, size = FS) => Math.round(textWidth(s, size) + 28);

/** A server (a repository): a rack of three units, w × h, its top left corner at (x, y). */
export function server(x, y, w, h, o = {}) {
  const stroke = o.stroke ?? "#6b7480", fill = o.fill ?? "#eef1f5";
  const u = h / 3;
  let s = "";
  for (let i = 0; i < 3; i++) {
    const uy = y + i * u;
    s += `<rect x="${x}" y="${uy + 1}" width="${w}" height="${u - 2}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    s += `<circle cx="${x + 9}" cy="${uy + u / 2}" r="2.6" fill="${o.led ?? C.good}"/>`;
    s += `<line x1="${x + w * 0.45}" y1="${uy + u / 2}" x2="${x + w - 8}" y2="${uy + u / 2}" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  return s;
}

/** A computer (a monitor on a stand), w × h for the screen, its top left corner at (x, y). */
export function computer(x, y, w, h, inside = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${TERM.bg}" stroke="#30363d" stroke-width="2"/>` + inside +
    `<path d="M${x + w / 2 - 10},${y + h} l-5,10 h30 l-5,-10 z" fill="#8a93a3"/>` +
    `<rect x="${x + w / 2 - 22}" y="${y + h + 9}" width="44" height="4" rx="2" fill="#8a93a3"/>`;
}

/** A package (a parcel: a box with a band), s × s, its top left corner at (x, y). */
export function parcel(x, y, s = 22, o = {}) {
  const fill = o.fill ?? "#e9c98f", stroke = o.stroke ?? "#a57a32";
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>` +
    `<path d="M${x},${y + s * 0.32} H${x + s} M${x + s / 2},${y} V${y + s * 0.32}" stroke="${stroke}" stroke-width="1.3"/>`;
}

/**
 * A package chip: a parcel and a mono name on a white rounded box, (x, y) its left end and middle. Returns the svg and
 * its width. o.style: "accent" / "accent2" / "muted" / "bad"; o.w a fixed width.
 */
export function pkg(x, y, name, o = {}) {
  const h = o.h ?? 36;
  const w = o.w ?? Math.round(textWidth(name, FS, true) + 50);
  const [fill, stroke, ink] = {
    plain: ["#ffffff", C.boxStroke, C.ink],
    accent: [C.accentSoft, C.accent, C.ink],
    accent2: [C.accent2Soft, C.accent2, C.ink],
    good: [C.ySoft, C.good, C.ink],
    bad: [C.xSoft, C.bad, C.ink],
    muted: [C.card, C.boxStroke, C.muted],
  }[o.style ?? "plain"];
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return {
    svg: `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${o.style && o.style !== "plain" && o.style !== "muted" ? 2 : 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>` +
      parcel(x0 + 9, y - 11, 22, o.style === "muted" ? { fill: "#eceff3", stroke: C.line } : {}) +
      `<text x="${x0 + 40}" y="${y}" font-size="${FS}" font-weight="600" fill="${ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre" data-fit="${w - 46}">${esc(name)}</text>`,
    w,
    x: x0,
  };
}

/** A file chip: a file symbol and a mono name on a white box, (x, y) its left end and middle. */
export function fileChip(x, y, name, o = {}) {
  const h = o.h ?? 36;
  const w = o.w ?? Math.round(textWidth(name, o.size ?? FS, true) + 46);
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  const [fill, stroke] = o.style === "accent" ? [C.accentSoft, C.accent] : o.style === "accent2" ? [C.accent2Soft, C.accent2] : o.style === "muted" ? [C.card, C.boxStroke] : ["#ffffff", C.boxStroke];
  return {
    svg: `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${o.style === "accent" || o.style === "accent2" ? 2 : 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>` +
      file(x0 + 10, y - 10, o.style === "muted" ? { stroke: C.line, fill: C.card } : {}) +
      `<text x="${x0 + 36}" y="${y}" font-size="${o.size ?? FS}" font-weight="600" fill="${o.style === "muted" ? C.muted : C.ink}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre" data-fit="${w - 40}"${o.strike ? ` text-decoration="line-through"` : ""}>${esc(name)}</text>`,
    w,
    x: x0,
  };
}

/** A command on a dark strip (the terminal's colours), (x, y) its left end and middle; w from the text unless given. */
export function cmd(x, y, s, o = {}) {
  const size = o.size ?? FS;
  const w = o.w ?? Math.round(textWidth(s, size, true) + 24);
  const h = o.h ?? 38;
  const x0 = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return {
    svg: `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${TERM.bg}"/>` +
      `<text x="${x0 + 12}" y="${y}" font-size="${size}" font-weight="500" fill="${o.color ?? TERM.text}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre" data-fit="${w - 20}">${esc(s)}</text>`,
    w,
    x: x0,
  };
}

/** A check mark or a cross in a circle at (x, y). */
export function verdict(x, y, ok, r = 14) {
  const color = ok ? C.good : C.bad;
  const mark = ok
    ? `<path d="M${x - r * 0.45},${y + r * 0.02} l${r * 0.32},${r * 0.34} l${r * 0.6},${-r * 0.66}" fill="none" stroke="#ffffff" stroke-width="${r * 0.22}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M${x - r * 0.38},${y - r * 0.38} l${r * 0.76},${r * 0.76} M${x + r * 0.38},${y - r * 0.38} l${-r * 0.76},${r * 0.76}" stroke="#ffffff" stroke-width="${r * 0.22}" stroke-linecap="round"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>` + mark;
}

/** A padlock (signed, sandboxed) with its top left corner at (x, y), about 16 × 20. */
export function lock(x, y, color = C.ink) {
  return `<path d="M${x + 4},${y + 9} v-3 a4,4 0 0 1 8,0 v3" fill="none" stroke="${color}" stroke-width="2"/>` +
    `<rect x="${x}" y="${y + 9}" width="16" height="11" rx="2" fill="${color}"/>`;
}
