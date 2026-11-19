// Rasterizer.Stages.cs and Rasterizer.Tessellation.cs: the programmable stages (Rasterizer's nested class Stages in
// C#) – the vertex shader per vertex and the fragment shader per pixel, for GLSL (main with in/out globals and
// gl_Position) and HLSL (entry points with semantics); the geometry shader; the tessellation stages.
import { clamp, toInt, tryParseInt } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import type { DrawCall, VertexData } from "../Scene/DrawCall.js";
import { Topology } from "../Scene/Topology.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { sequenceEqual, ShaderRunner, type Footprint } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import { ShadedVertex } from "./ShadedVertex.js";
import { Tessellator } from "./Tessellator.js";

/** The texture reads of a draw's shaders: texture() and friends, cube maps, textureSize(). (Rasterizer.Parallel.cs) */
export class TextureReads {
  constructor(
    readonly sample: ((name: string, u: number, v: number) => number[]) | null,
    readonly sampleCube: ((name: string, x: number, y: number, z: number) => number[] | null) | null,
    readonly size: ((name: string) => Image | null) | null,
    readonly sampleCubeLod: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null = null,
  ) {}

  static of(draw: DrawCall): TextureReads {
    return new TextureReads(draw.textures, draw.cubeTextures, draw.textureImages, draw.cubeTexturesLod);
  }
}

/** A point of a primitive: (what Rasterizer.Fragments gives the fragment stage) the derivatives of its weights. */
export type Derivatives = readonly [number, number, number, number, number, number];

/** A control point after the control stage, and what the patch as a whole carries (its levels, patch outputs). */
interface Patch {
  readonly points: ShadedVertex[];
  readonly structs: ShaderValue[];
  readonly outer: number[];
  readonly inner: number[];
  readonly patchValues: Map<string, ShaderValue>;
  readonly constants: ShaderValue | null;
}

const isPosition = (semantic: string | null): boolean => semantic !== null && semantic.toUpperCase() === "SV_POSITION";
const isFrontFace = (semantic: string | null): boolean => semantic !== null && semantic.toUpperCase() === "SV_ISFRONTFACE";
const eqIgnoreCase = (a: string | null, b: string): boolean => a !== null && a.toUpperCase() === b.toUpperCase();

/** POSITION → POSITION0, TEXCOORD1 stays. */
export function semanticKey(s: string): string {
  const last = s[s.length - 1]!;
  return last >= "0" && last <= "9" ? s.toUpperCase() : s.toUpperCase() + "0";
}

function sized(type: string, v: ShaderValue | null): ShaderValue {
  const n = Math.max(1, ShaderRunner.componentCount(type));
  // Missing components of a vertex attribute are filled in as (0, 0, 0, 1).
  return ShaderValue.vecOf((v ?? ShaderValue.vec()).padded(n));
}

function fromSemantic(type: string, semantic: string | null, data: VertexData, index: number, instance: number): ShaderValue {
  if (semantic === null) return sized(type, null);
  if (eqIgnoreCase(semantic, "SV_VertexID")) return ShaderValue.scalar(index);
  if (eqIgnoreCase(semantic, "SV_InstanceID")) return ShaderValue.scalar(instance);
  return sized(type, data.get(semanticKey(semantic)) ?? null);
}

/** ToDictionary of fields (a duplicate key throws, as in C#). */
function fieldMap<T>(items: readonly T[], key: (t: T) => string, value: (t: T) => ShaderValue): Map<string, ShaderValue> {
  const map = new Map<string, ShaderValue>();
  for (const item of items) {
    const k = key(item);
    if (map.has(k)) throw new Error(`An item with the same key has already been added. Key: ${k}`);
    map.set(k, value(item));
  }
  return map;
}

/** Sets a uniform by its name as the program uses it (see Stages.setUniform). */
export function setUniform(runner: ShaderRunner, key: string, value: ShaderValue): void {
  const parts = matchesAll(/(\w+)|\[(\d+)\]/g, key).map((m) => (m[1] !== undefined ? m[1] : "#" + m[2]));
  if (parts.length === 0) return;
  const root = runner.globals.get(parts[0]!);
  if (root !== undefined) {
    if (parts.length === 1) {
      assignInto(runner.globals, parts[0]!, value);
      return;
    }
    let owner = root;
    for (let i = 1; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const part = parts[i]!;
      if (part.startsWith("#")) {
        const at = Number(part.slice(1));
        const items = owner.items;
        if (items === null || at >= items.length) return;
        if (last) {
          items[at] = value.int && !items[at]!.int ? ShaderValue.scalar(value.x) : value;
          return;
        }
        owner = items[at]!;
      } else {
        if (owner.fields === null) return;
        if (last) {
          assignInto(owner.fields, part, value);
          return;
        }
        const next = owner.fields.get(part);
        if (next === undefined) return;
        owner = next;
      }
    }
    return;
  }
  const name = parts[parts.length - 1]!;
  for (const g of runner.globals.values())
    if (g.fields !== null && g.fields.has(name)) {
      assignInto(g.fields, name, value);
      return;
    }
}

function assignInto(into: Map<string, ShaderValue>, name: string, value: ShaderValue): void {
  const old = into.get(name);
  if (old !== undefined && old.v !== null && value.v !== null && !old.isMatrix && !value.isMatrix && old.v.length !== value.v.length)
    value = ShaderValue.vecOf(value.padded(old.v.length));
  // A number takes the uniform's type (setFloat("x", 1) is a float in the shader, an int uniform an integer).
  if (old !== undefined && old.v !== null && old.v.length === 1 && value.v !== null && value.v.length === 1 && old.int !== value.int)
    value = old.int ? ShaderValue.integer(Math.trunc(value.x)) : ShaderValue.scalar(value.x);
  into.set(name, value);
}

/**
 * The programmable stages of a draw: the vertex shader per vertex and the fragment shader per pixel, the geometry
 * shader per primitive and the tessellation stages per patch.
 */
