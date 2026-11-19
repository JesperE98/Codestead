import { clamp, roundEven, toByte, toInt } from "../internal/dotnet.js";
// libm: sin, cos, pow … as C#'s Math.Sin, Math.Pow … compute them on Linux (glibc), instead of V8's Math.* (see internal/libm.ts).
import * as libm from "../internal/libm.js";
import { SrgbCurve } from "../Raster/SrgbCurve.js";
import { Image } from "./Image.js";
import type { SamplerState } from "./SamplerState.js";
import { Wrap } from "./Wrap.js";

/** The init-only properties of a Texture. */
export interface TextureInit {
  components?: number;
  srgb?: boolean;
  mipmapped?: boolean;
  mipLinear?: boolean;
}

const Empty = new Image(1, 1, 4, new Uint8Array([0, 0, 0, 255]));

const SrgbToLinear = Array.from({ length: 256 }, (_, i) => SrgbCurve.toLinear(i / 255.0));

/** Level 0 and the smaller levels of each image, made once (C#'s ConditionalWeakTable). */
const MipChains = new WeakMap<Image, Image[]>();

/**
 * A texture as the simulated GPU samples it: an image and a sampler state. Texture coordinate v = 0 is the first row of
 * the uploaded data (the top of the file, unless it was flipped when loaded – OpenGL programs flip it, because OpenGL
 * puts v = 0 at the bottom of an image).
 */
export class Texture {
  private readonly imageField: Image | null;
  private readonly source: (() => Image | null) | null;

  /** The colour channels the shader sees (3: alpha reads as 1). */
  readonly components: number;

  /**
   * An sRGB texture (GL_SRGB, VK_FORMAT_R8G8B8A8_SRGB, DXGI_FORMAT_R8G8B8A8_UNORM_SRGB): sampling returns the colours
   * decoded to linear values (alpha stays as stored).
   */
  readonly srgb: boolean;

  /**
   * The texture has mip levels (glGenerateMipmap with a *_MIPMAP_* minification filter; a Vulkan image whose levels
   * were blitted): a minified texture is read from the smaller levels, as a GPU does, instead of from level 0.
   */
  readonly mipmapped: boolean;

  /** Blend the two nearest levels (GL_LINEAR_MIPMAP_LINEAR, VK_SAMPLER_MIPMAP_MODE_LINEAR); else the nearest. */
  readonly mipLinear: boolean;

  /**
   * An image and its sampler, or (a function) a texture whose image is made while the frame renders (a render
   * target's colour or depth).
   */
  constructor(image: Image | (() => Image | null), readonly sampler: SamplerState, init: TextureInit = {}) {
    if (image instanceof Image) {
      this.imageField = image;
      this.source = null;
    } else {
      this.imageField = null;
      this.source = image;
    }
    this.components = init.components ?? 4;
    this.srgb = init.srgb ?? false;
    this.mipmapped = init.mipmapped ?? false;
    this.mipLinear = init.mipLinear ?? true;
  }

  /** The C# object initializer on a texture made before: the same image and sampler with other init-only properties. */
  with(init: TextureInit): Texture {
    return new Texture(this.imageField ?? this.source!, this.sampler, {
      components: init.components ?? this.components,
      srgb: init.srgb ?? this.srgb,
      mipmapped: init.mipmapped ?? this.mipmapped,
      mipLinear: init.mipLinear ?? this.mipLinear,
    });
  }

  get image(): Image {
    return this.imageField ?? this.source?.() ?? Empty;
  }

  /**
   * How the texture coordinates change from one pixel of the window to the next where the fragment being shaded reads
   * (du/dx, dv/dx, du/dy, dv/dy, in the program's own pixels), set by the shader runner around a texture() call: a GPU
   * picks the mip level from it. Null: level 0. (Thread-static in C#; JavaScript runs on one thread.)
   */
  static footprint: readonly [number, number, number, number] | null = null;

