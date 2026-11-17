import { clamp, roundEven, toByte } from "../internal/dotnet.js";
import { Image } from "../Textures/Image.js";

/**
 * The memory a frame is drawn into: colour (RGBA as numbers), depth and stencil, with one or more samples per pixel
 * (multisampling). Rows are stored top row first, as they appear on the screen.
 */
export class Framebuffer {
  readonly samples: number;
  /** The colour attachments (several for multiple render targets: a G-buffer). */
  readonly colors: Float64Array[];
  readonly depth: Float64Array;
  readonly stencil: Int32Array;
  /** Sample positions inside a pixel (0–1), the standard 4× pattern for multisampling. */
  readonly pattern: readonly (readonly [number, number])[];

  /** The channels each colour attachment keeps (R8: 1); null: all four. */
  channels: readonly number[] | null = null;

  /** A depth attachment: without one (a ping-pong blur target) the depth test and depth writes do nothing. */
  hasDepth = true;

  /**
   * `isFloat`: floating-point colour (GL_RGBA16F …), not clamped to 0–1. `depthOf`: a framebuffer of the same size whose
   * depth and stencil this one uses (one depth texture attached to two framebuffers).
   */
  constructor(readonly width: number, readonly height: number, samples = 1, readonly float = false, attachments = 1, depthOf: Framebuffer | null = null) {
    this.samples = samples <= 1 ? 1 : samples >= 4 ? 4 : 2;
    this.colors = Array.from({ length: Math.max(0, attachments) }, () => new Float64Array(width * height * this.samples * 4));
    if (depthOf !== null && depthOf.width === width && depthOf.height === height && depthOf.samples === this.samples) {
      this.depth = depthOf.depth;
      this.stencil = depthOf.stencil;
    } else {
      this.depth = new Float64Array(width * height * this.samples).fill(1.0);
      this.stencil = new Int32Array(width * height * this.samples);
    }
    this.pattern = this.samples === 1 ? [[0.5, 0.5]] : this.samples === 2 ? [[0.75, 0.75], [0.25, 0.25]] : [[0.375, 0.125], [0.875, 0.375], [0.125, 0.625], [0.625, 0.875]];
  }

  get hasColor(): boolean {
    return this.colors.length > 0;
  }

  get color(): Float64Array {
    return this.colors[0]!;
  }

  clear(color: number[] | null, depth: number | null, stencil: number | null, attachment: number | null = null): void {
    if (color !== null) {
      const c = color.length >= 4 ? color : [...color, ...new Array<number>(4 - color.length).fill(0)];
      const buffers = attachment !== null ? this.colors.slice(attachment, attachment + 1) : this.colors;
      for (const buffer of buffers)
        for (let i = 0; i < buffer.length; i += 4) for (let k = 0; k < 4; k++) buffer[i + k] = this.float ? c[k]! : clamp(c[k]!, 0, 1);
    }
    if (depth !== null) this.depth.fill(clamp(depth, 0, 1));
    if (stencil !== null) this.stencil.fill(stencil & 0xff);
  }

  /** The colour of a pixel: the average of its samples (what a multisample resolve gives). */
  resolved(x: number, y: number, attachment = 0): number[] {
    const r = [0, 0, 0, 0];
    if (attachment >= this.colors.length) return r;
    const color = this.colors[attachment]!;
    const baseIndex = (y * this.width + x) * this.samples;
    for (let s = 0; s < this.samples; s++) for (let k = 0; k < 4; k++) r[k]! += color[(baseIndex + s) * 4 + k]!;
    for (let k = 0; k < 4; k++) r[k]! /= this.samples;
    return r;
  }