export class Stages {
  private readonly vs: ShaderRunner;
  private readonly fs: ShaderRunner;
  private readonly vsInputs: A.Global[];
  private readonly vsOutputs: A.Global[];
  private readonly fsInputs: A.Global[];
  private readonly fsOutput: A.Global | null;
  /** The fragment shader's outputs by colour attachment (layout(location = n) out …). */
  private readonly fsOutputs: (A.Global | null)[];
  /**
   * The GLSL fragment shader's outputs as they start: every fragment starts from them, so an output a shader leaves
   * unwritten reads the same whichever fragment the runner shaded before.
   */
  private readonly fsInitialOutputs: [string, ShaderValue][];
  private readonly gs: ShaderRunner | null = null;
  private readonly gsInputs: A.Global[] = [];
  private readonly gsOutputs: A.Global[] = [];

  get hasGeometry(): boolean {
    return this.gs !== null;
  }

  /** The fragment shader writes its own depth (gl_FragDepth, an SV_Depth output). */
  readonly writesDepth: boolean;

  /** The depth the last fragment wrote (0–1), when writesDepth. */
  fragDepth: number | null = null;

  /**
   * The stages of a draw with its uniforms (draw.uniforms(time), worked out once per draw) and the textures it samples.
   */
  constructor(private readonly draw: DrawCall, uniforms: Map<string, ShaderValue>, textures: TextureReads, time: number, private readonly height: number, private readonly scale: number, private readonly yDown: boolean) {
    const reads = { time, sample: textures.sample, sampleCube: textures.sampleCube, sampleCubeLod: textures.sampleCubeLod, textureImage: textures.size };
    this.vs = new ShaderRunner(draw.vertexShader, reads);
    this.fs = new ShaderRunner(draw.fragmentShader, { ...reads, footprint: (u, v) => this.footprint(u, v) });
    if (draw.geometryShader !== null) {
      const geometry = draw.geometryShader;
      this.gs = new ShaderRunner(geometry, reads);
      this.gsInputs = geometry.globals.filter((g) => g.storage === "in");
      this.gsOutputs = geometry.globals.filter((g) => g.storage === "out");
    }
    for (const [k, v] of uniforms) {
      setUniform(this.vs, k, v);
      setUniform(this.fs, k, v);
      if (this.gs !== null) setUniform(this.gs, k, v);
    }
    this.tessellationStages(textures, time, uniforms);
    this.writesDepth = draw.hlsl
      ? draw.fragmentShader.structs.some((st) => st.fields.some((f) => eqIgnoreCase(f.semantic, "SV_Depth")))
        || eqIgnoreCase(draw.fragmentShader.findFunction(draw.fragmentEntry)?.semantic ?? null, "SV_Depth")
      : draw.fragmentShader.names.has("gl_FragDepth");
    this.vsInputs = draw.vertexShader.globals.filter((g) => g.storage === "in");
    this.vsOutputs = draw.vertexShader.globals.filter((g) => g.storage === "out");
    this.fsInputs = draw.fragmentShader.globals.filter((g) => g.storage === "in");
    const outs = draw.fragmentShader.globals.filter((g) => g.storage === "out");
    // OrderBy(location ?? 0).FirstOrDefault(): the first of the lowest location (a stable order).
    this.fsOutput = outs.length === 0 ? null : outs.reduce((best, g) => ((g.location ?? 0) < (best.location ?? 0) ? g : best));
    this.fsOutputs = new Array<A.Global | null>(outs.length === 0 ? 0 : Math.max(...outs.map((g, i) => g.location ?? i)) + 1).fill(null);
    for (let i = 0; i < outs.length; i++) this.fsOutputs[outs[i]!.location ?? i] = outs[i]!;
    this.fsInitialOutputs = outs.filter((g) => g.block === null && this.fs.globals.has(g.id)).map((g) => [g.id, this.fs.globals.get(g.id)!.clone()]);
    if (!draw.hlsl) {
      if (draw.vertexShader.findFunction("main") === null) throw new ShaderRuntimeException("the vertex shader has no main()", 0);
      if (draw.fragmentShader.findFunction("main") === null) throw new ShaderRuntimeException("the fragment shader has no main()", 0);
      // A depth-only pass (a shadow map: an off-screen target, glDrawBuffer(GL_NONE)) needs no colour output.
      if (this.fsOutput === null && draw.target === null) throw new ShaderRuntimeException("the fragment shader has no output (out vec4 …)", 0);
    }
  }

  /**
   * Sets a uniform by its name as the program uses it: a global ("transform"), a field of a struct or block
   * ("material.shininess", "ubo.view"), an array element ("pointLights[0].position"), or a field of a block found by
   * the field's name alone (push constants and cbuffers).
   */
  static setUniform(runner: ShaderRunner, key: string, value: ShaderValue): void {
    setUniform(runner, key, value);
  }

  /** POSITION → POSITION0, TEXCOORD1 stays. */
  static semantic(s: string): string {
    return semanticKey(s);
  }

  vertex(index: number, instance: number): ShadedVertex {
    const draw = this.draw;
    let data: VertexData = index >= 0 && index < draw.vertices.length ? draw.vertices[index]! : new Map();
    const perInstance = draw.instanceVertices;
    if (perInstance !== null && perInstance.length > 0) {
      // Per-instance attributes: the same values for every vertex of an instance.
      const extra = perInstance[Math.min(perInstance.length - 1, Math.trunc(instance / Math.max(1, draw.instanceDivisor)))]!;
      data = new Map(data);
      for (const [k, v] of extra) data.set(k, v);
    }
    return draw.hlsl ? this.hlslVertex(data, index, instance) : this.glslVertex(data, index, instance);
  }

  private glslVertex(data: VertexData, index: number, instance: number): ShadedVertex {
    const vs = this.vs;
    for (let i = 0; i < this.vsInputs.length; i++) {
      const g = this.vsInputs[i]!;
      const loc = g.location ?? i;
      if (g.type === "mat4" || g.type === "mat3" || g.type === "mat2") {
        // A matrix attribute takes one location per column (learnopengl's instanced aInstanceMatrix).
        const n = g.type.charCodeAt(3) - 48;
        const cols = new Array<number>(n * n);
        for (let c = 0; c < n; c++) {
          const col = data.get(String(loc + c))?.padded(n) ?? new Array<number>(n).fill(0);
          for (let r = 0; r < n; r++) cols[c * n + r] = col[r]!;
        }
        vs.globals.set(g.id, ShaderValue.matrix(n, cols));
        continue;
      }
      vs.globals.set(g.id, sized(g.type, data.get(String(loc)) ?? null));
    }
    const vertexId = ShaderValue.integer(index), instanceId = ShaderValue.integer(instance);
    vs.globals.set("gl_VertexIndex", vertexId);
    vs.globals.set("gl_VertexID", vertexId);
    vs.globals.set("gl_InstanceIndex", instanceId);
    vs.globals.set("gl_InstanceID", instanceId);
    vs.globals.set("gl_Position", ShaderValue.vec(0, 0, 0, 1));
    vs.globals.set("gl_PointSize", ShaderValue.scalar(Number.NaN));
    vs.call("main", []);
    const size = vs.globals.get("gl_PointSize")!.x;
    return new ShadedVertex(vs.globals.get("gl_Position")!.padded(4), outputsOf(vs, this.vsOutputs), Number.isNaN(size) ? null : size);
  }

