import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import type { BlendState } from "./BlendState.js";
import { CompareFunc } from "./CompareFunc.js";
import { CullMode } from "./CullMode.js";
import type { StencilState } from "./StencilState.js";
import { Topology } from "./Topology.js";

/** A draw's vertex data: one map per vertex, keyed by attribute location ("0") or semantic ("POSITION0"). */
export type VertexData = Map<string, ShaderValue>;

/** The init-only properties of a DrawCall (C#'s `new DrawCall { … }`; the two shaders are required). */
export interface DrawCallInit {
  vertexShader: ShaderProgram;
  fragmentShader: ShaderProgram;
  vertexEntry?: string;
  fragmentEntry?: string;
  hlsl?: boolean;
  matchByLocation?: boolean;
  vertices?: VertexData[];
  indices?: number[] | null;
  first?: number;
  count?: number;
  instances?: number;
  topology?: Topology;
  uniforms?: (time: number) => Map<string, ShaderValue>;
  cull?: CullMode;
  frontCcw?: boolean;
  wireframe?: boolean;
  depthTest?: boolean;
  depthFunc?: CompareFunc;
  depthWrite?: boolean;
  stencil?: StencilState | null;
  blend?: BlendState | null;
  attachmentBlends?: readonly (BlendState | null)[] | null;
  colorMask?: boolean[];
  target?: string | null;
  pointSize?: number;
  programPointSize?: boolean;
  geometryShader?: ShaderProgram | null;
  geometryEntry?: string;
  tessControlShader?: ShaderProgram | null;
  tessControlEntry?: string;
  tessEvalShader?: ShaderProgram | null;
  tessEvalEntry?: string;
  patchVertices?: number;
  instanceVertices?: VertexData[] | null;
  instanceDivisor?: number;
  textures?: ((name: string, u: number, v: number) => number[]) | null;
  cubeTextures?: ((name: string, x: number, y: number, z: number) => number[] | null) | null;
  cubeTexturesLod?: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null;
  textureImages?: ((name: string) => Image | null) | null;
}

/**
 * One draw call as the simulated GPU runs it: the shaders, the vertex data (one map per vertex, keyed by attribute
 * location "0", "1" … for GLSL or by semantic "POSITION0", "COLOR0" … for HLSL), the indices, the uniforms at a point in
 * time and the fixed-function state.
 */
export class DrawCall {
  readonly vertexShader: ShaderProgram;
  readonly fragmentShader: ShaderProgram;
  readonly vertexEntry: string;
  readonly fragmentEntry: string;
  /** HLSL shaders (entry points with semantics) rather than GLSL (main with in/out globals). */
  readonly hlsl: boolean;
  /** Vulkan GLSL: varyings are matched by location, gl_VertexIndex is used. */
  readonly matchByLocation: boolean;
  readonly vertices: VertexData[];
  /** null: draw vertices first … first + count - 1 in order. */
  readonly indices: number[] | null;
  readonly first: number;
  readonly count: number;
  readonly instances: number;
  readonly topology: Topology;
  /** Uniform values at a time in seconds: names of globals, or "instance.field" for blocks. */
  readonly uniforms: (time: number) => Map<string, ShaderValue>;
  readonly cull: CullMode;
  /** Counter-clockwise triangles are front faces (OpenGL's default; DirectX: FrontCounterClockwise). */
  readonly frontCcw: boolean;
  readonly wireframe: boolean;
  readonly depthTest: boolean;
  readonly depthFunc: CompareFunc;
  /** The depth test writes the depth of the fragments that pass (glDepthMask(GL_TRUE)). */
  readonly depthWrite: boolean;
  /** The stencil test, or null when it is off. */
  readonly stencil: StencilState | null;
  /** Blending, or null when it is off. */
  readonly blend: BlendState | null;
  /**
   * Blending per colour attachment when they differ (glBlendFunci, D3D12's IndependentBlendEnable): attachment i blends
   * with element i (null: off); attachments past the list use `blend`. Null: all use blend.
   */
  readonly attachmentBlends: readonly (BlendState | null)[] | null;
  /** The colour channels written (glColorMask): R, G, B, A. */
  readonly colorMask: boolean[];
  /** The render target drawn into (Scene.targets), or null for the window. */
  readonly target: string | null;
  /** The size of points in pixels (glPointSize) unless the vertex shader writes gl_PointSize. */
  readonly pointSize: number;
  /** The vertex shader may set gl_PointSize (GL_PROGRAM_POINT_SIZE; always in Vulkan). */
  readonly programPointSize: boolean;
  /** A geometry shader between the vertex and the fragment shader, or null. */
  readonly geometryShader: ShaderProgram | null;
  readonly geometryEntry: string;
  /**
   * The tessellation stages, or null: the control shader (GLSL tessellation control, HLSL hull shader – its entry point
   * runs once per output control point, its patch constant function once per patch) and the evaluation shader (GLSL
   * tessellation evaluation, HLSL domain shader) that runs once per vertex the tessellator makes.
   */
  readonly tessControlShader: ShaderProgram | null;
  readonly tessControlEntry: string;
  readonly tessEvalShader: ShaderProgram | null;
  readonly tessEvalEntry: string;
  /** The control points per patch (glPatchParameteri(GL_PATCH_VERTICES, n), patchControlPoints, the D3D12 patch list's N). */
  readonly patchVertices: number;
  /**
   * Per-instance attributes (glVertexAttribDivisor, VK_VERTEX_INPUT_RATE_INSTANCE, D3D12 per-instance data): the values
   * for instance i are instanceVertices[i / divisor], keyed like `vertices`.
   */
  readonly instanceVertices: VertexData[] | null;
  readonly instanceDivisor: number;
  /** Textures for texture()/Sample(): (name, u, v) → RGBA. */
  readonly textures: ((name: string, u: number, v: number) => number[]) | null;
  /** Cube maps: (name, direction x, y, z) → RGBA, or null when the name is not a cube map. */
  readonly cubeTextures: ((name: string, x: number, y: number, z: number) => number[] | null) | null;
  /** Cube maps with mip levels read at a level (textureLod, SampleLevel): (name, direction, lod) → RGBA, or null. */
  readonly cubeTexturesLod: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null;
  /** The image of the texture a sampler reads, for its size in texels (textureSize, texelFetch), or null. */
  readonly textureImages: ((name: string) => Image | null) | null;

