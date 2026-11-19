import { clamp, toInt } from "../internal/dotnet.js";

/** A rendered frame: BGRA pixels (top row first) and what went wrong while shading. */
export class Frame {
  constructor(readonly width: number, readonly height: number, readonly pixels: Uint8Array, readonly errors: readonly string[]) {}

  /** The colour at a pixel as RGBA in 0–1 (for tests and checks). */
  at(x: number, y: number): number[] {
    const i = (y * this.width + x) * 4;
    const p = this.pixels;
    return [p[i + 2]! / 255.0, p[i + 1]! / 255.0, p[i]! / 255.0, p[i + 3]! / 255.0];
  }

  /** The colour at a point given in 0–1 of the width and height (0, 0 = top left). */
  atRelative(x: number, y: number): number[] {
    return this.at(clamp(toInt(x * this.width), 0, this.width - 1), clamp(toInt(y * this.height), 0, this.height - 1));
  }
}
