import { CompareFunc } from "./CompareFunc.js";
import { StencilOp } from "./StencilOp.js";

/** The stencil test: (Ref &amp; ReadMask) Func (stored &amp; ReadMask), and what happens to the stored value. (A C# record.) */
export class StencilState {
  constructor(
    readonly func: CompareFunc = CompareFunc.Always,
    readonly ref: number = 0,
    readonly readMask: number = 0xff,
    readonly writeMask: number = 0xff,
    readonly stencilFail: StencilOp = StencilOp.Keep,
    readonly depthFail: StencilOp = StencilOp.Keep,
    readonly pass: StencilOp = StencilOp.Keep,
  ) {}

  /** The record's `with { … }`. */
  with(changes: Partial<StencilState>): StencilState {
    const c = { ...this, ...changes };
    return new StencilState(c.func, c.ref, c.readMask, c.writeMask, c.stencilFail, c.depthFail, c.pass);
  }

  equals(o: StencilState | null | undefined): boolean {
    return !!o && o.func === this.func && o.ref === this.ref && o.readMask === this.readMask && o.writeMask === this.writeMask
      && o.stencilFail === this.stencilFail && o.depthFail === this.depthFail && o.pass === this.pass;
  }

  toString(): string {
    return `StencilState { Func = ${CompareFunc[this.func]}, Ref = ${this.ref}, ReadMask = ${this.readMask}, WriteMask = ${this.writeMask}, StencilFail = ${StencilOp[this.stencilFail]}, DepthFail = ${StencilOp[this.depthFail]}, Pass = ${StencilOp[this.pass]} }`;
  }
}