  constructor(o: DrawCallInit) {
    this.vertexShader = o.vertexShader;
    this.fragmentShader = o.fragmentShader;
    this.vertexEntry = o.vertexEntry ?? "main";
    this.fragmentEntry = o.fragmentEntry ?? "main";
    this.hlsl = o.hlsl ?? false;
    this.matchByLocation = o.matchByLocation ?? false;
    this.vertices = o.vertices ?? [];
    this.indices = o.indices ?? null;
    this.first = o.first ?? 0;
    this.count = o.count ?? 0;
    this.instances = o.instances ?? 1;
    this.topology = o.topology ?? Topology.Triangles;
    this.uniforms = o.uniforms ?? (() => new Map());
    this.cull = o.cull ?? CullMode.None;
    this.frontCcw = o.frontCcw ?? true;
    this.wireframe = o.wireframe ?? false;
    this.depthTest = o.depthTest ?? false;
    this.depthFunc = o.depthFunc ?? CompareFunc.Less;
    this.depthWrite = o.depthWrite ?? true;
    this.stencil = o.stencil ?? null;
    this.blend = o.blend ?? null;
    this.attachmentBlends = o.attachmentBlends ?? null;
    this.colorMask = o.colorMask ?? [true, true, true, true];
    this.target = o.target ?? null;
    this.pointSize = o.pointSize ?? 1;
    this.programPointSize = o.programPointSize ?? false;
    this.geometryShader = o.geometryShader ?? null;
    this.geometryEntry = o.geometryEntry ?? "main";
    this.tessControlShader = o.tessControlShader ?? null;
    this.tessControlEntry = o.tessControlEntry ?? "main";
    this.tessEvalShader = o.tessEvalShader ?? null;
    this.tessEvalEntry = o.tessEvalEntry ?? "main";
    this.patchVertices = o.patchVertices ?? 3;
    this.instanceVertices = o.instanceVertices ?? null;
    this.instanceDivisor = o.instanceDivisor ?? 1;
    this.textures = o.textures ?? null;
    this.cubeTextures = o.cubeTextures ?? null;
    this.cubeTexturesLod = o.cubeTexturesLod ?? null;
    this.textureImages = o.textureImages ?? null;
  }

  /** A copy with some properties changed (C#'s object initializer on a copy; the readers build draws this way). */
  with(changes: Partial<DrawCallInit>): DrawCall {
    return new DrawCall({ ...(this as unknown as DrawCallInit), ...changes });
  }
}
