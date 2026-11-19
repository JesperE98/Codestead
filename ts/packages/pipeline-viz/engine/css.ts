// The visualizer's stylesheets, made fit for a scene in a shadow root of Codestead's window: scoped to the scene
// instead of the page, without the rules for small windows (a scene is laid out at its own size, see mount.ts), and in
// a light version for the light theme. Pure string work, tested in test/SceneCss.test.ts.

/** The rules of a stylesheet that depend on the window's width (@media with min-/max-width) are left out. */
export function stripViewportMedia(css: string): string {
  let out = "";
  let i = 0;
  const re = /@media[^{]*\((?:max|min)-width[^{]*\{/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    out += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < css.length && depth > 0; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
    }
    i = j;
    re.lastIndex = j;
  }
  return out + css.slice(i);
}

/** The page's root (:root, html, body) becomes the scene: the shadow root's host and the scene's own element (.rpv). */
export function scopeToScene(css: string): string {
  return css
    .replace(/html,\s*body\s*\{[^}]*\}/g, "")
    .replaceAll(":root", ":host")
    .replace(/(^|[\s,}>])body(?=[\s.[{:,>])/g, "$1.rpv");
}

/** An sRGB colour 0..255 with alpha 0..1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * The same hue and colourfulness with the lightness turned round (HSL's L → 1 − L): every channel moves by
 * 1 − max − min. Dark backgrounds become light, light text dark, and the neon accents darker shades of themselves.
 */
export function invertLightness(c: Rgba): Rgba {
  const shift = 255 - Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + shift)));
  return { r: ch(c.r), g: ch(c.g), b: ch(c.b), a: c.a };
}

function parseHex(hex: string): Rgba | null {
  const h = hex.slice(1);
  if (![3, 4, 6, 8].includes(h.length)) return null;
  const full = h.length <= 4 ? [...h].map((x) => x + x).join("") : h;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
}

function format(c: Rgba): string {
  return c.a >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(3)})`;
}

/** Every colour written in the stylesheet (#hex, rgb(), rgba()) with its lightness turned round. */
export function lightCss(css: string): string {
  return css
    .replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/g, (_m, r: string, g: string, b: string, a: string | undefined) =>
      format(invertLightness({ r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? 1 : Number(a) })),
    )
    .replace(/(^|[\s:,(])(#[0-9a-fA-F]{3,8})(?![\w-])/g, (m, before: string, hex: string) => {
      const c = parseHex(hex);
      return c ? before + format(invertLightness(c)) : m;
    });
}