  /** The key a GLSL stage's input is matched by: the block name, the location (Vulkan) or the name. */
  private inputKey(g: A.Global, i: number): string {
    return g.block !== null && !this.draw.matchByLocation ? "block:" + g.type : this.draw.matchByLocation ? "@" + (g.location ?? i) : g.id;
  }

  private hlslVertex(data: VertexData, index: number, instance: number): ShadedVertex {
    const draw = this.draw;
    const f = draw.vertexShader.findFunction(draw.vertexEntry);
    if (f === null) throw new ShaderRuntimeException(`the vertex shader has no function '${draw.vertexEntry}'`, 0);
    const args: ShaderValue[] = [];
    for (const p of f.params) {
      const st = draw.vertexShader.findStruct(p.type);
      if (st !== null) args.push(ShaderValue.struct(fieldMap(st.fields, (fl) => fl.id, (fl) => fromSemantic(fl.type, fl.semantic, data, index, instance))));
      else args.push(fromSemantic(p.type, p.semantic, data, index, instance));
    }
    const result = this.vs.call(f.id, args);
    if (result === null) throw new ShaderRuntimeException(`'${f.id}' returns nothing`, f.line);
    const outputs = new Map<string, ShaderValue>();
    let clip: number[] | null = null;
    const rs = result.fields !== null ? draw.vertexShader.findStruct(f.returnType) : null;
    if (result.fields !== null && rs !== null) {
      for (const field of rs.fields) {
        const value = result.fields.get(field.id);
        if (value === undefined) throw new Error(`The given key '${field.id}' was not present in the dictionary.`);
        if (isPosition(field.semantic)) clip = value.padded(4);
        outputs.set(field.id, value);
        if (field.semantic !== null) outputs.set("@" + semanticKey(field.semantic), value);
      }
    } else if (isPosition(f.semantic)) clip = result.padded(4);
    // Before the tessellation stages the vertex shader hands on control points: no SV_POSITION needed.
    if (clip === null && draw.tessEvalShader !== null) clip = [0, 0, 0, 1];
    if (clip === null) throw new ShaderRuntimeException(`'${f.id}' returns no SV_POSITION`, f.line);
    return new ShadedVertex(clip, outputs);
  }

  /** The fragment being shaded: its triangle and how its weights change one pixel right / down (for mip levels). */
  private fragmentVertices: ShadedVertex[] | null = null;
  private fragmentWeights: [number, number, number] = [0, 0, 0];
  private fragmentDerivatives: Derivatives | null = null;

  /**
   * Where texture coordinates (u, v) go from pixel to pixel at the fragment being shaded: the 2-component varying that
   * has this value here (else the first one – coordinates computed from it), its change per pixel of the program's
   * window.
   */
  private footprint(u: number, v: number): Footprint | null {
    const d = this.fragmentDerivatives, t = this.fragmentVertices;
    if (d === null || t === null) return null;
    const [p0, p1, p2] = this.fragmentWeights;
    let first: Footprint | null = null;
    for (const [key, a] of t[0]!.outputs) {
      const va = a.v;
      if (va === null || va.length !== 2 || a.isMatrix) continue;
      const b = t[1]!.outputs.get(key), c = t[2]!.outputs.get(key);
      if (b === undefined || c === undefined || b.v === null || b.v.length !== 2 || c.v === null || c.v.length !== 2) continue;
      const vb = b.v, vc = c.v;
      // Per pixel of the program's window (the preview's pixels are `scale` of them).
      const s = this.scale;
      const derivative: Footprint = [(d[0] * va[0]! + d[1] * vb[0]! + d[2] * vc[0]!) / s, (d[0] * va[1]! + d[1] * vb[1]! + d[2] * vc[1]!) / s,
        (d[3] * va[0]! + d[4] * vb[0]! + d[5] * vc[0]!) / s, (d[3] * va[1]! + d[4] * vb[1]! + d[5] * vc[1]!) / s];
      const iu = p0 * va[0]! + p1 * vb[0]! + p2 * vc[0]!, iv = p0 * va[1]! + p1 * vb[1]! + p2 * vc[1]!;
      if (Math.abs(iu - u) < 1e-7 && Math.abs(iv - v) < 1e-7) return derivative;
      first ??= derivative;
    }
    return first;
  }

  fragment(vs3: ShadedVertex[], p0: number, p1: number, p2: number, x: number, y: number, z: number, invW: number, front: boolean,
    derivatives: Derivatives | null = null): (number[] | null)[] | null {
    this.fragmentVertices = vs3;
    this.fragmentWeights = [p0, p1, p2];
    this.fragmentDerivatives = derivatives;
    const varyings = new Map<string, ShaderValue>();
    for (const [k, a] of vs3[0]!.outputs) {
      const b = vs3[1]!.outputs.get(k), c = vs3[2]!.outputs.get(k);
      if (b === undefined || c === undefined) {
        varyings.set(k, a);
        continue;
      }
      varyings.set(k, interpolate(a, b, c, p0, p1, p2));
    }
    // Window coordinates of the real window: OpenGL counts y from the bottom, Vulkan and DirectX from the top.
    const fx = x * this.scale, fy = (this.yDown || this.draw.hlsl ? y : this.height - y) * this.scale;
    const fragCoord = ShaderValue.vec(fx, fy, z, invW);
    return this.draw.hlsl ? this.hlslFragment(varyings, fragCoord, front) : this.glslFragment(varyings, fragCoord, front);
  }

