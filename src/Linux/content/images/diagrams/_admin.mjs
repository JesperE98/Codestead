// Shared by the pictures of the parts Administration, Network and Scripts: code taken from a chapter in the variant's
// language (so that a picture shows the same script or line as the text beside it), a dark command strip, small chips
// with code in them, a computer and the words several pictures use.
import { readFileSync } from "node:fs";
import { C, FS, MONO, esc, label, textWidth } from "./style.mjs";

/** The chapter's text in a language: src/Linux/content/chapters/<lang>/<chapter>.md. */
export function chapter(lang, name) {
  return readFileSync(new URL(`../../chapters/${lang}/${name}.md`, import.meta.url), "utf8");
}

/** The lines of the first fenced block of a chapter (in v's language) that contains every one of `needles`. */
export function chapterBlock(v, name, needles) {
  const blocks = [...chapter(v.lang, name).matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].map((m) => m[1].replace(/\n$/, ""));
  const found = blocks.find((b) => needles.every((n) => b.includes(n)));
  if (found === undefined) throw new Error(`${v.lang}/${name}.md has no block with ${JSON.stringify(needles)}`);
  return found.split("\n");
}

/** The first line of a fenced block in a chapter (in v's language) that matches `re`. */
export function chapterLine(v, name, re) {
  const blocks = [...chapter(v.lang, name).matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].flatMap((m) => m[1].split("\n"));
  const found = blocks.find((l) => re.test(l));
  if (found === undefined) throw new Error(`${v.lang}/${name}.md has no line like ${re}`);
  return found;
}

export const DARK = "#0f1318";
export const DARK_TEXT = "#e6edf3";

/** A dark strip with a command in it, as the terminal shows it; (x, y) is its left middle. Returns { svg, w }. */
export function strip(x, y, cmd, o = {}) {
  const w = o.w ?? textWidth(cmd, FS, true) + 28;
  const h = o.h ?? 42;
  const x0 = o.anchor === "end" ? x - w : o.anchor === "middle" ? x - w / 2 : x;
  return {
    w,
    svg: `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${DARK}"/>` +
      `<text x="${x0 + 14}" y="${y}" font-size="${FS}" font-weight="500" fill="${o.color ?? DARK_TEXT}" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre" data-fit="${w - 20}">${esc(cmd)}</text>`,
  };
}

/** The width of a chip with code `s` in it. */
export const chipWidth = (s, size = FS) => textWidth(s, size, true) + 24;

/**
 * A chip: code on a small rounded box, (x, y) its left middle. Styles: plain (white), accent, accent2, x, y, z (the soft
 * fill and the colour's edge), muted (grey and dashed), grey, gone (struck through). Returns the SVG.
 */
export function chip(x, y, s, o = {}) {
  const size = o.size ?? FS;
  const w = o.w ?? chipWidth(s, size);
  const h = o.h ?? 36;
  const styles = {
    plain: ["#ffffff", C.boxStroke, C.ink, ""],
    accent: [C.accentSoft, C.accent, C.ink, ""],
    accent2: [C.accent2Soft, C.accent2, C.ink, ""],
    x: [C.xSoft, C.x, C.ink, ""],
    y: [C.ySoft, C.y, C.ink, ""],
    z: [C.zSoft, C.z, C.ink, ""],
    muted: [C.card, C.line, C.muted, ` stroke-dasharray="5 4"`],
    grey: [C.card, C.boxStroke, C.muted, ""],
    gone: [C.card, C.line, C.line, ` stroke-dasharray="5 4"`],
  };
  const [fill, stroke, ink, dash] = styles[o.style ?? "plain"];
  const x0 = o.anchor === "end" ? x - w : o.anchor === "middle" ? x - w / 2 : x;
  let svg = `<rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${o.fill ?? fill}" stroke="${o.stroke ?? stroke}" stroke-width="${o.strokeWidth ?? 1.5}"${dash}/>`;
  svg += `<text x="${x0 + w / 2}" y="${y}" font-size="${size}" font-weight="${o.weight ?? 600}" fill="${o.color ?? ink}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre"${o.style === "gone" ? ` text-decoration="line-through"` : ""}>${esc(s)}</text>`;
  return svg;
}

/**
 * Chips in rows from x0 to x1 (from x1 to x0 when rtl), starting with their middles at y; a row that is full goes on
 * below. items: [{ s, style? }]. Returns { svg, height, places: [{ x, y, w }] }.
 */
export function flow(items, x0, x1, y, o = {}) {
  const gap = o.gap ?? 10, row = o.row ?? 46;
  let svg = "", at = 0, yy = y;
  const places = [];
  for (const it of items) {
    const w = chipWidth(it.s);
    if (at > 0 && at + w > x1 - x0) {
      at = 0;
      yy += row;
    }
    const x = o.rtl ? x1 - at - w : x0 + at;
    svg += chip(x, yy, it.s, { style: it.style });
    places.push({ x, y: yy, w });
    at += w + gap;
  }
  return { svg, height: yy - y + row, places };
}

/**
 * A computer: a screen with its name (code) on it and a word under it, (x, y) the screen's top left, w wide. `color`
 * edges the screen (the one the picture is about).
 */
export function computer(v, x, y, w, name, word, o = {}) {
  const h = o.h ?? 64;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${DARK}" stroke="${o.color ?? "#30363d"}" stroke-width="${o.color ? 3 : 2}"/>`;
  s += `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${FS}" font-weight="600" fill="${DARK_TEXT}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${esc(name)}</text>`;
  s += `<path d="M${x + w / 2 - 12},${y + h} l-5,10 h34 l-5,-10 z" fill="#8a93a3"/>`;
  s += `<rect x="${x + w / 2 - 26}" y="${y + h + 9}" width="52" height="5" rx="2" fill="#8a93a3"/>`;
  if (word) s += label(v, x + w / 2, y + h + 34, word, { anchor: "middle", color: C.muted, weight: 600, fit: o.fit });
  return s;
}

/** Words several of the part's pictures use. */
export const words = {
  yourComputer: { en: "your computer", sv: "din dator", de: "dein Computer", fr: "votre ordinateur", es: "tu ordenador", pt: "o seu computador", ru: "ваш компьютер", zh: "你的电脑", ja: "あなたのコンピューター", ar: "حاسوبك", hi: "आपका computer" },
  server: { en: "the server", sv: "servern", de: "der Server", fr: "le serveur", es: "el servidor", pt: "o servidor", ru: "сервер", zh: "服务器", ja: "サーバー", ar: "الخادم", hi: "server" },
};
