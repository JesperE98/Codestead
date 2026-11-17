// FrameOp.cs, ClearOp.cs and CopyOp.cs: what is done to the targets between draws.

/** Something done to the targets between draws, before draw number `beforeDraw` (or after the last). */
export abstract class FrameOp {
  constructor(readonly beforeDraw: number) {}
}

/**
 * Clearing a target (null = the window): the colour, the depth and/or the stencil value. `attachment`: only that colour
 * attachment (glClearBufferfv(GL_COLOR, i, …), ClearRenderTargetView of one of several targets); null: all of them.
 */
export class ClearOp extends FrameOp {
  constructor(
    beforeDraw: number,
    readonly target: string | null,
    readonly color: number[] | null,
    readonly depth: number | null,
    readonly stencil: number | null,
    readonly attachment: number | null = null,
  ) {
    super(beforeDraw);
  }

  with(changes: Partial<Omit<ClearOp, "with">>): ClearOp {
    const c = { ...this, ...changes };
    return new ClearOp(c.beforeDraw, c.target, c.color, c.depth, c.stencil, c.attachment);
  }
}

/**
 * Copying one target into another (glBlitFramebuffer, resolving a multisampled image); null = the window.
 * `color`: the colour is copied (GL_COLOR_BUFFER_BIT; a resolve). `depth`: the depth (and stencil) is copied
 * (GL_DEPTH_BUFFER_BIT: deferred shading's G-buffer depth into the window). `average`: a smaller copy is the average of
 * the pixels it covers (a mip level made from the one above: glGenerateMipmap, a linear blit), not the nearest pixel.
 */
export class CopyOp extends FrameOp {
  constructor(
    beforeDraw: number,
    readonly from: string | null,
    readonly to: string | null,
    readonly color: boolean = true,
    readonly depth: boolean = false,
    readonly average: boolean = false,
  ) {
    super(beforeDraw);
  }

  with(changes: Partial<Omit<CopyOp, "with">>): CopyOp {
    const c = { ...this, ...changes };
    return new CopyOp(c.beforeDraw, c.from, c.to, c.color, c.depth, c.average);
  }
}