  private glslFragment(varyings: Map<string, ShaderValue>, fragCoord: ShaderValue, front: boolean): (number[] | null)[] | null {
    const fs = this.fs;
    for (let i = 0; i < this.fsInputs.length; i++) {
      const g = this.fsInputs[i]!;
      const v = varyings.get(this.inputKey(g, i));
      if (v !== undefined) setInput(fs, g, v);
      else if (g.block === null) fs.globals.set(g.id, fs.default(g.type));
    }
    fs.globals.set("gl_FragCoord", fragCoord);
    fs.globals.set("gl_FrontFacing", ShaderValue.scalar(front ? 1 : 0));
    for (const [id, value] of this.fsInitialOutputs) fs.globals.set(id, value.clone());
    // gl_FragDepth starts as the fragment's own depth (in window depth 0–1).
    if (this.writesDepth) fs.globals.set("gl_FragDepth", ShaderValue.scalar(fragCoord.v![2]!));
    fs.call("main", []);
    if (this.writesDepth) this.fragDepth = fs.globals.get("gl_FragDepth")?.x ?? fragCoord.v![2]!;
    if (fs.discarded) {
      fs.clearDiscard();
      return null;
    }
    return this.fsOutputs.map((o) => {
      if (o === null) return null;
      const g = fs.globals.get(o.id);
      if (g === undefined) throw new Error(`The given key '${o.id}' was not present in the dictionary.`);
      return g.v !== null ? g.v.slice() : null;
    });
  }

  private hlslFragment(varyings: Map<string, ShaderValue>, fragCoord: ShaderValue, front: boolean): (number[] | null)[] | null {
    const draw = this.draw, fs = this.fs;
    const f = draw.fragmentShader.findFunction(draw.fragmentEntry);
    if (f === null) throw new ShaderRuntimeException(`the pixel shader has no function '${draw.fragmentEntry}'`, 0);
    const args: ShaderValue[] = [];
    for (const p of f.params) {
      const st = draw.fragmentShader.findStruct(p.type);
      if (st !== null) {
        const fields = new Map<string, ShaderValue>();
        for (const field of st.fields) {
          const bySemantic = field.semantic !== null ? varyings.get("@" + semanticKey(field.semantic)) : undefined;
          if (isPosition(field.semantic)) fields.set(field.id, fragCoord);
          else if (isFrontFace(field.semantic)) fields.set(field.id, ShaderValue.scalar(front ? 1 : 0));
          else if (bySemantic !== undefined) fields.set(field.id, bySemantic);
          else fields.set(field.id, varyings.get(field.id) ?? fs.default(field.type));
        }
        args.push(ShaderValue.struct(fields));
      } else if (isPosition(p.semantic)) args.push(fragCoord);
      else if (isFrontFace(p.semantic)) args.push(ShaderValue.scalar(front ? 1 : 0));
      else args.push((p.semantic !== null ? varyings.get("@" + semanticKey(p.semantic)) : undefined) ?? fs.default(p.type));
    }
    let result = fs.call(f.id, args);
    if (fs.discarded) {
      fs.clearDiscard();
      return null;
    }
    // float PSMain(…) : SV_Depth – the value is the depth, no colour.
    if (eqIgnoreCase(f.semantic, "SV_Depth")) {
      this.fragDepth = result?.x ?? fragCoord.v![2]!;
      return [];
    }
    result ??= ShaderValue.vec(0, 0, 0, 1);
    if (this.writesDepth) {
      // An SV_Depth output (the point shadows' distance): the fragment's depth from now on.
      const depthField = draw.fragmentShader.findStruct(f.returnType)?.fields.find((x) => eqIgnoreCase(x.semantic, "SV_Depth")) ?? null;
      const dv = depthField !== null ? result.fields?.get(depthField.id) : undefined;
      this.fragDepth = dv !== undefined ? dv.x : fragCoord.v![2]!;
    }
    // A struct with SV_Target0, SV_Target1 …: one colour per render target.
    const rs = result.fields !== null ? draw.fragmentShader.findStruct(f.returnType) : null;
    if (result.fields !== null && rs !== null) {
      const targets: (number[] | null)[] = [];
      for (const field of rs.fields) {
        if (field.semantic === null || !field.semantic.toUpperCase().startsWith("SV_TARGET")) continue;
        const n = field.semantic.length > 9 ? (tryParseInt(field.semantic.slice(9)) ?? 0) : 0;
        while (targets.length <= n) targets.push(null);
        const v = result.fields.get(field.id);
        targets[n] = v !== undefined && v.v !== null ? v.v.slice() : null;
      }
      return targets;
    }
    return [result.v?.slice() ?? [0, 0, 0, 1]];
  }

  /**
   * Runs the geometry shader on one input primitive and returns the primitives it emits: points, the lines of a line
   * strip or the triangles of a triangle strip (EndPrimitive / RestartStrip starts a new strip).
   */
  geometry(input: ShadedVertex[]): [Topology, ShadedVertex[]][] {
    const geometry = this.draw.geometryShader!;
    const strips: ShadedVertex[][] = [[]];
    for (let invocation = 0; invocation < Math.max(1, geometry.invocations); invocation++) {
      // Each instance of the shader starts strips of its own.
      if (strips[strips.length - 1]!.length > 0) strips.push([]);
      this.invokeGeometry(geometry, input, strips, invocation);
    }
    const result: [Topology, ShadedVertex[]][] = [];
    for (const strip of strips) {
      switch (geometry.outputPrimitive) {
        case "points":
          for (const v of strip) result.push([Topology.Points, [v]]);
          break;
        case "line_strip":
          for (let i = 0; i + 1 < strip.length; i++) result.push([Topology.Lines, [strip[i]!, strip[i + 1]!]]);
          break;
        default:
          for (let i = 0; i + 2 < strip.length; i++)
            result.push([Topology.Triangles, i % 2 === 0 ? [strip[i]!, strip[i + 1]!, strip[i + 2]!] : [strip[i + 1]!, strip[i]!, strip[i + 2]!]]);
          break;
      }
    }
    return result;
  }

