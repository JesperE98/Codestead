import { BlendFactor } from "./BlendFactor.js";
import { BlendOp } from "./BlendOp.js";

/** Blending of the fragment's colour (source) with the colour in the framebuffer (destination). (A C# record.) */
export class BlendState {
  constructor(
    readonly srcColor: BlendFactor = BlendFactor.One,
    readonly dstColor: BlendFactor = BlendFactor.Zero,
    readonly srcAlpha: BlendFactor = BlendFactor.One,
    readonly dstAlpha: BlendFactor = BlendFactor.Zero,
    readonly colorOp: BlendOp = BlendOp.Add,
    readonly alphaOp: BlendOp = BlendOp.Add,
    readonly constant: number[] | null = null,
  ) {}

  /** The record's `with { … }`. */
  with(changes: Partial<BlendState>): BlendState {
    const c = { ...this, ...changes };
    return new BlendState(c.srcColor, c.dstColor, c.srcAlpha, c.dstAlpha, c.colorOp, c.alphaOp, c.constant);
  }

  /** Record value equality (the constant compared by reference, as a C# record compares an array). */
  equals(o: BlendState | null | undefined): boolean {
    return !!o && o.srcColor === this.srcColor && o.dstColor === this.dstColor && o.srcAlpha === this.srcAlpha && o.dstAlpha === this.dstAlpha
      && o.colorOp === this.colorOp && o.alphaOp === this.alphaOp && o.constant === this.constant;
  }

  toString(): string {
    return `BlendState { SrcColor = ${BlendFactor[this.srcColor]}, DstColor = ${BlendFactor[this.dstColor]}, SrcAlpha = ${BlendFactor[this.srcAlpha]}, DstAlpha = ${BlendFactor[this.dstAlpha]}, ColorOp = ${BlendOp[this.colorOp]}, AlphaOp = ${BlendOp[this.alphaOp]}, Constant = ${this.constant ? "System.Double[]" : ""} }`;
  }
}
