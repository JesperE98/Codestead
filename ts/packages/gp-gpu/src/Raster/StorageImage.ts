import { clamp, roundEven, toByte } from "../internal/dotnet.js";
import { Image } from "../Textures/Image.js";

/**
 * A storage image a compute shader writes and reads (GLSL image2D, a Vulkan storage image, an HLSL RWTexture2D): RGBA
 * floats, row 0 first (the texture's v = 0).
 */
export class StorageImage {
  readonly data: number[];

  constructor(readonly width: number, readonly height: number, data: number[] | null = null) {
    this.data = data ?? new Array<number>(width * height * 4).fill(0);
  }

  /** The image as a texture image (floats, and bytes clamped to 0 … 1). */
  toImage(): Image {
    const bytes = new Uint8Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) bytes[i] = toByte(roundEven(clamp(Number.isNaN(this.data[i]!) ? 0 : this.data[i]!, 0, 1) * 255));
    return new Image(this.width, this.height, 4, bytes, this.data.slice());
  }

  /** A texture image's texels as a storage image (its floats, else its bytes / 255). */
  static from(image: Image | null, width: number, height: number): StorageImage {
    if (image === null || image.width !== width || image.height !== height) return new StorageImage(Math.max(1, width), Math.max(1, height));
    const f = image.floats;
    const data = f !== null && f.length === width * height * 4 ? f.slice() : Array.from(image.rgba, (b) => b / 255.0);
    return new StorageImage(width, height, data);
  }
}