  /** One run of the geometry shader on a primitive: instance `invocation` of it. */
  private invokeGeometry(geometry: ShaderProgram, input: ShadedVertex[], strips: ShadedVertex[][], invocation: number): void {
    const gs = this.gs!;
    if (this.draw.hlsl) {
      const f = geometry.findFunction(this.draw.geometryEntry);
      if (f === null) throw new ShaderRuntimeException(`the geometry shader has no function '${this.draw.geometryEntry}'`, 0);
      const args: ShaderValue[] = [];
      for (const p of f.params) {
        if (p.out) {
          args.push(ShaderValue.scalar(0));
          continue;
        }
        if (eqIgnoreCase(p.semantic, "SV_GSInstanceID")) {
          args.push(ShaderValue.integer(invocation));
          continue;
        }
        const st = geometry.findStruct(p.type);
        args.push(ShaderValue.array(input.map((v) => st === null ? ShaderValue.vecOf(v.clip)
          : ShaderValue.struct(fieldMap(st.fields, (fl) => fl.id, (fl) => isPosition(fl.semantic) ? ShaderValue.vecOf(v.clip)
            : v.outputs.get(fl.id) ?? (fl.semantic !== null ? v.outputs.get("@" + semanticKey(fl.semantic)) : undefined) ?? gs.default(fl.type))))));
      }
      gs.emit = (kind, value) => {
        if (kind === "RestartStrip") {
          strips.push([]);
          return;
        }
        if (value === null || value.fields === null) return;
        const outputs = new Map<string, ShaderValue>();
        let clip: number[] | null = null;
        let layer = 0;
        const keys = [...value.fields.keys()];
        const outStruct = geometry.structs.find((st) => {
          const ids = new Set(st.fields.map((x) => x.id));
          return ids.size === new Set(keys).size && keys.every((k) => ids.has(k));
        }) ?? null;
        for (const [k, v] of value.fields) {
          outputs.set(k, v.clone());
          const semantic = outStruct?.fields.find((x) => x.id === k)?.semantic ?? null;
          if (isPosition(semantic)) clip = v.padded(4);
          else if (eqIgnoreCase(semantic, "SV_RenderTargetArrayIndex")) layer = toInt(v.x);
          else if (semantic !== null) outputs.set("@" + semanticKey(semantic), outputs.get(k)!);
        }
        strips[strips.length - 1]!.push(new ShadedVertex(clip ?? [0, 0, 0, 1], outputs, null, layer));
      };
      gs.call(f.id, args);
    } else {
      gs.globals.set("gl_in", ShaderValue.array(input.map((v) => ShaderValue.struct(new Map([
        ["gl_Position", ShaderValue.vecOf(v.clip)],
        ["gl_PointSize", ShaderValue.scalar(v.pointSize ?? 1)],
      ])))));
      for (let i = 0; i < this.gsInputs.length; i++) {
        const g = this.gsInputs[i]!;
        const key = this.inputKey(g, i);
        gs.globals.set(g.id === "" ? g.type : g.id, ShaderValue.array(input.map((v) => v.outputs.get(key) ?? gs.default(g.type))));
      }
      gs.globals.set("gl_PrimitiveIDIn", ShaderValue.scalar(0));
      gs.globals.set("gl_InvocationID", ShaderValue.integer(invocation));
      gs.emit = (kind) => {
        if (kind === "EndPrimitive") {
          strips.push([]);
          return;
        }
        const position = gs.globals.get("gl_Position")?.padded(4) ?? [0, 0, 0, 1];
        const l = gs.globals.get("gl_Layer");
        const layer = l !== undefined ? toInt(l.x) : 0;
        strips[strips.length - 1]!.push(new ShadedVertex(position, outputsOf(gs, this.gsOutputs), null, layer));
      };
      gs.globals.set("gl_Position", ShaderValue.vec(0, 0, 0, 1));
      gs.globals.set("gl_Layer", ShaderValue.scalar(0));
      gs.call("main", []);
    }
  }

  // ---------- the tessellation stages (Rasterizer.Tessellation.cs) ----------

  private tcs: ShaderRunner | null = null;
  private tes: ShaderRunner | null = null;
  private tcsInputs: A.Global[] = [];
  private tcsOutputs: A.Global[] = [];
  private tesInputs: A.Global[] = [];
  private tesOutputs: A.Global[] = [];

  get hasTessellation(): boolean {
    return this.tes !== null;
  }

  /** Makes the runners of the tessellation stages (from the constructor), with the draw's uniforms. */
  private tessellationStages(textures: TextureReads, time: number, uniforms: Map<string, ShaderValue>): void {
    const evaluation = this.draw.tessEvalShader;
    if (evaluation === null) return;
    const reads = { time, sample: textures.sample, sampleCube: textures.sampleCube, sampleCubeLod: textures.sampleCubeLod, textureImage: textures.size };
    this.tes = new ShaderRunner(evaluation, reads);
    this.tesInputs = evaluation.globals.filter((g) => g.storage === "in");
    this.tesOutputs = evaluation.globals.filter((g) => g.storage === "out");
    const control = this.draw.tessControlShader;
    if (control !== null) {
      this.tcs = new ShaderRunner(control, reads);
      this.tcsInputs = control.globals.filter((g) => g.storage === "in");
      this.tcsOutputs = control.globals.filter((g) => g.storage === "out");
    }
    for (const [k, v] of uniforms) {
      setUniform(this.tes, k, v);
      if (this.tcs !== null) setUniform(this.tcs, k, v);
    }
  }

