import { glyphFiles } from "../internal/resources.js";
import { sha256Hex } from "../internal/sha256.js";

/** One rendered glyph: the 8-bit coverage bitmap (rows top first) and its metrics in pixels (advance in 1/64). */
export interface Glyph {
  readonly width: number;
  readonly rows: number;
  readonly pitch: number;
  readonly left: number;
  readonly top: number;
  readonly advance: number;
  readonly bitmap: Uint8Array;
}

interface Font {
  readonly sha256: string;
  readonly sizes: Map<number, Map<number, Glyph>>;
}

interface GlyphJson {
  width: number;
  rows: number;
  pitch: number;
  left: number;
  top: number;
  advance: number;
  bitmap: string;
}

let fonts: Font[] | null = null;

function load(): Font[] {
  const list: Font[] = [];
  for (const text of glyphFiles) {
    const doc = JSON.parse(text) as { sha256?: string; sizes: Record<string, Record<string, GlyphJson>> };
    const sizes = new Map<number, Map<number, Glyph>>();
    for (const [size, glyphsJson] of Object.entries(doc.sizes)) {
      const glyphs = new Map<number, Glyph>();
      for (const [code, v] of Object.entries(glyphsJson)) {
        glyphs.set(Number.parseInt(code, 10), {
          width: v.width, rows: v.rows, pitch: v.pitch, left: v.left, top: v.top, advance: v.advance, bitmap: fromBase64(v.bitmap ?? ""),
        });
      }
      sizes.set(Number.parseInt(size, 10), glyphs);
    }
    list.push({ sha256: doc.sha256 ?? "", sizes });
  }
  return list;
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const all = (): Font[] => (fonts ??= load());

/**
 * The simulator's stand-in for FreeType: what FT_Load_Char(face, c, FT_LOAD_RENDER) gives for the fonts the course
 * ships, at the pixel sizes it uses – made with FreeType itself (content/textures/make_practice.py) and found by the
 * font file's SHA-256, so a font the simulator does not know is reported as one it cannot load.
 */
export const FreeTypeGlyphs = {
  /** The font id of a font file the simulator knows (its SHA-256), or null. */
  identify(fontFile: Uint8Array): string | null {
    const hash = sha256Hex(fontFile);
    return all().some((f) => f.sha256 === hash) ? hash : null;
  },

  /** The pixel sizes known for a font. */
  sizesOf(font: string): number[] {
    const f = all().find((x) => x.sha256 === font);
    return f ? [...f.sizes.keys()] : [];
  },

  /** A character at a pixel size, or null when the font, the size or the character is not in the table. */
  get(font: string, pixelSize: number, character: number): Glyph | null {
    return all().find((f) => f.sha256 === font)?.sizes.get(pixelSize)?.get(character) ?? null;
  },
};
