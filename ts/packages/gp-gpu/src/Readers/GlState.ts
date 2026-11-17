// GlState.cs: the OpenGL objects and state while the simulator walks the program (see GlReader). The nested classes of
// C#'s GlState are classes of this module.
import { BlendState } from "../Scene/BlendState.js";
import { CompareFunc } from "../Scene/CompareFunc.js";
import { StencilState } from "../Scene/StencilState.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import { Wrap } from "../Textures/Wrap.js";

export class ShaderObject {
  stage = "";
  source: string | null = null;
  compiled = false;
}

export class ProgramObject {
  shaders: string[] = [];
  linked = false;
  vertex: ShaderProgram | null = null;
  fragment: ShaderProgram | null = null;
  vertexFile: string | null = null;
  fragmentFile: string | null = null;
  /** Uniform name → a function of time giving its value. */
  uniforms = new Map<string, (time: number) => ShaderValue | null>();
  geometry: ShaderProgram | null = null;
  geometryFile: string | null = null;
  /** The tessellation control and evaluation shaders, if the program has them. */
  tessControl: ShaderProgram | null = null;
  tessEval: ShaderProgram | null = null;
  /** A compute program's shader (glDispatchCompute runs it). */
  compute: ShaderProgram | null = null;

  /** Every stage the program has (vertex, tessellation, geometry, fragment). */
  get allStages(): ShaderProgram[] {
    return [this.vertex, this.tessControl, this.tessEval, this.geometry, this.fragment].filter((s): s is ShaderProgram => s !== null);
  }

  /** glUniformBlockBinding: block name → binding point. */
  blockBindings = new Map<string, number>();
}

export class Attribute {
  buffer: string | null = null;
  size = 4;
  strideBytes = 0;
  offsetBytes = 0;
  enabled = false;
  /** glVertexAttribDivisor: 0 = per vertex, n = a new value every n instances. */
  divisor = 0;
  /**
   * The separate attribute format of OpenGL 4.3/4.5 (glVertexArrayAttribFormat, glVertexArrayAttribBinding): the
   * buffer binding the attribute reads, and its offset within a vertex.
   */
  bindingIndex: number | null = null;
  relativeOffset = 0;

  constructor(init?: Partial<Attribute>) {
    if (init) Object.assign(this, init);
  }
}

/** A vertex buffer binding point (glVertexArrayVertexBuffer / glBindVertexBuffer): buffer, offset, stride. */
export class BufferBinding {
  buffer: string | null = null;
  offsetBytes = 0;
  strideBytes = 0;
  divisor = 0;
}

export class VertexArray {
  /** Location → attribute (a Dictionary&lt;int, …&gt;: insertion order is C#'s enumeration order, nothing is removed). */
  attributes = new Map<number, Attribute>();
  elementBuffer: string | null = null;
  bindings = new Map<number, BufferBinding>();

  constructor(init?: { elementBuffer?: string | null }) {
    if (init?.elementBuffer !== undefined) this.elementBuffer = init.elementBuffer;
  }
}

export class TextureObject {
  image: Image | null = null;
  components = 4;
  wrapS = Wrap.Repeat;
  wrapT = Wrap.Repeat;
  /** OpenGL's default minification filter uses mipmaps: without glGenerateMipmap the texture is incomplete. */
  minFilter = "GL_NEAREST_MIPMAP_LINEAR";
  magFilter = "GL_LINEAR";
  mipmaps = false;
  border: number[] | null = null;
  /** An sRGB internal format (GL_SRGB, GL_SRGB_ALPHA …): sampling decodes to linear. */
  srgb = false;
  /** A cube map (GL_TEXTURE_CUBE_MAP): its six faces. */
  isCube = false;
  faces: (Image | null)[] = [null, null, null, null, null, null];
  /** Size and format from glTexImage2D with no data (a render target), and where it is attached. */
  width = 0;
  height = 0;
  float = false;
  isDepth = false;
  /** glTextureStorage2D's internal format (GL_RGB8, GL_SRGB8_ALPHA8 …): the format its data is stored in. */
  storageFormat: string | null = null;
  /** The colour channels a render target texture keeps (GL_R8 / GL_RED: 1, GL_RG…: 2). */
  channels = 4;
  samples = 1;
  /** The layers of a texture array (GL_TEXTURE_2D_ARRAY, glTexImage3D): a layered framebuffer draws into them. */
  layers = 1;
  framebuffer: string | null = null;
  attachment = 0;
  /**
   * Mip levels drawn into one by one (a pre-filtered environment map) or made from level 0 after drawing
   * (glGenerateMipmap on a captured cube map): the render targets "tex:name~level" hold them.
   */
  targetLevels = 1;