  /** One patch (the vertex shader's outputs of its control points) → the primitives the tessellator makes. */
  tessellate(input: ShadedVertex[], patchId: number): [Topology, ShadedVertex[]][] {
    const draw = this.draw;
    const patch = draw.hlsl ? this.hullStage(input, patchId) : this.controlStage(input, patchId);
    const evaluation = draw.tessEvalShader!;
    // The domain, spacing and winding: GLSL's evaluation shader layout; HLSL's hull shader attributes.
    let domain: string, spacing: string;
    let cw: boolean, points: boolean;
    if (draw.hlsl) {
      const hs = draw.tessControlShader;
      const attr = (name: string): string | null => {
        const value = (hs?.attribute(draw.tessControlEntry, name) ?? evaluation.attribute(draw.tessEvalEntry, name))?.[0];
        return value === undefined ? null : value.replace(/^"+|"+$/g, "");
      };
      domain = attr("domain") ?? "quad";
      spacing = Tessellator.spacing(attr("partitioning"));
      const topology = attr("outputtopology") ?? "triangle_cw";
      cw = topology === "triangle_cw";
      points = topology === "point";
      domain = domain === "tri" ? "triangles" : domain === "isoline" ? "isolines" : "quads";
      if (topology === "line") domain = "isolines";
    } else {
      domain = evaluation.tessDomain ?? "triangles";
      spacing = Tessellator.spacing(evaluation.tessSpacing);
      cw = evaluation.tessCw;
      points = evaluation.tessPointMode;
    }
    const result: [Topology, ShadedVertex[]][] = [];
    if (patch === null) return result;
    if (domain === "isolines") {
      // Isolines: outer[0] lines (v = 0, 1/n, …), each cut into outer[1] segments along u.
      const lines = toInt(clamp(Math.ceil((patch.outer[0] ?? 0) - 1e-9), 0, 64));
      const segments = toInt(clamp(Math.ceil((patch.outer[1] ?? 0) - 1e-9), 0, 64));
      for (let l = 0; l < lines; l++) {
        let last: ShadedVertex | null = null;
        for (let s = 0; s <= segments; s++) {
          const v = this.evaluate(patch, s / segments, l / lines, 0, patchId);
          if (points) result.push([Topology.Points, [v]]);
          else if (last !== null) result.push([Topology.Lines, [last, v]]);
          last = v;
        }
      }
      return result;
    }
    const mesh = domain === "quads" ? Tessellator.quad(patch.outer, patch.inner, spacing, cw) : Tessellator.triangle(patch.outer, patch.inner, spacing, cw);
    if (mesh === null) return result;
    const shaded = new Array<ShadedVertex | null>(mesh.points.length).fill(null);
    const at = (i: number): ShadedVertex => {
      const done = shaded[i];
      if (done !== null && done !== undefined) return done;
      const [u, v] = mesh.points[i]!;
      return (shaded[i] = this.evaluate(patch, u, v, domain === "triangles" ? 1 - u - v : 0, patchId));
    };
    if (points) {
      for (let i = 0; i < mesh.points.length; i++) result.push([Topology.Points, [at(i)]]);
      return result;
    }
    for (const t of mesh.triangles) result.push([Topology.Triangles, [at(t[0]!), at(t[1]!), at(t[2]!)]]);
    return result;
  }

  /** GLSL: the tessellation control shader, once per output control point (gl_InvocationID). */
  private controlStage(input: ShadedVertex[], patchId: number): Patch | null {
    const tcs = this.tcs;
    if (tcs === null) {
      // No control stage (OpenGL allows it): the vertex shader's outputs go on; the default levels are 1.
      return { points: input.slice(), structs: [], outer: [1, 1, 1, 1], inner: [1, 1], patchValues: new Map(), constants: null };
    }
    const control = this.draw.tessControlShader!;
    const n = input.length, outN = control.tessVertices > 0 ? control.tessVertices : n;
    tcs.globals.set("gl_in", ShaderValue.array(input.map(position)));
    for (let i = 0; i < this.tcsInputs.length; i++) {
      const g = this.tcsInputs[i]!;
      const key = this.inputKey(g, i);
      tcs.globals.set(g.id === "" ? g.type : g.id, ShaderValue.array(input.map((v) => v.outputs.get(key) ?? zero(tcs, g))));
    }
    // Per-vertex outputs: arrays of one element per output control point; patch outputs: one value.
    for (const g of this.tcsOutputs)
      tcs.globals.set(g.id === "" ? g.type : g.id, g.arraySize !== 0 ? ShaderValue.array(Array.from({ length: outN }, () => zero(tcs, g))) : zero(tcs, g));
    tcs.globals.set("gl_out", ShaderValue.array(Array.from({ length: outN }, () => ShaderValue.struct(new Map([
      ["gl_Position", ShaderValue.vec(0, 0, 0, 1)],
      ["gl_PointSize", ShaderValue.scalar(1)],
    ])))));
    // Levels the shader does not write read 1 (the default levels).
    tcs.globals.set("gl_TessLevelOuter", ShaderValue.array([ShaderValue.scalar(1), ShaderValue.scalar(1), ShaderValue.scalar(1), ShaderValue.scalar(1)]));
    tcs.globals.set("gl_TessLevelInner", ShaderValue.array([ShaderValue.scalar(1), ShaderValue.scalar(1)]));
    tcs.globals.set("gl_PatchVerticesIn", ShaderValue.integer(n));
    tcs.globals.set("gl_PrimitiveID", ShaderValue.integer(patchId));
    for (let invocation = 0; invocation < outN; invocation++) {
      tcs.globals.set("gl_InvocationID", ShaderValue.integer(invocation));
      tcs.call("main", []);
    }
    const glOut = tcs.globals.get("gl_out")!.items!;
    const points: ShadedVertex[] = [];
    const patchValues = new Map<string, ShaderValue>();
    for (let k = 0; k < outN; k++) {
      const outputs = new Map<string, ShaderValue>();
      for (let i = 0; i < this.tcsOutputs.length; i++) {
        const g = this.tcsOutputs[i]!;
        const all = tcs.globals.get(g.id === "" ? g.type : g.id)!;
        if (g.arraySize === 0) {
          if (k === 0) for (const key of keysOf(g, i)) patchValues.set(key, all.clone());
          continue;
        }
        const items = all.items;
        const value = items !== null && k < items.length ? items[k]!.clone() : zero(tcs, g);
        for (const key of keysOf(g, i)) outputs.set(key, value);
      }
      const f = glOut[k]!.fields;
      const p = f?.get("gl_Position");
      const ps = f?.get("gl_PointSize");
      points.push(new ShadedVertex(p !== undefined ? p.padded(4) : [0, 0, 0, 1], outputs, ps !== undefined ? ps.x : 1));
    }
    const levels = (name: string, count: number): number[] => Array.from({ length: count }, (_, i) => {
      const l = tcs.globals.get(name)!.items;
      return l !== null && i < l.length ? l[i]!.x : 1;
    });
    return { points, structs: [], outer: levels("gl_TessLevelOuter", 4), inner: levels("gl_TessLevelInner", 2), patchValues, constants: null };
  }

