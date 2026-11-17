import { zlibInflate } from "../internal/inflate.js";
import { Image } from "./Image.js";

/**
 * Decodes PNG files (8 bits per channel: grey, grey + alpha, RGB, RGBA and palette, not interlaced) into RGBA – enough
 * for the course's images, with no dependency on a UI toolkit. (The C# code inflates with .NET's ZLibStream; this port
 * with its own decoder, internal/inflate.ts.)
 */
export const Png = {
  decode(data: Uint8Array): Image | null {
    try {
      return decodeOrThrow(data);
    } catch {
      // InvalidDataException, IndexOutOfRangeException, ArgumentException, OverflowException in C#.
      return null;
    }
  },
};

/** A byte that must be there (C# would throw IndexOutOfRangeException). */
function at(d: Uint8Array, i: number): number {
  const b = d[i];
  if (b === undefined) throw new RangeError("Index was outside the bounds of the array.");
  return b;
}

/** data[from..to] (C# throws ArgumentOutOfRangeException for a range outside the array). */
function slice(d: Uint8Array, from: number, to: number): Uint8Array {
  if (from < 0 || to < from || to > d.length) throw new RangeError("range out of bounds");
  return d.subarray(from, to);
}

function decodeOrThrow(data: Uint8Array): Image | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 8 || signature.some((b, i) => data[i] !== b)) return null;
  let pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  let palette: Uint8Array | null = null, transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= data.length) {
    const length = int(data, pos);
    const type = String.fromCharCode(...[0, 1, 2, 3].map((k) => { const c = data[pos + 4 + k]!; return c < 128 ? c : 63; }));
    const body = pos + 8;
    switch (type) {
      case "IHDR":
        width = int(data, body);
        height = int(data, body + 4);
        bitDepth = at(data, body + 8);
        colorType = at(data, body + 9);
        interlace = at(data, body + 12);
        break;
      case "PLTE":
        palette = slice(data, body, body + length);
        break;
      case "tRNS":
        transparency = slice(data, body, body + length);
        break;
      case "IDAT":
        idat.push(slice(data, body, body + length));
        break;
      case "IEND":
        pos = data.length;
        continue;
    }
    pos = body + length + 4;
  }
  if (bitDepth !== 8 || interlace !== 0 || width <= 0 || height <= 0) return null;
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (channels === 0) return null;
  const compressed = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of idat) {
    compressed.set(c, o);
    o += c.length;
  }
  const bytes = zlibInflate(compressed);
  const stride = width * channels;
  if (!Number.isSafeInteger(stride * height)) throw new RangeError("Arithmetic operation resulted in an overflow.");
  const pixels = new Uint8Array(stride * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = at(bytes, y * (stride + 1));
    const line = slice(bytes, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const outStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[outStart + x - channels]! : 0, b = previous[x]!, c = x >= channels ? previous[x - channels]! : 0;
      const v = line[x]! + (filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0);
      // (byte)v: the low 8 bits.
      pixels[outStart + x] = v & 0xff;
    }
    previous = pixels.slice(outStart, outStart + stride);
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r: number, g: number, b: number, al = 255;
    switch (colorType) {
      case 0:
        r = g = b = pixels[i]!;
        break;
      case 4:
        r = g = b = pixels[i * 2]!;
        al = pixels[i * 2 + 1]!;
        break;
      case 2:
        r = pixels[i * 3]!;
        g = pixels[i * 3 + 1]!;
        b = pixels[i * 3 + 2]!;
        break;
      case 3: {
        const p = pixels[i]!;
        if (palette === null) throw new Error("Object reference not set to an instance of an object.");
        r = at(palette, p * 3);
        g = at(palette, p * 3 + 1);
        b = at(palette, p * 3 + 2);
        if (transparency !== null && p < transparency.length) al = transparency[p]!;
        break;
      }
      default:
        r = pixels[i * 4]!;
        g = pixels[i * 4 + 1]!;
        b = pixels[i * 4 + 2]!;
        al = pixels[i * 4 + 3]!;
        break;
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = al;
  }
  return new Image(width, height, colorType === 4 || colorType === 6 || (colorType === 3 && transparency !== null) ? 4 : colorType === 0 ? 1 : 3, rgba);
}

/** A big-endian C# int (bit 31 makes it negative). */
function int(d: Uint8Array, i: number): number {
  return (at(d, i) << 24) | (at(d, i + 1) << 16) | (at(d, i + 2) << 8) | at(d, i + 3);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