  /** Level 0 and the smaller levels (each the average of 2 × 2 texels of the one above), made once per image. */
  private levels(img: Image): Image[] {
    const known = MipChains.get(img);
    if (known !== undefined) return known;
    const list: Image[] = [img];
    const current = img;
    // Linear values (an sRGB texture's colours decoded first, as a GPU filters them), as floats.
    let values = new Array<number>(current.width * current.height * 4);
    for (let i = 0; i < current.width * current.height; i++) {
      const t = this.texel(current, i % current.width, Math.trunc(i / current.width), false);
      for (let k = 0; k < 4; k++) values[i * 4 + k] = t[k]!;
    }
    let w = current.width, h = current.height;
    while (w > 1 || h > 1) {
      const nw = Math.max(1, Math.trunc(w / 2)), nh = Math.max(1, Math.trunc(h / 2));
      const next = new Array<number>(nw * nh * 4);
      const bytes = new Uint8Array(nw * nh * 4);
      for (let y = 0; y < nh; y++)
        for (let x = 0; x < nw; x++)
          for (let k = 0; k < 4; k++) {
            let sum = 0;
            let n = 0;
            for (let dy = 0; dy < 2; dy++)
              for (let dx = 0; dx < 2; dx++) {
                const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy);
                sum += values[(sy * w + sx) * 4 + k]!;
                n++;
              }
            next[(y * nw + x) * 4 + k] = sum / n;
            bytes[(y * nw + x) * 4 + k] = toByte(roundEven(clamp(sum / n, 0, 1) * 255));
          }
      list.push(new Image(nw, nh, 4, bytes, next));
      [values, w, h] = [next, nw, nh];
    }
    MipChains.set(img, list);
    return list;
  }

  sample(u: number, v: number): number[] {
    const img = this.image;
    const f = Texture.footprint;
    if (this.mipmapped && f !== null && img.width * img.height > 1) {
      // The level of detail: log2 of how many texels one pixel covers (the longer of its two directions).
      const rx = Math.sqrt(sq(f[0] * img.width) + sq(f[1] * img.height)), ry = Math.sqrt(sq(f[2] * img.width) + sq(f[3] * img.height));
      let lod = libm.log2(Math.max(rx, ry));
      if (lod > 0 && !Number.isNaN(lod)) {
        const levels = this.levels(img);
        lod = Math.min(lod, levels.length - 1);
        if (!this.mipLinear) return this.sampleLevel(levels[toInt(roundEven(lod))]!, u, v);
        const lower = toInt(Math.floor(lod));
        const t = lod - lower;
        const a = this.sampleLevel(levels[lower]!, u, v);
        if (t <= 0 || lower + 1 >= levels.length) return a;
        const b = this.sampleLevel(levels[lower + 1]!, u, v);
        for (let k = 0; k < 4; k++) a[k]! += (b[k]! - a[k]!) * t;
        return a;
      }
    }
    return this.sampleLevel(img, u, v);
  }

  /** Bilinear (or nearest) filtering in one level; a smaller level holds linear values already. */
  private sampleLevel(img: Image, u: number, v: number): number[] {
    const w = img.width, h = img.height;
    const s = this.sampler;
    if (!s.linear) {
      const cs = coord(u * w - 0.5 + 0.5, w, s.wrapS), ct = coord(v * h, h, s.wrapT);
      return this.texel(img, cs.index, ct.index, cs.outside || ct.outside);
    }
    const x = u * w - 0.5, y = v * h - 0.5;
    const x0 = toInt(Math.floor(x)), y0 = toInt(Math.floor(y));
    const fx = x - x0, fy = y - y0;
    const r = [0, 0, 0, 0];
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const weight = (dx === 0 ? 1 - fx : fx) * (dy === 0 ? 1 - fy : fy);
        if (weight === 0) continue;
        const c1 = coord(x0 + dx + 0.5, w, s.wrapS), c2 = coord(y0 + dy + 0.5, h, s.wrapT);
        const t = this.texel(img, c1.index, c2.index, c1.outside || c2.outside);
        for (let k = 0; k < 4; k++) r[k]! += weight * t[k]!;
      }
    return r;
  }

  /** The texel at integer coordinates (texelFetch, Load). */
  fetch(x: number, y: number): number[] {
    const img = this.image;
    return this.texel(img, clamp(x, 0, img.width - 1), clamp(y, 0, img.height - 1), x < 0 || y < 0 || x >= img.width || y >= img.height);
  }

  private texel(img: Image, x: number, y: number, outside: boolean): number[] {
    if (outside) return this.sampler.border ?? [0, 0, 0, 0];
    const i = (y * img.width + x) * 4;
    const f = img.floats;
    if (f !== null) return [f[i]!, f[i + 1]!, f[i + 2]!, this.components === 4 ? f[i + 3]! : 1.0];
    const d = img.rgba;
    if (this.srgb) return [SrgbToLinear[d[i]!]!, SrgbToLinear[d[i + 1]!]!, SrgbToLinear[d[i + 2]!]!, this.components === 4 ? d[i + 3]! / 255.0 : 1.0];
    return [d[i]! / 255.0, d[i + 1]! / 255.0, d[i + 2]! / 255.0, this.components === 4 ? d[i + 3]! / 255.0 : 1.0];
  }
}

function sq(x: number): number {
  return x * x;
}

/** The texel index for a coordinate in texels, after wrapping; `outside` for the border colour. */
function coord(t: number, size: number, wrap: Wrap): { index: number; outside: boolean } {
  const i = toInt(Math.floor(t));
  switch (wrap) {
    case Wrap.Repeat:
      return { index: ((i % size) + size) % size, outside: false };
    case Wrap.MirroredRepeat: {
      const period = 2 * size;
      const m = ((i % period) + period) % period;
      return { index: m < size ? m : period - 1 - m, outside: false };
    }
    case Wrap.ClampToBorder:
      return { index: clamp(i, 0, size - 1), outside: i < 0 || i >= size };
    default:
      return { index: clamp(i, 0, size - 1), outside: false };
  }
}