  /** GLSL: the tessellation evaluation shader at (u, v[, w]) of the patch. */
  private evaluate(patch: Patch, u: number, v: number, w: number, patchId: number): ShadedVertex {
    if (this.draw.hlsl) return this.domainStage(patch, u, v, w, patchId);
    const runner = this.tes!;
    runner.globals.set("gl_in", ShaderValue.array(patch.points.map(position)));
    for (let i = 0; i < this.tesInputs.length; i++) {
      const g = this.tesInputs[i]!;
      const key = this.inputKey(g, i);
      const pv = patch.patchValues.get(key);
      runner.globals.set(g.id === "" ? g.type : g.id, g.arraySize !== 0
        ? ShaderValue.array(patch.points.map((p) => p.outputs.get(key)?.clone() ?? zero(runner, g)))
        : pv !== undefined ? pv.clone() : zero(runner, g));
    }
    runner.globals.set("gl_TessLevelOuter", ShaderValue.array(patch.outer.map((x) => ShaderValue.scalar(x))));
    runner.globals.set("gl_TessLevelInner", ShaderValue.array(patch.inner.map((x) => ShaderValue.scalar(x))));
    runner.globals.set("gl_PatchVerticesIn", ShaderValue.integer(patch.points.length));
    runner.globals.set("gl_PrimitiveID", ShaderValue.integer(patchId));
    runner.globals.set("gl_TessCoord", ShaderValue.vec(u, v, w));
    runner.globals.set("gl_Position", ShaderValue.vec(0, 0, 0, 1));
    runner.globals.set("gl_PointSize", ShaderValue.scalar(Number.NaN));
    runner.call("main", []);
    const size = runner.globals.get("gl_PointSize")!.x;
    return new ShadedVertex(runner.globals.get("gl_Position")!.padded(4), outputsOf(runner, this.tesOutputs), Number.isNaN(size) ? null : size);
  }

  /**
   * HLSL: the hull shader's entry point once per output control point (SV_OutputControlPointID), then its patch
   * constant function once (SV_TessFactor, SV_InsideTessFactor).
   */
  private hullStage(input: ShadedVertex[], patchId: number): Patch | null {
    const hull = this.draw.tessControlShader;
    const tcs = this.tcs;
    if (hull === null || tcs === null) return { points: input.slice(), structs: [], outer: [1, 1, 1, 1], inner: [1, 1], patchValues: new Map(), constants: null };
    const entry = hull.findFunction(this.draw.tessControlEntry);
    if (entry === null) throw new ShaderRuntimeException(`the hull shader has no function '${this.draw.tessControlEntry}'`, 0);
    const declared = tryParseInt(hull.attribute(entry.id, "outputcontrolpoints")?.[0] ?? "");
    const outN = declared ?? input.length;
    const inputPatch = (type: string): ShaderValue => ShaderValue.array(input.map((v) => structOf(hull, patchElement(type, "InputPatch") ?? "", v, tcs)));
    const structs: ShaderValue[] = [];
    const points: ShadedVertex[] = [];
    for (let i = 0; i < outN; i++) {
      const args = entry.params.map((p) =>
        patchElement(p.type, "InputPatch") !== null ? inputPatch(p.type)
        : eqIgnoreCase(p.semantic, "SV_OutputControlPointID") ? ShaderValue.integer(i)
        : eqIgnoreCase(p.semantic, "SV_PrimitiveID") ? ShaderValue.integer(patchId)
        : tcs.default(p.type));
      const result = tcs.call(entry.id, args) ?? ShaderValue.struct(new Map());
      structs.push(result);
      const outputs = new Map<string, ShaderValue>();
      let clip: number[] | null = null;
      const rs = result.fields !== null ? hull.findStruct(entry.returnType) : null;
      if (result.fields !== null && rs !== null)
        for (const field of rs.fields) {
          const value = result.fields.get(field.id);
          if (value === undefined) continue;
          outputs.set(field.id, value);
          if (field.semantic !== null) outputs.set("@" + semanticKey(field.semantic), value);
          if (isPosition(field.semantic) || (clip === null && field.semantic !== null && field.semantic.toUpperCase().startsWith("POSITION"))) clip = value.padded(4);
        }
      points.push(new ShadedVertex(clip ?? [0, 0, 0, 1], outputs));
    }
    // The patch constant function.
    const constantName = hull.attribute(entry.id, "patchconstantfunc")?.[0]?.replace(/^"+|"+$/g, "") ?? null;
    let constants: ShaderValue | null = null;
    let outer = [1, 1, 1, 1], inner = [1, 1];
    const constant = constantName !== null ? hull.findFunction(constantName) : null;
    if (constant !== null) {
      const args = constant.params.map((p) =>
        patchElement(p.type, "InputPatch") !== null ? inputPatch(p.type)
        : patchElement(p.type, "OutputPatch") !== null ? ShaderValue.array(structs.map((s) => s.clone()))
        : eqIgnoreCase(p.semantic, "SV_PrimitiveID") ? ShaderValue.integer(patchId)
        : tcs.default(p.type));
      constants = tcs.call(constant.id, args);
      const cs = constants !== null && constants.fields !== null ? hull.findStruct(constant.returnType) : null;
      if (constants !== null && constants.fields !== null && cs !== null)
        for (const field of cs.fields) {
          const value = constants.fields.get(field.id);
          if (value === undefined) continue;
          const numbers: number[] = [];
          flatten(value, numbers);
          if (eqIgnoreCase(field.semantic, "SV_TessFactor")) outer = numbers;
          else if (eqIgnoreCase(field.semantic, "SV_InsideTessFactor")) inner = numbers;
        }
    }
    return { points, structs, outer, inner, patchValues: new Map(), constants };
  }

