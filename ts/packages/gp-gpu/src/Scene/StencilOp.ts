/** What a stencil test does to the stored value (GL_KEEP, GL_REPLACE …). */
export enum StencilOp {
  Keep,
  Zero,
  Replace,
  Increment,
  IncrementWrap,
  Decrement,
  DecrementWrap,
  Invert,
}
