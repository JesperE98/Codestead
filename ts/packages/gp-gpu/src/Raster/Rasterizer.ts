// Rasterizer.cs and Rasterizer.Parallel.cs (the fragment batches; C# shades them on every core, in bands of rows that
// meet the primitives in draw order – "the frame is the same as on one core" – so here they are shaded on one thread).
import { Apis } from "../Apis.js";
import { formatDouble, hashText, roundEven, toByte, clamp, toInt } from "../internal/dotnet.js";
import type { DrawCall } from "../Scene/DrawCall.js";
import { ClearOp, CopyOp } from "../Scene/FrameOp.js";
import { RenderTarget } from "../Scene/RenderTarget.js";
import type { Scene } from "../Scene/Scene.js";
import { CompareFunc } from "../Scene/CompareFunc.js";
import { CullMode } from "../Scene/CullMode.js";
import { Topology } from "../Scene/Topology.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import { ShaderValue as Value } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import { Frame } from "./Frame.js";
import { Framebuffer } from "./Framebuffer.js";
import { dispatch } from "./Rasterizer.Compute.js";
import { line, nearDistance, point, triangle, type Fill } from "./Rasterizer.Fragments.js";
import { currentContext, RenderContext, setCurrentContext } from "./RenderContext.js";
import { ShadedVertex } from "./ShadedVertex.js";
import { SrgbCurve } from "./SrgbCurve.js";
import { Stages, TextureReads } from "./Stages.js";

/** A setup target whose shader loops is drawn at 1 / this of its size. */
const HeavySetupDivisor = 4;

/** The targets the setup draws filled, at a preview width. */
interface SetupResult {
  readonly width: number;
  readonly draws: number;
  readonly targets: Map<string, Framebuffer>;
  readonly errors: string[];
}

/** Setups drawn before, by what they draw (setupKey). */
const SharedSetups = new Map<string, SetupResult>();

/** The kind of primitive a topology makes: points, lines or triangles. */
function kindOf(t: Topology): Topology {
  return t === Topology.Points ? Topology.Points : t === Topology.Lines || t === Topology.LineStrip ? Topology.Lines : Topology.Triangles;
}

/** A target's family: the texture behind "name~mip@face" (its mip levels and cube faces). */
function family(id: string): string {
  const i = id.search(/[~@]/);
  return i < 0 ? id : id.slice(0, i);
}

/** "id@layer" → "id". */
function baseOf(id: string): string {
  const i = id.indexOf("@");
  return i < 0 ? id : id.slice(0, i);
}

function hasLoop(shader: ShaderProgram): boolean {
  const inBody = (body: readonly A.Stmt[]): boolean => body.some((s) =>
    s instanceof A.For || s instanceof A.ForEach ? true
    : s instanceof A.If ? inBody(s.then) || (s.else_ !== null && inBody(s.else_))
    : false);
  return shader.functions.some((f) => inBody(f.body));
}

/**
 * The targets the setup draws fill, by family: true when one of their fragment shaders loops (many samples per pixel).
 */
function setupTargets(scene: Scene): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const draw of scene.draws.slice(0, scene.setupDraws)) {
    if (draw.target === null) continue;
    const fam = family(draw.target);
    result.set(fam, (result.get(fam) ?? false) || hasLoop(draw.fragmentShader));
  }
  return result;
}

/**
 * Keeps what the setup draws left in their targets for the next frames – unless the frame itself draws into one of them
 * (then every frame starts from scratch).
 */
function keepSetup(owner: Scene, scene: Scene, width: number, targets: Map<string, Framebuffer>, errors: string[]): void {
  const later = new Set<string>();
  for (const d of scene.draws.slice(scene.setupDraws)) if (d.target !== null) later.add(baseOf(d.target));
  for (const o of scene.ops.slice(scene.setupOps)) {
    const t = o instanceof ClearOp ? o.target : o instanceof CopyOp ? o.to : null;
    if (t !== null) later.add(baseOf(t));
  }
  if ([...targets.keys()].some((id) => later.has(baseOf(id)))) return;
  // Targets with a size of their own are the same at every preview width.
  const anyWidth = [...targets.keys()].every((id) => {
    const t = scene.targets.get(baseOf(id));
    return t !== undefined && t.width > 0 && t.height > 0;
  });
  const result: SetupResult = { width: anyWidth ? 0 : width, draws: scene.setupDraws, targets: new Map(targets), errors: errors.slice() };
  owner.setupCache = result;
  if (anyWidth) {
    if (SharedSetups.size >= 12) SharedSetups.clear();
    SharedSetups.set(setupKey(scene), result);
  }
}

