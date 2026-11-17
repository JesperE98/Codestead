/**
 * An off-screen render target (a framebuffer object, a Vulkan image rendered to, a D3D12 render target texture): its
 * size (0 = the window's), its colour attachments (0 for a depth-only shadow map), whether it has depth and stencil,
 * multisampling, and whether its colour is stored as floating point (GL_RGBA16F …, not clamped to 0–1).
 * `depthOf`: another target whose depth (and stencil) buffer this one uses too – one depth texture attached to two
 * framebuffers. `channels`: the colour channels each attachment keeps (1 for an R8 target: a shader reads (r, 0, 0, 1)
 * from it), or null when all keep red, green and blue. (A C# record: the optional parameters are an object here.)
 */
export class RenderTarget {
  readonly width: number;
  readonly height: number;
  readonly colorAttachments: number;
  readonly depth: boolean;
  readonly stencil: boolean;
  readonly samples: number;
  readonly float: boolean;
  readonly layers: number;
  readonly depthOf: string | null;
  readonly channels: readonly number[] | null;

  constructor(readonly id: string, o: RenderTargetOptions = {}) {
    this.width = o.width ?? 0;
    this.height = o.height ?? 0;
    this.colorAttachments = o.colorAttachments ?? 1;
    this.depth = o.depth ?? true;
    this.stencil = o.stencil ?? true;
    this.samples = o.samples ?? 1;
    this.float = o.float ?? false;
    this.layers = o.layers ?? 1;
    this.depthOf = o.depthOf ?? null;
    this.channels = o.channels ?? null;
  }

  /** The record's `with { … }`. */
  with(changes: RenderTargetOptions & { id?: string }): RenderTarget {
    return new RenderTarget(changes.id ?? this.id, { ...this.options(), ...changes });
  }

  private options(): RenderTargetOptions {
    return {
      width: this.width, height: this.height, colorAttachments: this.colorAttachments, depth: this.depth, stencil: this.stencil,
      samples: this.samples, float: this.float, layers: this.layers, depthOf: this.depthOf, channels: this.channels,
    };
  }

  /** The record's ToString (the setup cache's key uses it). */
  toString(): string {
    return `RenderTarget { Id = ${this.id}, Width = ${this.width}, Height = ${this.height}, ColorAttachments = ${this.colorAttachments}, Depth = ${cap(this.depth)}, Stencil = ${cap(this.stencil)}, Samples = ${this.samples}, Float = ${cap(this.float)}, Layers = ${this.layers}, DepthOf = ${this.depthOf ?? ""}, Channels = ${this.channels ? "[" + this.channels.join(",") + "]" : ""} }`;
  }
}

const cap = (b: boolean): string => (b ? "True" : "False");

export interface RenderTargetOptions {
  width?: number;
  height?: number;
  colorAttachments?: number;
  depth?: boolean;
  stencil?: boolean;
  samples?: number;
  float?: boolean;
  layers?: number;
  depthOf?: string | null;
  channels?: readonly number[] | null;
}