  constructor(init?: Partial<Omit<TextureObject, "complete">>) {
    if (init) Object.assign(this, init);
  }

  get complete(): boolean {
    return (this.image !== null || this.isCube || this.framebuffer !== null) && (this.mipmaps || !this.minFilter.includes("MIPMAP"));
  }
}

/** A framebuffer object: its colour textures by attachment, its depth (texture or renderbuffer). */
export class FramebufferObject {
  colors = new Map<number, TextureObject>();
  depth = false;
  stencil = false;
  samples = 1;
  width = 0;
  height = 0;
  /** Layers: a whole cube map attached with glFramebufferTexture is drawn into face by face (gl_Layer). */
  layers = 1;
  /**
   * The colour attachment changes between draws (glFramebufferTexture2D with a cube map's face or a mip level:
   * learnopengl's captureFBO): each draw goes to the texture, face and level attached then.
   */
  perTexture = false;
  /**
   * The framebuffer whose depth texture this one has attached as well (weighted blended OIT's transparent pass
   * tests against the opaque pass's depth): the two share one depth buffer.
   */
  depthOf: string | null = null;
  targetTexture: string | null = null;
  targetFace = -1;
  targetLevel = 0;
}

export class Renderbuffer {
  format = "";
  samples = 1;
  width = 0;
  height = 0;
}

/** The OpenGL objects and state while the simulator walks the program (see GlReader). */
export class GlState {
  readonly framebuffers = new Map<string, FramebufferObject>();
  readonly renderbuffers = new Map<string, Renderbuffer>();
  drawFramebuffer: string | null = null;
  readFramebuffer: string | null = null;
  currentRenderbuffer: string | null = null;

  /** Uniform buffers: binding point → (buffer, offset); writes into a buffer by byte offset. */
  readonly uniformBindings = new Map<number, { buffer: string; offset: number }>();
  /** C#'s SortedDictionary&lt;int, …&gt; per buffer: only looked up by offset, never enumerated, so a Map. */
  readonly bufferWrites = new Map<string, Map<number, ShaderValue>>();
  uniformBuffer: string | null = null;
  /** A variable holding a uniform block index → the block's name. */
  readonly blockIndices = new Map<string, string>();
  /** A variable holding a mapped buffer pointer (glMapBuffer) → the buffer. */
  readonly mapped = new Map<string, string>();
  copyReadBuffer: string | null = null;
  copyWriteBuffer: string | null = null;

  readonly textureObjects = new Map<string, TextureObject>();
  /** Texture unit → the texture bound to it. */
  readonly units = new Map<number, string>();
  /**
   * A unit has a binding per kind of texture: the 2D texture and the cube map bound to it (a sampler2D reads the
   * first, a samplerCube the second) – `units` is the one bound last.
   */
  readonly units2D = new Map<number, string>();
  readonly unitsCube = new Map<number, string>();
  activeUnit = 0;

  readonly shaderObjects = new Map<string, ShaderObject>();
  readonly programs = new Map<string, ProgramObject>();
  /** Buffer name → its data (numbers), or null while it has none. */
  readonly buffers = new Map<string, number[] | null>();
  readonly vertexArrays = new Map<string, VertexArray>();
  /** Variable that holds a uniform location → the uniform's name. */
  readonly locations = new Map<string, string>();

  currentProgram: string | null = null;
  currentVertexArray: string | null = null;
  arrayBuffer: string | null = null;
  clearColor: number[] = [0, 0, 0, 0];
  /** GL_UNPACK_ALIGNMENT: the rows of uploaded texture data start at multiples of it (glPixelStorei). */
  unpackAlignment = 4;
  clearColorSet = false;
  wireframe = false;
  /** glPatchParameteri(GL_PATCH_VERTICES, n): the control points of a patch. */
  patchVertices = 3;
  /** glBindImageTexture: image unit → the texture bound there (for compute shaders' image2D). */
  imageUnits = new Map<number, string>();
  cullFace = false;
  cullFaceMode = "GL_BACK";
  frontCcw = true;
  depthTest = false;
  depthFunc = CompareFunc.Less;
  depthMask = true;
  stencilTest = false;
  stencil = new StencilState();
  blend = false;
  blendState = new BlendState();
  /**
   * Draw buffers whose blending differs from `blendState` (glBlendFunci): buffer → its state; a buffer switched off
   * with glDisablei(GL_BLEND, i) has none.
   */
  bufferBlends = new Map<number, BlendState | null>();
  colorMask: boolean[] = [true, true, true, true];
  pointSize = 1;
  programPointSize = false;
}