  /**
   * The colour as a texture image. `bottomUp`: OpenGL's texture row 0 is the bottom of what was drawn, Vulkan's and
   * Direct3D's is the top.
   */
  colorImage(bottomUp: boolean, attachment = 0): Image {
    const bytes = new Uint8Array(this.width * this.height * 4);
    const floats = this.float ? new Array<number>(this.width * this.height * 4).fill(0) : null;
    const kept = this.channels !== null && attachment < this.channels.length ? this.channels[attachment]! : 4;
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const c = this.resolved(x, y, attachment);
        // A format without green, blue or alpha reads them as 0, 0 and 1.
        if (kept < 4) for (let k = kept; k < 4; k++) c[k] = k === 3 ? 1 : 0;
        const row = bottomUp ? this.height - 1 - y : y;
        const i = (row * this.width + x) * 4;
        for (let k = 0; k < 4; k++) {
          bytes[i + k] = toByte(roundEven(clamp(Number.isNaN(c[k]!) ? 0 : c[k]!, 0, 1) * 255));
          if (floats !== null) floats[i + k] = c[k]!;
        }
      }
    // An 8-bit target is read back as 8-bit values, like a real one.
    return new Image(this.width, this.height, 4, bytes, floats ?? Array.from(bytes, (b) => b / 255.0));
  }

  /** The depth as a texture image (the depth in every channel, alpha 1), for shadow maps and depth views. */
  depthImage(bottomUp: boolean): Image {
    const bytes = new Uint8Array(this.width * this.height * 4);
    const floats = new Array<number>(this.width * this.height * 4).fill(0);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const d = this.depth[(y * this.width + x) * this.samples]!;
        const row = bottomUp ? this.height - 1 - y : y;
        const i = (row * this.width + x) * 4;
        for (let k = 0; k < 3; k++) {
          floats[i + k] = d;
          bytes[i + k] = toByte(roundEven(d * 255));
        }
        floats[i + 3] = 1;
        bytes[i + 3] = 255;
      }
    return new Image(this.width, this.height, 4, bytes, floats);
  }

  /**
   * A smaller copy of another framebuffer's colour: each pixel the average of the pixels it covers there (a mip level
   * made from the level above).
   */
  private averageFrom(other: Framebuffer): void {
    for (let a = 0; a < this.colors.length; a++)
      for (let y = 0; y < this.height; y++) {
        const y0 = Math.trunc((y * other.height) / this.height), y1 = Math.max(y0 + 1, Math.trunc(((y + 1) * other.height) / this.height));
        for (let x = 0; x < this.width; x++) {
          const x0 = Math.trunc((x * other.width) / this.width), x1 = Math.max(x0 + 1, Math.trunc(((x + 1) * other.width) / this.width));
          const sum = [0, 0, 0, 0];
          let count = 0;
          for (let sy = y0; sy < y1 && sy < other.height; sy++)
            for (let sx = x0; sx < x1 && sx < other.width; sx++) {
              const c = other.resolved(sx, sy, a);
              for (let k = 0; k < 4; k++) sum[k]! += c[k]!;
              count++;
            }
          for (let s = 0; s < this.samples; s++)
            for (let k = 0; k < 4; k++) {
              const v = count === 0 ? 0 : sum[k]! / count;
              this.colors[a]![((y * this.width + x) * this.samples + s) * 4 + k] = this.float ? v : clamp(v, 0, 1);
            }
        }
      }
  }

  /** Copies (and resolves or scales) another framebuffer's colour into this one, like glBlitFramebuffer. */
  copyFrom(other: Framebuffer, color = true, depth = false, average = false): void {
    if (average && color) {
      this.averageFrom(other);
      color = false;
    }
    if (depth)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const sx = Math.min(other.width - 1, Math.trunc((x * other.width) / this.width)), sy = Math.min(other.height - 1, Math.trunc((y * other.height) / this.height));
          const from = (sy * other.width + sx) * other.samples;
          for (let s = 0; s < this.samples; s++) {
            this.depth[(y * this.width + x) * this.samples + s] = other.depth[from]!;
            this.stencil[(y * this.width + x) * this.samples + s] = other.stencil[from]!;
          }
        }
    if (!color) return;
    for (let a = 0; a < this.colors.length; a++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const sx = Math.min(other.width - 1, Math.trunc((x * other.width) / this.width)), sy = Math.min(other.height - 1, Math.trunc((y * other.height) / this.height));
          const c = other.resolved(sx, sy, a);
          for (let s = 0; s < this.samples; s++)
            for (let k = 0; k < 4; k++) this.colors[a]![((y * this.width + x) * this.samples + s) * 4 + k] = this.float ? c[k]! : clamp(c[k]!, 0, 1);
        }
  }
}
