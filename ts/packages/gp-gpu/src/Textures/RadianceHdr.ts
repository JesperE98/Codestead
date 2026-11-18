import { clamp, roundEven, splitNoEmpty, toByte, tryParseInt } from "../internal/dotnet.js";
// libm: sin, cos, pow … as C#'s Math.Sin, Math.Pow … compute them on Linux (glibc), instead of V8's Math.* (see internal/libm.ts).
import * as libm from "../internal/libm.js";
import { Image } from "./Image.js";

/**
 * Radiance HDR images (.hdr, RGBE) as stb_image's stbi_loadf reads them: three floats per pixel, linear radiance that
 * may be far above 1.0 (an environment map for image based lighting). Flat and run-length encoded scanlines.
 */
export const RadianceHdr = {
  isHdr(bytes: Uint8Array): boolean {
    return bytes.length > 10 && bytes[0] === 35 && bytes[1] === 63 && (startsWith(bytes, "#?RADIANCE") || startsWith(bytes, "#?RGBE"));
  },

  /** The image (top row first), with its floats; null when the file is not a readable .hdr. */
  decode(bytes: Uint8Array): Image | null {
    if (!RadianceHdr.isHdr(bytes)) return null;
    let pos = 0;
    const line = (): string | null => {
      if (pos >= bytes.length) return null;
      const start = pos;
      while (pos < bytes.length && bytes[pos] !== 10) pos++;
      let s = "";
      for (let i = start; i < pos; i++) s += String.fromCharCode(bytes[i]! < 128 ? bytes[i]! : 63);
      pos++;
      return s;
    };
    // The header ends with an empty line; then the resolution line "-Y height +X width".
    for (let header = line(); header !== null && header.length > 0; header = line()) {
      // (the header's lines)
    }
    const parts = splitNoEmpty(line() ?? "", " ");
    const height = parts.length === 4 ? tryParseInt(parts[1]!) : null;
    const width = parts.length === 4 ? tryParseInt(parts[3]!) : null;
    if (parts.length !== 4 || parts[0] !== "-Y" || parts[2] !== "+X" || height === null || width === null || width <= 0 || height <= 0 || width * height > 64_000_000) return null;

    const rgbe = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      // A run-length encoded scanline starts with 2, 2 and the width in two bytes; anything else is flat pixels.
      const rle = width >= 8 && width < 32768 && pos + 4 <= bytes.length && bytes[pos] === 2 && bytes[pos + 1] === 2 && (bytes[pos + 2]! & 0x80) === 0
        && ((bytes[pos + 2]! << 8) | bytes[pos + 3]!) === width;
      if (!rle) {
        if (pos + width * 4 > bytes.length) return null;
        rgbe.set(bytes.subarray(pos, pos + width * 4), row);
        pos += width * 4;
        continue;
      }
      pos += 4;
      for (let channel = 0; channel < 4; channel++) {
        let x = 0;
        while (x < width) {
          if (pos >= bytes.length) return null;
          let count = bytes[pos++]!;
          if (count > 128) {
            count -= 128;
            if (pos >= bytes.length || x + count > width) return null;
            const value = bytes[pos++]!;
            for (let i = 0; i < count; i++) rgbe[row + x++ * 4 + channel] = value;
          } else {
            if (count === 0 || pos + count > bytes.length || x + count > width) return null;
            for (let i = 0; i < count; i++) rgbe[row + x++ * 4 + channel] = bytes[pos++]!;
          }
        }
      }
    }

    const floats = new Array<number>(width * height * 4);
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const e = rgbe[i * 4 + 3]!;
      const scale = e === 0 ? 0 : libm.pow(2, e - 136); // 2^(e - 128) / 256
      for (let k = 0; k < 3; k++) {
        const v = rgbe[i * 4 + k]! * scale;
        floats[i * 4 + k] = v;
        rgba[i * 4 + k] = toByte(roundEven(clamp(v, 0, 1) * 255));
      }
      floats[i * 4 + 3] = 1;
      rgba[i * 4 + 3] = 255;
    }
    return new Image(width, height, 3, rgba, floats);
  },
};

function startsWith(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[i] !== text.charCodeAt(i)) return false;
  return true;
}