  /** HLSL: the domain shader at (u, v[, w]) (SV_DomainLocation) with the patch's control points and constants. */
  private domainStage(patch: Patch, u: number, v: number, w: number, patchId: number): ShadedVertex {
    const domain = this.draw.tessEvalShader!;
    const runner = this.tes!;
    const f = domain.findFunction(this.draw.tessEvalEntry);
    if (f === null) throw new ShaderRuntimeException(`the domain shader has no function '${this.draw.tessEvalEntry}'`, 0);
    const args: ShaderValue[] = [];
    for (const p of f.params) {
      const element = patchElement(p.type, "OutputPatch");
      if (eqIgnoreCase(p.semantic, "SV_DomainLocation")) args.push(ShaderRunner.componentCount(p.type) >= 3 ? ShaderValue.vec(u, v, w) : ShaderValue.vec(u, v));
      else if (element !== null)
        args.push(ShaderValue.array(patch.structs.length > 0 ? patch.structs.map((s) => s.clone()) : patch.points.map((pt) => structOf(domain, element, pt, runner))));
      else if (eqIgnoreCase(p.semantic, "SV_PrimitiveID")) args.push(ShaderValue.integer(patchId));
      else if (patch.constants !== null && domain.findStruct(p.type) !== null) args.push(patch.constants.clone());
      else args.push(runner.default(p.type));
    }
    const result = runner.call(f.id, args);
    if (result === null) throw new ShaderRuntimeException(`'${f.id}' returns nothing`, f.line);
    const outputs = new Map<string, ShaderValue>();
    let clip: number[] | null = null;
    const rs = result.fields !== null ? domain.findStruct(f.returnType) : null;
    if (result.fields !== null && rs !== null) {
      for (const field of rs.fields) {
        const value = result.fields.get(field.id);
        if (value === undefined) continue;
        if (isPosition(field.semantic)) clip = value.padded(4);
        outputs.set(field.id, value);
        if (field.semantic !== null) outputs.set("@" + semanticKey(field.semantic), value);
      }
    } else if (isPosition(f.semantic)) clip = result.padded(4);
    if (clip === null) throw new ShaderRuntimeException(`'${f.id}' returns no SV_POSITION`, f.line);
    return new ShadedVertex(clip, outputs);
  }
}

/** The outputs of a GLSL stage, by name, by "@location" and, for an interface block, by "block:Type". */
function outputsOf(runner: ShaderRunner, globals: A.Global[]): Map<string, ShaderValue> {
  const outputs = new Map<string, ShaderValue>();
  for (let i = 0; i < globals.length; i++) {
    const g = globals[i]!;
    const key = g.block !== null && g.id === "" ? null : g.id;
    let value: ShaderValue;
    if (key === null) value = ShaderValue.struct(fieldMap(g.block!, (f) => f.id, (f) => runner.globals.get(f.id)?.clone() ?? ShaderValue.scalar(0)));
    else {
      const v = runner.globals.get(key);
      if (v === undefined) continue;
      value = v.clone();
    }
    if (key !== null) outputs.set(key, value);
    outputs.set("@" + (g.location ?? i), value);
    if (g.block !== null) outputs.set("block:" + g.type, value);
  }
  return outputs;
}

/** Sets a GLSL stage's input (a block without an instance name puts its fields in the globals). */
function setInput(runner: ShaderRunner, g: A.Global, value: ShaderValue): void {
  if (g.block !== null && g.id === "" && value.fields !== null) {
    for (const [k, v] of value.fields) runner.globals.set(k, v);
    return;
  }
  runner.globals.set(g.id, value);
}

/**
 * Perspective-correct interpolation of numbers, struct fields and array items. Equal values stay exactly equal (flat
 * integers such as a material index).
 */
function interpolate(a: ShaderValue, b: ShaderValue, c: ShaderValue, p0: number, p1: number, p2: number): ShaderValue {
  const av = a.v, bv = b.v, cv = c.v;
  if (av !== null && !a.isMatrix && bv !== null && cv !== null) {
    if (sequenceEqual(av, bv) && sequenceEqual(av, cv)) return a;
    const r = new Array<number>(av.length);
    for (let i = 0; i < r.length; i++) r[i] = p0 * av[i]! + p1 * bv[Math.min(i, bv.length - 1)]! + p2 * cv[Math.min(i, cv.length - 1)]!;
    return ShaderValue.vecOf(r);
  }
  if (a.fields !== null && b.fields !== null && c.fields !== null) {
    const fields = new Map<string, ShaderValue>();
    for (const [k, v] of a.fields) {
      const fb = b.fields.get(k), fc = c.fields.get(k);
      fields.set(k, fb !== undefined && fc !== undefined ? interpolate(v, fb, fc, p0, p1, p2) : v);
    }
    return ShaderValue.struct(fields);
  }
  const ai = a.items, bi = b.items, ci = c.items;
  if (ai !== null && bi !== null && ci !== null && ai.length === bi.length && ai.length === ci.length)
    return ShaderValue.array(ai.map((x, i) => interpolate(x, bi[i]!, ci[i]!, p0, p1, p2)));
  return a;
}

function position(v: ShadedVertex): ShaderValue {
  return ShaderValue.struct(new Map([
    ["gl_Position", ShaderValue.vecOf(v.clip)],
    ["gl_PointSize", ShaderValue.scalar(v.pointSize ?? 1)],
  ]));
}

/** The value a stage's output default starts as: its type's zero, a block's fields' zeros. */
function zero(runner: ShaderRunner, g: A.Global): ShaderValue {
  return g.block !== null ? ShaderValue.struct(fieldMap(g.block, (f) => f.id, (f) => runner.default(f.type, f.arraySize))) : runner.default(g.type);
}

/** The keys a GLSL output is found by in the next stage: its name, "@location" and "block:Type". */
function keysOf(g: A.Global, i: number): string[] {
  const keys: string[] = [];
  if (!(g.block !== null && g.id === "")) keys.push(g.id);
  keys.push("@" + (g.location ?? i));
  if (g.block !== null) keys.push("block:" + g.type);
  return keys;
}

/** An HLSL struct of a stage's outputs (VS → hull input, hull → domain input) from a vertex's outputs. */
function structOf(program: ShaderProgram, type: string, v: ShadedVertex, runner: ShaderRunner): ShaderValue {
  const st = program.findStruct(type);
  if (st === null) return ShaderValue.vecOf(v.clip);
  return ShaderValue.struct(fieldMap(st.fields, (f) => f.id, (f) =>
    (f.semantic !== null ? v.outputs.get("@" + semanticKey(f.semantic)) : undefined)
    ?? v.outputs.get(f.id)
    ?? (isPosition(f.semantic) ? ShaderValue.vecOf(v.clip) : runner.default(f.type, f.arraySize))));
}

/** InputPatch&lt;T&gt; / OutputPatch&lt;T&gt; → T. */
function patchElement(type: string, kind: string): string | null {
  return type.startsWith(kind + "<") ? type.slice(kind.length + 1, -1) : null;
}

function flatten(v: ShaderValue, into: number[]): void {
  if (v.v !== null) into.push(...v.v);
  else {
    const items = v.items;
    if (items !== null) for (const i of items) flatten(i, into);
  }
}