/** A list of numbers as the key writes them ("R" format; "-" for none). */
function numbers(v: readonly number[] | null): string {
  return v === null ? "-" : v.map(formatDouble).join(",");
}

/**
 * What a scene's setup draws: each draw's shaders, state, vertices, uniforms and what its textures read at a few points
 * (loaded images; targets drawn by earlier setup draws are covered by those draws), its ops and its targets. Two scenes
 * with the same key draw the same setup pictures. (C# hashes with string.GetHashCode / HashCode, which differ from run
 * to run; the key only has to be the same within one run.)
 */
function setupKey(scene: Scene): string {
  if (scene.setupKey !== null) return scene.setupKey;
  let sb = "";
  const yes = (b: boolean): string => (b ? "True" : "False");
  for (const d of scene.draws.slice(0, scene.setupDraws)) {
    sb += hashText(d.vertexShader.source) + "|" + hashText(d.fragmentShader.source) + "|" + (d.geometryShader !== null ? hashText(d.geometryShader.source) : "")
      + "|" + d.vertexEntry + d.fragmentEntry + "|" + (d.target ?? "") + "|" + Topology[d.topology] + d.first + "," + d.count
      + "," + d.instances + "|" + CullMode[d.cull] + yes(d.frontCcw) + yes(d.depthTest) + CompareFunc[d.depthFunc] + yes(d.depthWrite)
      + (d.blend?.toString() ?? "") + (d.stencil?.toString() ?? "") + d.colorMask.map(yes).join("") + "|";
    let hash = "";
    for (const v of d.vertices) for (const [k, x] of v) hash += k + ":" + (x.v !== null ? x.v.join(",") : "") + ";";
    if (d.indices !== null) hash += d.indices.join(",");
    sb += hashText(hash) + "|";
    for (const [k, v] of [...d.uniforms(1.0)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) sb += k + "=" + v.toString() + ";";
    for (const g of [...d.vertexShader.globals, ...d.fragmentShader.globals].filter((g) => g.type.startsWith("sampler") || g.type.startsWith("Texture"))) {
      sb += g.id + ":";
      const ids = [g.id, ...(d.hlsl ? d.fragmentShader.globals.filter((s) => s.type.startsWith("Sampler")).map((s) => g.id + "|" + s.id) : [])];
      for (const id of ids) {
        sb += numbers(d.textures?.(id, 0.31, 0.27) ?? null) + numbers(d.textures?.(id, 0.77, 0.61) ?? null);
        sb += numbers(d.cubeTextures?.(id, 0.3, 0.8, -0.5) ?? null) + numbers(d.cubeTextures?.(id, -0.9, -0.2, 0.4) ?? null);
      }
    }
    sb += "\n";
  }
  for (const op of scene.ops.slice(0, scene.setupOps)) {
    if (op instanceof ClearOp) sb += `clear ${op.beforeDraw} ${op.target ?? ""} ${numbers(op.color)} ${op.depth === null ? "" : formatDouble(op.depth)} ${op.stencil ?? ""} ${op.attachment ?? ""}`;
    else if (op instanceof CopyOp) sb += `copy ${op.beforeDraw} ${op.from ?? ""} ${op.to ?? ""} ${yes(op.color)} ${yes(op.depth)} ${yes(op.average)}`;
    else sb += String(op);
    sb += "\n";
  }
  for (const t of [...scene.targets.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) sb += t.toString() + "\n";
  return (scene.setupKey = sb);
}

const toByteColor = (v: number): number => toByte(roundEven(clamp(Number.isNaN(v) ? 0 : v, 0, 1) * 255));

function primitives(order: number[], topology: Topology): number[][] {
  const list: number[][] = [];
  switch (topology) {
    case Topology.Triangles:
      for (let i = 0; i + 2 < order.length; i += 3) list.push([order[i]!, order[i + 1]!, order[i + 2]!]);
      break;
    case Topology.TriangleStrip:
      for (let i = 0; i + 2 < order.length; i++) list.push(i % 2 === 0 ? [order[i]!, order[i + 1]!, order[i + 2]!] : [order[i + 1]!, order[i]!, order[i + 2]!]);
      break;
    case Topology.TriangleFan:
      for (let i = 1; i + 1 < order.length; i++) list.push([order[0]!, order[i]!, order[i + 1]!]);
      break;
    case Topology.Lines:
      for (let i = 0; i + 1 < order.length; i += 2) list.push([order[i]!, order[i + 1]!]);
      break;
    case Topology.LineStrip:
      for (let i = 0; i + 1 < order.length; i++) list.push([order[i]!, order[i + 1]!]);
      break;
    case Topology.Points:
      for (const i of order) list.push([i]);
      break;
  }
  return list;
}

/**
 * Clips a triangle against the near plane in clip space, as the GPU does, so geometry crossing the camera's near plane
 * is cut instead of dropped.
 */
function clipNear(a: ShadedVertex, b: ShadedVertex, c: ShadedVertex, zMinusOneToOne: boolean): [ShadedVertex, ShadedVertex, ShadedVertex][] {
  const input = [a, b, c];
  if (input.every((v) => nearDistance(v, zMinusOneToOne) >= 0)) return [[a, b, c]];
  if (input.every((v) => nearDistance(v, zMinusOneToOne) < 0)) return [];
  const poly: ShadedVertex[] = [];
  for (let i = 0; i < 3; i++) {
    const cur = input[i]!;
    const next = input[(i + 1) % 3]!;
    const dc = nearDistance(cur, zMinusOneToOne), dn = nearDistance(next, zMinusOneToOne);
    if (dc >= 0) poly.push(cur);
    if (dc >= 0 !== dn >= 0) poly.push(lerp(cur, next, dc / (dc - dn)));
  }
  const result: [ShadedVertex, ShadedVertex, ShadedVertex][] = [];
  for (let i = 1; i + 1 < poly.length; i++) result.push([poly[0]!, poly[i]!, poly[i + 1]!]);
  return result;
}

function clipNearLine(a: ShadedVertex, b: ShadedVertex, zMinusOneToOne: boolean): [ShadedVertex, ShadedVertex][] {
  const da = nearDistance(a, zMinusOneToOne), db = nearDistance(b, zMinusOneToOne);
  if (da >= 0 && db >= 0) return [[a, b]];
  if (da < 0 && db < 0) return [];
  const cut = lerp(a, b, da / (da - db));
  return da >= 0 ? [[a, cut]] : [[cut, b]];
}

function lerp(a: ShadedVertex, b: ShadedVertex, t: number): ShadedVertex {
  const clip = new Array<number>(4);
  for (let i = 0; i < 4; i++) clip[i] = a.clip[i]! + (b.clip[i]! - a.clip[i]!) * t;
  const outputs = new Map<string, ShaderValue>();
  for (const [k, va] of a.outputs) {
    const vb = b.outputs.get(k);
    outputs.set(k, vb !== undefined ? mix(va, vb, 1 - t, t) : va);
  }
  return new ShadedVertex(clip, outputs, a.pointSize);
}

/** a·wa + b·wb for numbers, fields and array items (other values: a's). */
function mix(a: ShaderValue, b: ShaderValue, wa: number, wb: number): ShaderValue {
  const av = a.v, bv = b.v;
  if (av !== null && !a.isMatrix && bv !== null) {
    const r = new Array<number>(av.length);
    for (let i = 0; i < r.length; i++) r[i] = wa * av[i]! + wb * bv[Math.min(i, bv.length - 1)]!;
    return Value.vecOf(r);
  }
  if (a.fields !== null && b.fields !== null) {
    const fields = new Map<string, ShaderValue>();
    for (const [k, v] of a.fields) {
      const fb = b.fields.get(k);
      fields.set(k, fb !== undefined ? mix(v, fb, wa, wb) : v);
    }
    return Value.struct(fields);
  }
  const ai = a.items, bi = b.items;
  if (ai !== null && bi !== null && ai.length === bi.length) return Value.array(ai.map((x, i) => mix(x, bi[i]!, wa, wb)));
  return a;
}

/**
 * The set-up primitives of a draw waiting for their fragments, in draw order. run() shades them (C# shades a large batch
 * on every core, each pixel meeting the primitives in draw order – the same result as shading them in order here).
 */
class FragmentBatch {
  /** Primitives per batch: enough to keep the cores busy, few enough to bound what they hold on to. */
  private static readonly MaxPrimitives = 1024;

  private readonly fills: Fill[] = [];

  constructor(private readonly stages: Stages, private readonly height: number) {}

  add(fill: Fill | null): void {
    if (fill === null) return;
    this.fills.push(fill);
    if (this.fills.length >= FragmentBatch.MaxPrimitives) this.run();
  }

  /** Shades the waiting primitives; a shader error is thrown where it is met. */
  run(): void {
    if (this.fills.length === 0) return;
    try {
      for (const fill of this.fills) fill(this.stages, 0, this.height);
    } finally {
      this.fills.length = 0;
    }
  }
}

function drawOne(draw: DrawCall, time: number, fb: Framebuffer, scale: number, yDown: boolean, zMinusOneToOne: boolean, layers: ((layer: number) => Framebuffer) | null = null): void {
  const baseFb = fb;
  const uniforms = draw.uniforms(time);
  const textures = TextureReads.of(draw);
  const stages = new Stages(draw, uniforms, textures, time, baseFb.height, scale, yDown);
  // The vertex and geometry stages run here, in order; the fragments of the primitives they make are shaded in batches.
  const fragments = new FragmentBatch(stages, baseFb.height);
  try {
    for (let instance = 0; instance < Math.max(1, draw.instances); instance++) {
      const order = draw.indices ?? Array.from({ length: Math.max(0, draw.count) }, (_, i) => draw.first + i);
      const cache = new Map<number, ShadedVertex>();
      const vertex = (index: number): ShadedVertex => {
        let v = cache.get(index);
        if (v === undefined) {
          v = stages.vertex(index, instance);
          cache.set(index, v);
        }
        return v;
      };
      // Tessellation: each patch of control points becomes the primitives the tessellator makes. (A generator, as the
      // C# iterator: the vertices of a primitive are shaded when it is assembled.)
      const assembled = function* (): Generator<[Topology, ShadedVertex[]]> {
        if (stages.hasTessellation) {
          const size = Math.max(1, draw.patchVertices);
          for (let p = 0; p + size <= order.length; p += size) {
            for (const made of stages.tessellate(order.slice(p, p + size).map(vertex), Math.trunc(p / size))) yield made;
          }
          return;
        }
        for (const primitive of primitives(order, draw.topology)) yield [kindOf(draw.topology), primitive.map(vertex)];
      };
      for (const [assembledKind, input] of assembled()) {
        const output: [Topology, ShadedVertex[]][] = stages.hasGeometry ? stages.geometry(input) : [[assembledKind, input]];
        for (const [kind, v] of output) {
          // A geometry shader may send the primitive to a layer of a layered target (gl_Layer).
          fb = v[0]!.layer !== 0 && layers !== null ? layers(v[0]!.layer) : baseFb;
          switch (kind) {
            case Topology.Points:
              fragments.add(point(v[0]!, draw, fb, scale, yDown, zMinusOneToOne).fill);
              break;
            case Topology.Lines:
              for (const [p, q] of clipNearLine(v[0]!, v[1]!, zMinusOneToOne)) fragments.add(line(p, q, draw, fb, yDown, zMinusOneToOne).fill);
              break;
            default:
              for (const [p, q, r] of clipNear(v[0]!, v[1]!, v[2]!, zMinusOneToOne)) fragments.add(triangle(p, q, r, draw, fb, yDown, zMinusOneToOne).fill);
              break;
          }
        }
      }
    }
  } catch (e) {
    // An error in the vertex or geometry stage comes after the fragments of the primitives before it.
    fragments.run();
    throw e;
  }
  fragments.run();
}

/**
 * The simulated GPU: runs the vertex shader on every vertex (and a geometry shader on every primitive), assembles
 * triangles, lines and points, culls, rasterises them with perspective-correct interpolation and runs the fragment
 * shader per pixel, then the per-sample tests and blending (Rasterizer.Fragments.ts). The window and every off-screen
 * target is a Framebuffer; a target drawn earlier in the frame can be sampled as a texture.
 */
export const Rasterizer = {
  /**
   * The image of a render target as drawn so far in the frame being rendered (null outside a render): its colour
   * attachment, or its depth (shadow maps).
   */
  targetImage(id: string, attachment = 0, depth = false): Image | null {
    return currentContext()?.image(id, attachment, depth) ?? null;
  },

  /** Renders one frame of a scene at a width in pixels (the height follows the window's aspect ratio). */
  render(scene: Scene, width: number, time = 1.0): Frame {
    // A program that reads the clock is read again at that time (its uniforms, transforms … change).
    const original = scene;
    if (scene.animated && scene.atTime !== null && time !== 1.0) scene = scene.atTime(time);
    const height = Math.max(1, toInt(roundEven((width * scene.height) / Math.max(1, scene.width))));
    const scale = scene.width / width;
    const errors: string[] = [];
    const yDown = scene.api === Apis.Vulkan;
    const zMinusOneToOne = scene.api === Apis.OpenGL;

    const window = new Framebuffer(width, height, scene.samples);
    window.clear(scene.clearColor ?? [0, 0, 0, 1], 1.0, 0);
    const targets = new Map<string, Framebuffer>();
    const setupFamilies = setupTargets(scene);
    // What the program draws once before its render loop (an environment captured into a cube map, a look-up table) is
    // drawn for the first frame and kept for the next ones, as the program keeps it.
    const setupOwner = original;
    // Kept on the scene, or – for another scene with the same setup (the program built again: the same passes) – in a
    // small cache shared by all scenes.
    if (scene.setupDraws > 0 && setupOwner.setupCache === null) {
      const shared = SharedSetups.get(setupKey(scene));
      if (shared !== undefined) setupOwner.setupCache = shared;
    }
    const setup = setupOwner.setupCache as SetupResult | null;
    const setupDone = scene.setupDraws > 0 && setup !== null && (setup.width === 0 || setup.width === width) && setup.draws === scene.setupDraws;
    if (setupDone) {
      for (const [id, kept] of setup!.targets) targets.set(id, kept);
      errors.push(...setup!.errors);
    }
    const fbOf = (id: string | null): Framebuffer => {
      if (id === null) return window;
      let fb = targets.get(id);
      if (fb === undefined) {
        // A layer of a layered target ("id@3": a cube map's face) has the target's size and format.
        const t = scene.targets.get(baseOf(id)) ?? new RenderTarget(id);
        // What is drawn once before the render loop has the same size at every preview size (so it can be kept between
        // frames, and a cube map's mip levels halve exactly): its own size – or a quarter of it when its shader loops
        // over many samples per pixel (a convolution, a pre-filter), which the simulator's CPU could not afford at full
        // size. The frame's own targets follow the preview's scale.
        let w: number, h: number;
        const heavy = setupFamilies.get(family(id));
        if (heavy !== undefined) {
          // (A small mip level keeps its own size up to 8 texels: a pre-filter's 4 × 4 level stays 4 × 4.)
          w = t.width > 0 ? (heavy ? Math.max(Math.min(t.width, 8), Math.trunc(t.width / HeavySetupDivisor)) : t.width) : width;
          h = t.height > 0 ? (heavy ? Math.max(Math.min(t.height, 8), Math.trunc(t.height / HeavySetupDivisor)) : t.height) : height;
        } else {
          w = t.width > 0 ? Math.max(1, toInt(roundEven(t.width / scale))) : width;
          h = t.height > 0 ? Math.max(1, toInt(roundEven(t.height / scale))) : height;
        }
        // A depth buffer shared with another target is that target's own.
        const depthOf = t.depthOf !== null && t.depthOf !== id ? fbOf(t.depthOf) : null;
        fb = new Framebuffer(w, h, t.samples, t.float, t.colorAttachments, depthOf);
        fb.hasDepth = t.depth || depthOf !== null;
        fb.channels = t.channels;
        targets.set(id, fb);
      }
      return fb;
    };
    // The size in the program's own pixels (gl_FragCoord) of a target.
    const logicalWidth = (id: string | null): number => {
      const t = id !== null ? scene.targets.get(baseOf(id)) : undefined;
      return t !== undefined && t.width > 0 ? t.width : scene.width;
    };
    const logicalSize = (id: string): [number, number] => {
      const t = scene.targets.get(baseOf(id));
      return t !== undefined ? [t.width > 0 ? t.width : scene.width, t.height > 0 ? t.height : scene.height] : [scene.width, scene.height];
    };

    const previous = currentContext();
    const context = new RenderContext((id) => fbOf(id), zMinusOneToOne, logicalSize);
    setCurrentContext(context);
    try {
      // The ops of the setup draws are the first setupOps of the list; the frame's own follow.
      const ops = (when: (beforeDraw: number) => boolean, ofSetup = false): void => {
        const setupOps = Math.min(scene.setupOps, scene.ops.length);
        for (const op of (ofSetup ? scene.ops.slice(0, setupOps) : scene.ops.slice(setupOps)).filter((o) => when(o.beforeDraw))) {
          if (op instanceof ClearOp) {
            fbOf(op.target).clear(op.color, op.depth, op.stencil, op.attachment);
            // A layered target is cleared in every layer.
            const layered = op.target !== null ? scene.targets.get(op.target) : undefined;
            if (op.target !== null && layered !== undefined && layered.layers > 1)
              for (let l = 1; l < layered.layers; l++) fbOf(op.target + "@" + l).clear(op.color, op.depth, op.stencil, op.attachment);
            context.changed(op.target);
          } else if (op instanceof CopyOp) {
            fbOf(op.to).copyFrom(fbOf(op.from), op.color, op.depth, op.average);
            context.changed(op.to);
          }
        }
      };
      const setupDraws = Math.min(scene.setupDraws, scene.draws.length);
      for (let i = setupDone ? setupDraws : 0; i < scene.draws.length; i++) {
        const at2 = i;
        if (i < setupDraws) ops((b) => b === at2, true);
        else {
          if (i === setupDraws && setupDraws > 0 && !setupDone) {
            // The setup is over: its last ops (mip levels made after the last capture), then it is kept.
            ops((b) => b >= setupDraws, true);
            keepSetup(setupOwner, scene, width, targets, errors);
          }
          ops((b) => b === at2);
        }
        const draw = scene.draws[i]!;
        const fb = fbOf(draw.target);
        try {
          const target = draw.target;
          drawOne(draw, time, fb, logicalWidth(draw.target) / fb.width, yDown, zMinusOneToOne, (layer) => {
            const lt = target !== null ? scene.targets.get(target) : undefined;
            return layer <= 0 || target === null || lt === undefined || !(lt.layers > 1) || layer >= lt.layers ? fb : fbOf(target + "@" + layer);
          });
        } catch (e) {
          if (!(e instanceof ShaderRuntimeException)) throw e;
          errors.push(e.line > 0 ? `line ${e.line}: ${e.message}` : e.message);
        }
        context.changed(draw.target);
        // The depth it shares with another target was drawn into too.
        const sharedDepth = draw.target !== null ? (scene.targets.get(draw.target)?.depthOf ?? null) : null;
        if (sharedDepth !== null) context.changed(sharedDepth);
      }
      const count = scene.draws.length;
      ops((b) => b >= count);
    } finally {
      setCurrentContext(previous);
    }

    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let c = window.resolved(x, y);
        if (scene.windowSrgb) c = [SrgbCurve.fromLinear(c[0]!), SrgbCurve.fromLinear(c[1]!), SrgbCurve.fromLinear(c[2]!), c.length > 3 ? c[3]! : 1];
        const i = (y * width + x) * 4;
        pixels[i] = toByteColor(c[2]!);
        pixels[i + 1] = toByteColor(c[1]!);
        pixels[i + 2] = toByteColor(c[0]!);
        pixels[i + 3] = 255;
      }
    return new Frame(width, height, pixels, errors);
  },

  /**
   * Runs a compute shader over `groups` work groups with the uniforms (by name, as for draws), the storage images by
   * the shader's names for them, and the textures it samples. Returns the errors it ran into.
   */
  dispatch,
};
