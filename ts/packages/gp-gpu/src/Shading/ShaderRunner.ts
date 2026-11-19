// ShaderRunner.cs, ShaderRunner.Expressions.cs, ShaderRunner.Builtins.cs, ShaderRunner.Matrices.cs and
// ShaderRunner.CppLibrary.cs: one class, its parts in the order of the C# files.
import {
  and64, clamp, formatCustom, formatE, formatFixed, formatG, hex64, isUpper, isWhiteSpace, notU32, or64, roundEven, sar64, shl32, sign, toChar,
  toInt, toLong, toLongBig, toUint, trimChars, tryParseDouble, tryParseInt, xor64,
} from "../internal/dotnet.js";
// libm: sin, cos, pow … as C#'s Math.Sin, Math.Pow … compute them on Linux (glibc), instead of V8's Math.* (see internal/libm.ts).
import * as libm from "../internal/libm.js";
import { FreeTypeGlyphs, type Glyph } from "../Fonts/FreeTypeGlyphs.js";
import { GltfModel } from "../Models/GltfModel.js";
import type { Image } from "../Textures/Image.js";
import { Texture } from "../Textures/Texture.js";
import { GlibcRandom } from "./GlibcRandom.js";
import { MapIterator } from "./MapIterator.js";
import * as A from "./ShaderAst.js";
import { ShaderRuntimeException } from "./ShaderErrors.js";
import { ShaderParser } from "./ShaderParser.js";
import { ShaderProgram } from "./ShaderProgram.js";
import { componentCount, matrixSize, swizzle } from "./ShaderTypes.js";
import { ShaderValue } from "./ShaderValue.js";
import { SortedMap } from "./SortedMap.js";

/** How a statement left: C#'s Flow record struct. */
interface Flow {
  readonly returned: boolean;
  readonly value: ShaderValue | null;
  readonly discarded: boolean;
  readonly broke: boolean;
  readonly continued: boolean;
}

/** default(Flow): the next statement runs. */
const Next: Flow = Object.freeze({ returned: false, value: null, discarded: false, broke: false, continued: false });
const DiscardFlow: Flow = Object.freeze({ returned: false, value: null, discarded: true, broke: false, continued: false });
const BreakFlow: Flow = Object.freeze({ returned: false, value: null, discarded: false, broke: true, continued: false });
const ContinueFlow: Flow = Object.freeze({ returned: false, value: null, discarded: false, broke: false, continued: true });
const returnFlow = (value: ShaderValue | null): Flow => ({ returned: true, value, discarded: false, broke: false, continued: false });
/** The statements after this one in the block do not run. */
const leaves = (f: Flow): boolean => f.returned || f.discarded || f.broke || f.continued;

/** A runtime error is caught where the C# code catches ShaderRuntimeException; anything else goes on. */
function isRuntime(e: unknown): e is ShaderRuntimeException {
  return e instanceof ShaderRuntimeException;
}

/** IEnumerable&lt;double&gt;.SequenceEqual: element by element with double.Equals (NaN equals NaN). */
export function sequenceEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (x !== y && !(Number.isNaN(x) && Number.isNaN(y))) return false;
  }
  return true;
}

/** The properties the C# code sets with an object initializer (`new ShaderRunner(p) { Lenient = true, … }`). */
export type ShaderRunnerInit = Partial<Pick<ShaderRunner,
  "resolve" | "pointerRead" | "imageLoad" | "imageStore" | "imageSize" | "sample" | "sampleCube" | "sampleCubeLod" | "footprint" | "textureImage"
  | "emit" | "time" | "usedTime" | "lenient" | "hook" | "depthZeroToOne" | "elementDefault" | "readText" | "readBytes" | "output">>;

/** A texture footprint: (du/dx, dv/dx, du/dy, dv/dy). */
export type Footprint = readonly [number, number, number, number];

const FloatMath = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "exp2", "log", "log2", "sqrt", "pow", "fabs", "floor", "ceil", "round", "trunc", "fmod"]);

/**
 * Steps per run: the C++ program's setup may loop over hundreds of objects (learnopengl's 500 asteroids), and a
 * shader that integrates over a hemisphere takes a thousand samples per pixel (an irradiance convolution).
 */
const MaxSteps = 400000;

/**
 * C++ mode: a frame of the program is one run (PopulateCommandList walking a scene graph of a hundred entities, each
 * tested against the frustum's planes) – it may take far more steps than a shader.
 */
const LenientMaxSteps = 40_000_000;

/** Vectors of numbers this long or longer are kept packed (ShaderValue.packed). */
const PackedFrom = 256;

const LambdaMark = "__lambda#";

// Comparisons give 1 or 0; like a literal, the value is never changed in place.
const True = ShaderValue.scalar(1), False = ShaderValue.scalar(0);

const StreamText = "__text", StreamPos = "__pos", StreamOk = "__ok", ConsoleMark = "__console";

const ConsoleValue = ShaderValue.struct(new Map([[ConsoleMark, ShaderValue.scalar(1)]]));

const isConsole = (v: ShaderValue): boolean => v.fields !== null && v.fields.has(ConsoleMark);
const isStream = (v: ShaderValue): boolean => v.fields !== null && v.fields.has(StreamText);

function newStream(text: string | null): ShaderValue {
  return ShaderValue.struct(new Map([
    [StreamText, ShaderValue.str(text ?? "")],
    [StreamPos, ShaderValue.scalar(0)],
    [StreamOk, ShaderValue.scalar(text === null ? 0 : 1)],
  ]));
}

/**
 * Runs a parsed shader (or evaluates a C++ expression): globals, user functions, statements and the built-in
 * functions. Names it does not know are asked of `resolve` (the C++ side uses it for its variables), and textures are
 * read through `sample`.
 */
export class ShaderRunner {
  private readonly scopes: Map<string, ShaderValue>[] = [];
  private steps = 0;

  // A block's variables live in a dictionary; a loop body runs thousands of times per pixel, so the dictionaries are
  // used again instead of made anew.
  private readonly freeScopes: Map<string, ShaderValue>[] = [];

  private rentScope(): Map<string, ShaderValue> {
    return this.freeScopes.pop() ?? new Map<string, ShaderValue>();
  }

  private popScope(): void {
    const scope = this.scopes.pop()!;
    scope.clear();
    if (this.freeScopes.length < 64) this.freeScopes.push(scope);
  }

  /** The shader's globals: inputs, outputs, uniforms and constants (and gl_Position …). */
  readonly globals = new Map<string, ShaderValue>();

  /** Asked for names the shader does not declare (null: unknown name). */
  resolve: ((id: string) => ShaderValue | null) | null = null;

  /**
   * C++ mode: the byte at an offset into memory a handle names (the pixels stbi_load returned), or null when the
   * handle names no bytes – so pointer arithmetic and reads through the pointer (pixelOffset[0]) work.
   */
  pointerRead: ((handle: string, offset: number) => number | null) | null = null;

  /**
   * Storage images of a compute shader (GLSL image2D, HLSL RWTexture2D): read a texel, write a texel (RGBA), the
   * size – by the image's name.
   */
  imageLoad: ((name: string, x: number, y: number) => number[] | null) | null = null;
  imageStore: ((name: string, x: number, y: number, value: number[]) => void) | null = null;
  imageSize: ((name: string) => [number, number] | null) | null = null;

  /** The program's HLSL read-write textures (RWTexture2D&lt;float4&gt; tex): tex[xy] reads and writes texels. */
  private rwTextures: Set<string> | null = null;

  private isRwTexture(e: A.Expr): boolean {
    if (!(e instanceof A.Name)) return false;
    this.rwTextures ??= new Set(this.program.globals.filter((g) => g.type.startsWith("RWTexture")).map((g) => g.id));
    return this.rwTextures.has(e.id);
  }

  /** Reads a texture: (texture or sampler name, u, v) → RGBA. */
  sample: ((name: string, u: number, v: number) => number[]) | null = null;

  /** Reads a cube map: (name, direction) → RGBA, or null when the name is not a cube map. */
  sampleCube: ((name: string, x: number, y: number, z: number) => number[] | null) | null = null;

  /** Reads a cube map at a mip level (textureLod, SampleLevel): (name, direction, lod) → RGBA, or null. */
  sampleCubeLod: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null = null;

  /**
   * The screen-space derivatives of texture coordinates (u, v) where the fragment being shaded reads them – what a GPU
   * picks a mip level from: (du/dx, dv/dx, du/dy, dv/dy), or null when not known.
   */
  footprint: ((u: number, v: number) => Footprint | null) | null = null;

  /** The image a sampler reads, for its size (textureSize(), texelFetch()): name → image. */
  textureImage: ((name: string) => Image | null) | null = null;

  /** Geometry shaders: EmitVertex() / EndPrimitive() (GLSL), stream.Append(v) / stream.RestartStrip() (HLSL). */
  emit: ((kind: string, value: ShaderValue | null) => void) | null = null;

  /** The value of glfwGetTime() and friends, in seconds. */
  time = 1.0;

  /** Set when the clock was read (the result changes over time). */
  usedTime = false;

  /**
   * C++ mode: a statement that fails is skipped, and a call the runner does not know goes to `hook` (the API calls)
   * and otherwise gives 0.
   */
  lenient = false;

  /** Calls the runner does not know (C++ mode): name (".Method" for methods; args[0] is then the object), arguments. */
  hook: ((name: string, args: readonly A.Expr[]) => ShaderValue | null) | null = null;

  /** GLM_FORCE_DEPTH_ZERO_TO_ONE: glm::perspective maps depth to 0..1 (Vulkan) instead of -1..1. */
  depthZeroToOne = false;

  /** C++ mode: the zero value of a std::vector's elements, from the variable's declaration (or null). */
  elementDefault: ((e: A.Expr) => ShaderValue | null) | null = null;

  /** C++ mode: a text file of the project by its path (std::ifstream), or null when it does not exist. */
  readText: ((path: string) => string | null) | null = null;

  /** C++ mode: a file of the project as bytes (a font for FreeType), or null. */
  readBytes: ((path: string) => Uint8Array | null) | null = null;

  /** C++ mode: each line the program writes to std::cout / std::cerr. */
  output: ((line: string) => void) | null = null;

  private console = "";

  /** Evaluates an argument inside a hook (does not restart the step count). */
  evalArg(e: A.Expr): ShaderValue {
    return this.eval(e);
  }

  /** Runs C++ statements at the top level: what they declare becomes a global. */
  runStatements(body: readonly A.Stmt[]): void {
    this.steps = 0;
    this.scopes.push(this.globals);
    try {
      for (const s of body) {
        try {
          const flow = this.exec(s);
          if (flow.returned) return;
        } catch (e) {
          if (!isRuntime(e) || !this.lenient) throw e;
        }
      }
    } finally {
      this.scopes.pop();
    }
  }

  /**
   * C++ mode: runs a function body of the program with its parameters in a scope of their own, statement by statement
   * (one that fails is skipped). Returns the return value and the parameters' values at the end (the caller writes
   * reference parameters back).
   */
  runBody(body: readonly A.Stmt[], parameters: Map<string, ShaderValue>): { value: ShaderValue | null; scope: Map<string, ShaderValue> } {
    const scope = new Map(parameters);
    this.scopes.push(scope);
    try {
      for (const s of body) {
        try {
          const flow = this.exec(s);
          if (flow.returned) return { value: flow.value, scope };
        } catch (e) {
          if (!isRuntime(e) || !this.lenient) throw e;
        }
      }
      return { value: null, scope };
    } finally {
      this.scopes.pop();
    }
  }

  /** Assigns to a variable, member or element (for hooks that write through an out-parameter). */
  assign(target: A.Expr, value: ShaderValue): void {
    this.store(target, value);
  }

  private get stepLimit(): number {
    return this.lenient ? LenientMaxSteps : MaxSteps;
  }

  private random: GlibcRandom | null = null;

  constructor(private readonly program: ShaderProgram, init?: ShaderRunnerInit) {
    for (const g of program.globals) {
      if (g.block !== null) {
        // Uniform blocks: fields are globals (cbuffer, GLSL block without instance) or members of the instance.
        const fields = toDictionary(g.block, (f) => f.id, (f) => this.default(f.type, f.arraySize));
        if (g.id === "") for (const [k, v] of fields) this.globals.set(k, v);
        else this.globals.set(g.id, ShaderValue.struct(fields));
        continue;
      }
      this.globals.set(g.id, g.value !== null ? this.coerce(g.type, this.eval(g.value)) : this.default(g.type, g.arraySize));
    }
    // The object initializer runs after the constructor, as in C#.
    if (init) Object.assign(this, init);
  }

  /** A fresh runner for an expression with no shader around it (C++ values). */
  static forExpressions(resolve: (id: string) => ShaderValue | null, time = 1.0, program?: ShaderProgram): ShaderRunner {
    return new ShaderRunner(program ?? new ShaderProgram(), { resolve, time });
  }

  private isPackable(type: string): boolean {
    return this.program.findStruct(type) === null && matrixSize(type) === 0 && (componentCount(type) === 1 || ShaderValue.isIntType(type)) && type !== "bool" && type !== "string";
  }

  /**
   * A declared variable's zero value; in C++ mode a struct the runner does not know (D3D12_RESOURCE_DESC desc = {};)
   * is an empty struct that takes the fields assigned to it.
   */
  private lenientDefault(type: string, arraySize: number): ShaderValue {
    if (this.lenient && arraySize === 0) {
      const stream = ShaderRunner.emptyStream(type);
      if (stream !== null) return stream;
    }
    // A large vector of numbers (a CPU-filled texture's floats): packed.
    if (this.lenient && arraySize >= PackedFrom && this.isPackable(type)) return ShaderValue.packedArray(new Array<number>(arraySize).fill(0), ShaderValue.isIntType(type));
    if (this.lenient && arraySize > 0) return ShaderValue.array(range(arraySize, () => this.lenientDefault(type, 0)));
    const v = this.default(type, arraySize);
    return this.lenient && v.text !== null ? ShaderValue.struct(new Map()) : v;
  }

  /** An array value as elements of a struct type of the program (for globals read from their initializers). */
  asStructArray(type: string, value: ShaderValue): ShaderValue {
    return this.structItems(type, value);
  }

  /**
   * The elements of an array of a struct type, as structs: { {x, y, z}, {} } fills the fields in order and a missing
   * or empty one is zero (C++ aggregate initialisation) – so a Vertex array keeps its layout when copied.
   */
  private structItems(type: string, value: ShaderValue): ShaderValue {
    const st = this.program.findStruct(type);
    const items = value.items;
    if (st === null || items === null) return value;
    return ShaderValue.array(items.map((item) => this.asStruct(st, item)));
  }

  private asStruct(st: A.Struct, item: ShaderValue): ShaderValue {
    if (item.fields !== null) return item;
    const parts = item.items ?? (item.v !== null && item.v.length > 0 ? item.v.map((x) => ShaderValue.scalar(x)) : []);
    const fields = new Map<string, ShaderValue>();
    for (let i = 0; i < st.fields.length; i++) {
      const f = st.fields[i]!;
      const part = i < parts.length ? parts[i]! : null;
      fields.set(f.id, part === null || (part.v !== null && part.v.length === 0) || (part.items !== null && part.items.length === 0) ? this.fieldDefault(f) : this.coerce(f.type, part));
    }
    return ShaderValue.struct(fields);
  }

  /** A struct member's first value: its default initialiser, else its type's zero value. */
  private fieldDefault(f: A.Field): ShaderValue {
    const init = f.default_;
    if (init !== null && f.arraySize === 0) {
      // C++: D3D12_VERTEX_BUFFER_VIEW view = {}: a zeroed struct of a type the program does not declare.
      if (this.lenient && init instanceof A.InitList && init.items.length === 0) return this.lenientDefault(f.type, 0);
      try {
        return this.coerce(f.type, this.eval(init)).clone();
      } catch (e) {
        if (!isRuntime(e)) throw e;
      }
    }
    return this.default(f.type, f.arraySize);
  }

  /** A zero value of a type (struct types get their fields). */
  default(type: string, arraySize = 0): ShaderValue {
    if (type === "map" || type === "unordered_map") return new ShaderValue({ map: new SortedMap<ShaderValue>() });
    // C++: an empty std::vector, an empty std::string.
    if (type === "vector" && arraySize === 0) return ShaderValue.array([]);
    if (type === "string" || type === "std::string" || type === "wstring") return ShaderValue.str("");
    // C++: a pointer member nothing was given (Model* pModel;) is null.
    if (this.lenient && type.endsWith("*")) return ShaderValue.str("nullptr");
    if (arraySize > 0) return ShaderValue.array(range(arraySize, () => this.default(type)));
    const s = this.program.findStruct(type);
    if (s !== null) return ShaderValue.struct(toDictionary(s.fields, (f) => f.id, (f) => this.fieldDefault(f)));
    const n = componentCount(type);
    const m = matrixSize(type);
    if (m > 0) return ShaderValue.identity(m);
    if (n === 1 && ShaderValue.isIntType(type)) return ShaderValue.integer(0);
    return n > 0 ? ShaderValue.vecOf(new Array<number>(n).fill(0)) : ShaderValue.str(type);
  }

  /** Calls a function of the shader with arguments; returns its return value (or null) and fills out-parameters. */
  call(id: string, args: readonly ShaderValue[]): ShaderValue | null {
    const f = this.program.findFunction(id);
    if (f === null) throw new ShaderRuntimeException(`no function '${id}'`, 0);
    this.steps = 0;
    return this.invoke(f, args);
  }

  evaluate(e: A.Expr): ShaderValue {
    this.steps = 0;
    return this.eval(e);
  }

  private invoke(f: A.Function, args: readonly ShaderValue[]): ShaderValue | null {
    const scope = this.rentScope();
    for (let i = 0; i < f.params.length; i++) {
      const p = f.params[i]!;
      scope.set(p.id, i < args.length ? this.coerce(p.type, args[i]!).clone() : this.default(p.type));
    }
    this.scopes.push(scope);
    try {
      const r = this.run(f.body);
      return r.returned ? (r.value === null ? null : this.coerce(f.returnType, r.value)) : null;
    } finally {
      this.popScope();
    }
  }

  /** True when the last fragment was discarded. */
  private discardedField = false;

  get discarded(): boolean {
    return this.discardedField;
  }

  /** Forgets a discard, before the next fragment. */
  clearDiscard(): void {
    this.discardedField = false;
  }

  private run(body: readonly A.Stmt[]): Flow {
    this.scopes.push(this.rentScope());
    try {
      for (let index = 0; index < body.length; index++) {
        const s = body[index]!;
        if (++this.steps > this.stepLimit) throw new ShaderRuntimeException("the shader runs too long for the simulator", s.line);
        let flow: Flow;
        try {
          flow = this.exec(s);
        } catch (e) {
          if (!isRuntime(e) || !this.lenient) throw e;
          continue;
        }
        if (leaves(flow)) return flow;
      }
      return Next;
    } finally {
      this.popScope();
    }
  }

  private top(): Map<string, ShaderValue> {
    return this.scopes[this.scopes.length - 1]!;
  }

  private exec(s: A.Stmt): Flow {
    switch (s.kind) {
      case "Declare":
        return this.execDeclare(s as A.Declare);
      case "Assign": {
        const a = s as A.Assign;
        let value = this.eval(a.value);
        // C++ copies a container given to another variable (a = b): push_back on one leaves the other as it was.
        if (this.lenient && a.op === "=" && (a.value instanceof A.Name || a.value instanceof A.Member || a.value instanceof A.IndexOf) && value.isArray && !value.shared) value = value.clone();
        if (a.op !== "=") value = this.binaryOp(a.op.slice(0, 1), this.eval(a.target), value, a.line);
        this.store(a.target, value);
        return Next;
      }
      case "Return": {
        const r = s as A.Return;
        return returnFlow(r.value === null ? null : this.eval(r.value));
      }
      case "Discard":
        this.discardedField = true;
        return DiscardFlow;
      case "Break":
        return BreakFlow;
      case "Continue":
        return ContinueFlow;
      case "If": {
        const i = s as A.If;
        return truthy(this.eval(i.condition)) ? this.run(i.then) : i.else_ !== null ? this.run(i.else_) : Next;
      }
      case "For": {
        const f = s as A.For;
        this.scopes.push(this.rentScope());
        try {
          if (f.init !== null) this.exec(f.init);
          for (let n = 0; f.condition === null || truthy(this.eval(f.condition)); n++) {
            // A shader's loop runs at most 1024 times here; the C++ program's (a CPU-filled texture's 480,000 texels)
            // as long as the step limit allows.
            if (n > (this.lenient ? 1 << 24 : 1024)) throw new ShaderRuntimeException("the loop runs too long for the simulator", f.line);
            const flow = this.run(f.body);
            if (flow.returned || flow.discarded) return flow;
            if (flow.broke) break;
            if (f.step !== null) this.exec(f.step);
          }
          return Next;
        } finally {
          this.popScope();
        }
      }
      case "ExprStmt":
        this.eval((s as A.ExprStmt).value);
        return Next;
      case "ForEach": {
        const fe = s as A.ForEach;
        const container = this.eval(fe.container);
        const items = container.items ?? container.map?.valuesInOrder() ?? container.v?.map((x) => ShaderValue.scalar(x))
          ?? (container.text !== null ? [...utf16(container.text)].map((code) => ShaderValue.integer(code)) : null) ?? [];
        this.scopes.push(this.rentScope());
        try {
          for (const item of items.slice(0, 4096)) {
            this.top().set(fe.id, item);
            const flow = this.run(fe.body);
            if (flow.returned || flow.discarded) return flow;
            if (flow.broke) break;
          }
          return Next;
        } finally {
          this.popScope();
        }
      }
      default:
        return Next;
    }
  }

  private execDeclare(d: A.Declare): Flow {
    if (d.static) {
      // A static local lives as long as the program: made once, then kept. It is made in the program's first frame
      // (time 0): static auto startTime = now() – the clock when the program started.
      const key = `${d.id}@${d.line}`;
      if (this.staticLocals.has(key)) return Next;
      this.staticLocals.add(key);
      const now = this.time;
      this.time = 0;
      try {
        this.globals.set(d.id, (d.value === null ? this.lenientDefault(d.type, d.arraySize) : this.coerce(d.type, this.eval(d.value))).clone());
      } finally {
        this.time = now;
      }
      return Next;
    }
    if (d.reference && d.value !== null && isObject(this.eval(d.value))) {
      // A reference to a struct or a container: the same object under another name.
      this.top().set(d.id, this.eval(d.value));
      this.pointers.delete(d.id);
      return Next;
    }
    if (d.pointer && d.value !== null && !d.isArray && isObject(this.eval(d.value))) {
      // A pointer to a struct or a container (Entity* last = &root): the object itself, not a copy.
      this.top().set(d.id, this.eval(d.value));
      this.pointers.add(d.id);
      return Next;
    }
    if (d.pointer) this.pointers.add(d.id);
    else this.pointers.delete(d.id);
    // C++: Type name{} / Type name = {} is a zero-initialised struct.
    const arraySize = d.sizeExpr !== null ? toInt(Math.max(0, Math.min(1 << 24, this.eval(d.sizeExpr).x))) : d.arraySize;
    if (d.fill !== null && d.sizeExpr !== null) {
      // std::vector<T> name(n, value): n copies of the value (numbers packed when there are many).
      const fill = this.coerce(d.type, this.eval(d.fill));
      this.top().set(d.id, arraySize >= PackedFrom && this.isPackable(d.type) && fill.v !== null && fill.v.length === 1
        ? ShaderValue.packedArray(new Array<number>(arraySize).fill(fill.x), ShaderValue.isIntType(d.type))
        : ShaderValue.array(range(arraySize, () => fill.clone())));
      return Next;
    }
    let given: ShaderValue[] | null = null;
    if (d.sizeExpr !== null && d.value instanceof A.InitList && d.value.items.length > 0) {
      given = this.eval(d.value).items;
      if (given !== null && given.length >= arraySize) given = null;
    }
    if (given !== null) {
      // std::array<VkImageView, 2> attachments = { a, b }: the elements given, the rest zero.
      const rest = range(arraySize - given.length, () => this.lenientDefault(d.type, 0));
      this.top().set(d.id, this.structItems(d.type, ShaderValue.array([...given, ...rest])).clone());
    } else if (d.value === null && d.sizeExpr !== null && arraySize === 0) this.top().set(d.id, ShaderValue.array([]));
    else if ((d.value instanceof A.InitList && d.value.items.length === 0) || (d.value === null && d.sizeExpr !== null)) this.top().set(d.id, this.lenientDefault(d.type, arraySize));
    else {
      let aggregate: ShaderValue | null = null;
      const initStruct = !d.isArray && d.value instanceof A.InitList ? this.program.findStruct(d.type) : null;
      if (initStruct !== null) {
        const listed = this.eval(d.value!);
        if (listed.items !== null || listed.v !== null) aggregate = this.asStruct(initStruct, listed).clone();
      }
      // C++ aggregate initialisation: Character ch = { texture, size, bearing, advance } – the fields in order.
      if (aggregate !== null) this.top().set(d.id, aggregate);
      else this.top().set(d.id, d.value === null ? this.lenientDefault(d.type, d.arraySize)
        : (d.isArray ? this.structItems(d.type, this.eval(d.value)) : this.coerce(d.type, this.eval(d.value))).clone());
    }
    return Next;
  }

  private readonly staticLocals = new Set<string>();

  /** The aiScenes Assimp::Importer::ReadFile gave, by path (and aiProcess_FlipUVs). */
  private readonly assimpScenes = new Map<string, ShaderValue>();

  /** C++: the variables declared as pointers – assigning to one points it at another object. */
  private readonly pointers = new Set<string>();

  private readonly lambdas: A.Lambda[] = [];

  /** Calls a lambda value with arguments (std::remove_if's predicate). */
  private invokeLambda(fn: ShaderValue, args: readonly ShaderValue[], line: number): ShaderValue {
    const t = fn.text;
    const index = t !== null && t.startsWith(LambdaMark) ? tryParseInt(t.slice(LambdaMark.length)) : null;
    if (index === null || index >= this.lambdas.length || index < 0) throw new ShaderRuntimeException("not a function", line);
    const lambda = this.lambdas[index]!;
    const parameters = new Map<string, ShaderValue>();
    for (let i = 0; i < lambda.params.length && i < args.length; i++) parameters.set(lambda.params[i]!, args[i]!);
    return this.runBody(lambda.body, parameters).value ?? ShaderValue.scalar(0);
  }

  private lookup(id: string, line: number): ShaderValue {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const v = this.scopes[i]!.get(id);
      if (v !== undefined) return v;
    }
    const g = this.globals.get(id);
    if (g !== undefined) return g;
    const r = this.resolve?.(id) ?? null;
    if (r !== null) return r;
    switch (id) {
      case "M_PI": case "PI": case "XM_PI":
        return ShaderValue.scalar(Math.PI);
      case "cout": case "std::cout": case "cerr": case "std::cerr":
        if (this.lenient) return ConsoleValue;
        break;
      case "endl": case "std::endl":
        if (this.lenient) return ShaderValue.str("\n");
        break;
      case "XM_2PI":
        return ShaderValue.scalar(2 * Math.PI);
      case "XM_PIDIV2":
        return ShaderValue.scalar(Math.PI / 2);
      case "XM_PIDIV4":
        return ShaderValue.scalar(Math.PI / 4);
      // <cfloat> / <climits>: the limits of the number types.
      case "FLT_MAX":
        return ShaderValue.scalar(3.4028234663852886e38);
      case "FLT_MIN":
        return ShaderValue.scalar(1.17549435e-38);
      case "FLT_EPSILON":
        return ShaderValue.scalar(1.1920929e-7);
      case "DBL_MAX":
        return ShaderValue.scalar(Number.MAX_VALUE);
      case "INT_MAX":
        return ShaderValue.integer(2147483647);
      case "INT_MIN":
        return ShaderValue.integer(-2147483648);
      case "UINT_MAX":
        return ShaderValue.integer(4294967295);
    }
    throw new ShaderRuntimeException(`'${id}' was not declared in this scope`, line);
  }

  /** Writes to a variable, a struct member, a swizzle or an array element. */
  private store(target: A.Expr, value: ShaderValue): void {
    if (target instanceof A.Name) {
      const n = target;
      // A pointer given another address (last = &last->children.back()) points there; the object it pointed at stays
      // as it was.
      const repoint = this.pointers.has(n.id);
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const scope = this.scopes[i]!;
        const current = scope.get(n.id);
        if (current !== undefined) {
          if (repoint) scope.set(n.id, value);
          else if (!this.assignInPlace(current, value)) scope.set(n.id, like(current, value));
          return;
        }
      }
      const old = this.globals.get(n.id);
      if (old !== undefined) {
        if (repoint) this.globals.set(n.id, value);
        else if (!this.assignInPlace(old, value)) this.globals.set(n.id, like(old, value));
      } else this.globals.set(n.id, value);
      return;
    }
    if (target instanceof A.Member) {
      const m = target;
      let owner: ShaderValue;
      try {
        owner = this.eval(m.target);
      } catch (e) {
        if (!(isRuntime(e) && this.lenient && (m.target instanceof A.Member || m.target instanceof A.IndexOf))) throw e;
        // C++ mode: a nested struct not set yet (imageInfo.extent.width = …).
        this.store(m.target, ShaderValue.struct(new Map()));
        owner = this.eval(m.target);
      }
      if (owner.fields !== null) {
        const old = owner.fields.get(m.field);
        owner.fields.set(m.field, old !== undefined ? like(old, value) : value);
        return;
      }
      // C++ mode: a placeholder of an API struct type (an element of std::vector<VkVertexInputAttributeDescription>
      // after resize) becomes a struct when the program sets one of its fields.
      const placeholder = owner.text;
      if (this.lenient && placeholder !== null && placeholder.length > 0 && isUpper(placeholder[0])
        && (m.target instanceof A.Name || m.target instanceof A.Member || m.target instanceof A.IndexOf)) {
        this.store(m.target, ShaderValue.struct(new Map([[m.field, value]])));
        return;
      }
      const idx = owner.v !== null ? swizzle(m.field) : null;
      if (owner.v !== null && idx !== null) {
        const src = value.v ?? [0];
        // A number (f.x = …) gets a new value: numbers are shared (a literal's value serves every use).
        if (owner.v.length === 1 && !owner.isMatrix && idx.length === 1 && idx[0] === 0) {
          this.store(m.target, owner.int ? ShaderValue.integer(Math.trunc(src[0]!)) : ShaderValue.scalar(src[0]!));
          return;
        }
        for (let k = 0; k < idx.length; k++) if (idx[k]! < owner.v.length) owner.v[idx[k]!] = src[Math.min(k, src.length - 1)]!;
        return;
      }
      throw new ShaderRuntimeException(`cannot assign to '.${m.field}'`, m.line);
    }
    if (target instanceof A.IndexOf) {
      const ix = target;
      if (ix.target instanceof A.IndexOf) {
        const inner = ix.target;
        const mat = this.eval(inner.target);
        if (mat.isMatrix) {
          // m[col][row] = x (proj[1][1] *= -1 in vulkan-tutorial).
          const col = toInt(Math.floor(this.eval(inner.at).x)), row = toInt(Math.floor(this.eval(ix.at).x));
          if (col < 0 || col >= mat.cols || row < 0 || row >= mat.cols) throw new ShaderRuntimeException("matrix index out of range", ix.line);
          mat.v![col * mat.cols + row] = value.x;
          return;
        }
      }
      if (this.imageStore !== null && this.isRwTexture(ix.target)) {
        // HLSL: imgOutput[texelCoord] = value – a texel of a read-write texture.
        const at = this.eval(ix.at).padded(2);
        this.imageStore((ix.target as A.Name).id, toInt(Math.floor(at[0]!)), toInt(Math.floor(at[1]!)), value.padded(4));
        return;
      }
      let owner: ShaderValue;
      try {
        owner = this.eval(ix.target);
      } catch (e) {
        if (!(isRuntime(e) && this.lenient && ix.target instanceof A.Name)) throw e;
        // C++ mode: an array member the runner has not seen (ComPtr<ID3D12Resource> m_renderTargets[FrameCount];).
        owner = ShaderValue.array([]);
        this.globals.set(ix.target.id, owner);
      }
      // The subscript is evaluated once (translations[index++] = …).
      const atValue = this.eval(ix.at);
      if (this.lenient && owner.items !== null && ix.target instanceof A.Name && atValue.x >= owner.items.length && atValue.x < 4096) {
        const old = owner.items;
        const items = [...old, ...range(toInt(atValue.x) + 1 - old.length, () => ShaderValue.scalar(0))];
        owner = ShaderValue.array(items);
        this.store(ix.target, owner);
      }
      if (owner.map !== null) {
        owner.map.set(ShaderValue.mapKey(atValue), value.clone());
        return;
      }
      const at = toInt(Math.floor(atValue.x));
      const packedNumbers = owner.packed;
      if (packedNumbers !== null) {
        if (at < 0 || at >= packedNumbers.length) throw new ShaderRuntimeException("array index out of range", ix.line);
        packedNumbers[at] = owner.packedInt ? Math.trunc(value.x) : value.x;
        return;
      }
      const items = owner.items;
      if (items !== null && at >= 0 && at < items.length) items[at] = value.int && !items[at]!.int ? ShaderValue.scalar(value.x) : value;
      else if (owner.v !== null && at >= 0 && at < owner.v.length && owner.cols === 0) owner.v[at] = value.x;
      else if (owner.isMatrix && at >= 0 && at < owner.cols) {
        for (let r = 0; r < owner.cols; r++) owner.v![at * owner.cols + r] = value.padded(owner.cols)[r]!;
      } else throw new ShaderRuntimeException("array index out of range", ix.line);
      return;
    }
    throw new ShaderRuntimeException("cannot assign to this expression", target.line);
  }

  /**
   * C++ mode: a struct variable given another struct keeps being the same object, its members replaced – so a
   * reference to it (a range-for's GameObject&amp; box, an element of a vector) sees the change.
   */
  private assignInPlace(current: ShaderValue, value: ShaderValue): boolean {
    const target = current.fields, source = value.fields;
    if (!this.lenient || current === value || target === null || source === null || isStream(current) || isConsole(current)) return current === value;
    const copied: [string, ShaderValue][] = [...source].map(([k, v]) => [k, v.clone()]);
    target.clear();
    for (const [k, v] of copied) target.set(k, v);
    return true;
  }

  // ---------- expressions: names, members and swizzles, indexing, operators and types (ShaderRunner.Expressions.cs) ----------

  private eval(e: A.Expr): ShaderValue {
    if (++this.steps > this.stepLimit * 10) throw new ShaderRuntimeException("the shader runs too long for the simulator", e.line);
    switch (e.kind) {
      case "Number": {
        // A number's value is never changed in place: one value per literal serves every evaluation.
        const n = e as A.Number;
        return (n.cached ??= n.integer ? ShaderValue.integer(n.value) : ShaderValue.scalar(n.value));
      }
      case "Name": {
        const n = e as A.Name;
        return this.lookup(n.id, n.line);
      }
      case "Member":
        return this.evalMember(e as A.Member);
      case "IndexOf":
        return this.evalIndex(e as A.IndexOf);
      case "Unary":
        return this.evalUnary(e as A.Unary);
      case "Binary": {
        const b = e as A.Binary;
        // C++: stream >> x reads the next word into x.
        if (this.lenient && (b.op === ">>" || b.op === "<<")) {
          const stream = this.eval(b.left);
          if (isStream(stream)) return b.op === ">>" ? this.streamRead(stream, b.right) : this.streamWrite(stream, this.eval(b.right));
          if (b.op === "<<" && isConsole(stream)) return this.consoleWrite(this.eval(b.right));
          return this.binaryOp(b.op, stream, this.eval(b.right), b.line);
        }
        if (b.op === "&&") return ShaderValue.scalar(truthy(this.eval(b.left)) && truthy(this.eval(b.right)) ? 1 : 0);
        if (b.op === "||") return ShaderValue.scalar(truthy(this.eval(b.left)) || truthy(this.eval(b.right)) ? 1 : 0);
        return this.binaryOp(b.op, this.eval(b.left), this.eval(b.right), b.line);
      }
      case "Conditional": {
        const c = e as A.Conditional;
        return truthy(this.eval(c.condition)) ? this.eval(c.then) : this.eval(c.else_);
      }
      case "InitList": {
        const items = (e as A.InitList).items.map((i) => this.eval(i));
        // { 1, 2, 3 } of scalars is a vector; anything else an array.
        if (items.every((i) => i.v !== null && i.v.length === 1) && items.length <= 4) return ShaderValue.vecOf(items.map((i) => i.x));
        // The elements' type is the array's, which the list does not know: plain numbers.
        return ShaderValue.array(items.map((i) => (i.int ? ShaderValue.scalar(i.x) : i)));
      }
      case "Call":
        return this.callExpr(e as A.Call);
      case "Lambda":
        if (this.lenient) {
          this.lambdas.push(e as A.Lambda);
          return ShaderValue.str(LambdaMark + (this.lambdas.length - 1));
        }
        break;
    }
    throw new ShaderRuntimeException("unsupported expression", e.line);
  }

  private evalMember(m: A.Member): ShaderValue {
    const owner = this.eval(m.target);
    const iter = owner.iterator;
    if (iter !== null && (m.field === "first" || m.field === "second")) {
      const cur = iter.current;
      if (cur === null) throw new ShaderRuntimeException("the iterator is at the end of the map", m.line);
      return m.field === "first" ? ShaderValue.fromMapKey(cur[0]) : cur[1];
    }
    if (owner.fields !== null) {
      const f = owner.fields.get(m.field);
      if (f === undefined) throw new ShaderRuntimeException(`no member named '${m.field}'`, m.line);
      return f;
    }
    // assimp's aiString: its text (mName.data).
    if (this.lenient && owner.text !== null && m.field === "data") return owner;
    // C++ mode: a descriptor handle held as a number (handle.ptr).
    if (this.lenient && m.field === "ptr" && owner.v !== null && owner.v.length === 1) return owner;
    // DirectXMath: an XMMATRIX's rows (m.r[0] … m.r[3]), an XMFLOAT4X4's elements (m._41: row 4, column 1).
    if (this.lenient && owner.isMatrix) {
      const part = matrixMember(owner, m.field);
      if (part !== null) return part;
    }
    const idx = owner.v !== null && !owner.isMatrix ? swizzle(m.field) : null;
    if (idx !== null) {
      const from = owner.v!;
      const picked = new Array<number>(idx.length);
      for (let k = 0; k < idx.length; k++) {
        if (idx[k]! >= from.length) throw new ShaderRuntimeException(`vector has no component '.${m.field}'`, m.line);
        picked[k] = from[idx[k]!]!;
      }
      return ShaderValue.vecOf(picked);
    }
    // .size() / .length() on arrays.
    throw new ShaderRuntimeException(`no member named '${m.field}'`, m.line);
  }

  private evalIndex(ix: A.IndexOf): ShaderValue {
    if (this.imageLoad !== null && this.isRwTexture(ix.target)) {
      const at = this.eval(ix.at).padded(2);
      return ShaderValue.vecOf(this.imageLoad((ix.target as A.Name).id, toInt(Math.floor(at[0]!)), toInt(Math.floor(at[1]!))) ?? [0, 0, 0, 0]);
    }
    const owner = this.eval(ix.target);
    if (owner.map !== null) {
      // map[key] of a key not there yet: a new element (C++ inserts a default value).
      const mapKey = ShaderValue.mapKey(this.eval(ix.at));
      const mv = owner.map.get(mapKey);
      if (mv !== undefined) return mv;
      return ShaderValue.scalar(0);
    }
    const at = toInt(Math.floor(this.eval(ix.at).x));
    if (this.lenient && owner.text !== null && this.pointerRead !== null) {
      const pointed = this.pointerRead(owner.text, owner.offset + at);
      if (pointed !== null) return ShaderValue.integer(pointed);
    }
    const packedNumbers = owner.packed;
    if (packedNumbers !== null) {
      if (at >= 0 && at < packedNumbers.length) return owner.packedInt ? ShaderValue.integer(packedNumbers[at]!) : ShaderValue.scalar(packedNumbers[at]!);
      throw new ShaderRuntimeException(`array index ${at} is out of range`, ix.line);
    }
    const items = owner.items;
    if (items !== null) {
      if (at >= 0 && at < items.length) return items[at]!;
      throw new ShaderRuntimeException(`array index ${at} is out of range`, ix.line);
    }
    if (owner.isMatrix) {
      if (at >= 0 && at < owner.cols) return ShaderValue.vecOf(owner.v!.slice(at * owner.cols, at * owner.cols + owner.cols));
      throw new ShaderRuntimeException(`matrix index ${at} is out of range`, ix.line);
    }
    if (owner.v !== null) {
      if (at >= 0 && at < owner.v.length) return ShaderValue.scalar(owner.v[at]!);
      throw new ShaderRuntimeException(`index ${at} is out of range`, ix.line);
    }
    throw new ShaderRuntimeException("this value cannot be indexed", ix.line);
  }

  private evalUnary(u: A.Unary): ShaderValue {
    if (u.op === "post++" || u.op === "post--" || u.op === "++" || u.op === "--") {
      const old = this.eval(u.operand);
      const it = old.iterator;
      if (it !== null) {
        const next = it.withPosition(it.position + (u.op.endsWith("++") ? 1 : -1));
        // A string's iterator carries its character as its number (*it).
        const moved = new ShaderValue({ iterator: next, v: old.v === null ? null : (next.current?.[1].v ?? null) });
        this.store(u.operand, moved);
        return u.op.startsWith("post") ? old : moved;
      }
      const changed = this.binaryOp(u.op.endsWith("++") ? "+" : "-", old, old.int ? ShaderValue.integer(1) : ShaderValue.scalar(1), u.line);
      this.store(u.operand, changed);
      return u.op.startsWith("post") ? old : changed;
    }
    const v = this.eval(u.operand);
    // C++: !pointer (if (!scene || !scene->mRootNode)).
    if (v.v === null && u.op === "!" && this.lenient) return ShaderValue.scalar(truthy(v) ? 0 : 1);
    if (v.v === null) throw new ShaderRuntimeException(`invalid operand to '${u.op}'`, u.line);
    switch (u.op) {
      case "-":
        return negated(v);
      case "~":
        return ShaderValue.integer(notU32(v.x));
      case "!":
        return ShaderValue.scalar(v.x === 0 ? 1 : 0);
      default:
        return v;
    }
  }

  private binaryOp(op: string, a: ShaderValue, b: ShaderValue, line: number): ShaderValue {
    // Numbers and vectors with + - * / and comparisons of two floats: what shaders do most.
    const av = a.v, bv = b.v;
    if (av !== null && bv !== null && a.cols === 0 && b.cols === 0 && !(a.int && b.int) && (av.length === bv.length || av.length === 1 || bv.length === 1) && av.length > 0 && bv.length > 0) {
      if (op.length === 1) {
        const o = op;
        if (o === "+" || o === "-" || o === "*" || o === "/") {
          const count = Math.max(av.length, bv.length);
          const r = new Array<number>(count);
          for (let i = 0; i < count; i++) {
            const x = av[av.length === 1 ? 0 : i]!, y = bv[bv.length === 1 ? 0 : i]!;
            r[i] = o === "+" ? x + y : o === "-" ? x - y : o === "*" ? x * y : y === 0 ? 0 : x / y;
          }
          return ShaderValue.vecOf(r);
        }
        if (o === "<" || o === ">") return (o === "<" ? av[0]! < bv[0]! : av[0]! > bv[0]!) ? True : False;
      } else if (op === "<=") return av[0]! <= bv[0]! ? True : False;
      else if (op === ">=") return av[0]! >= bv[0]! ? True : False;
    }
    // C++ pointer arithmetic on bytes a handle names (unsigned char* pixelOffset = data + (j + width * i) * 1).
    if (this.lenient && (op === "+" || op === "-") && a.text !== null && bv !== null && bv.length === 1 && this.pointerRead !== null && this.pointerRead(a.text, a.offset) !== null)
      return new ShaderValue({ text: a.text, offset: a.offset + toLong(op === "+" ? b.x : -b.x) });
    // C++ strings: "offsets[" + std::to_string(i) + "]".
    if (op === "+" && (a.text !== null || b.text !== null) && this.lenient) return ShaderValue.str((a.text ?? a.toString()) + (b.text ?? b.toString()));
    // C++ API flags (VK_SAMPLE_COUNT_4_BIT, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT): a set of names,
    // "A|B"; & keeps the names in both (none: 0), | joins them.
    if (this.lenient && (op === "|" || op === "&") && (a.text !== null || b.text !== null) && (a.text !== null || a.x === 0) && (b.text !== null || b.x === 0)) {
      const left = (a.text ?? "").split("|").filter((s) => s.length > 0);
      const right = (b.text ?? "").split("|").filter((s) => s.length > 0);
      const flags = op === "|" ? union(left, right) : intersect(left, right);
      return flags.length === 0 ? ShaderValue.scalar(0) : ShaderValue.str(flags.join("|"));
    }
    // API flag sets compared: (props.optimalTilingFeatures & features) == features.
    if (this.lenient && (op === "==" || op === "!=") && (a.text !== null || b.text !== null) && (a.text !== null || a.x === 0) && (b.text !== null || b.x === 0)) {
      const left = new Set((a.text ?? "").split("|").filter((s) => s.length > 0));
      const right = new Set((b.text ?? "").split("|").filter((s) => s.length > 0));
      const same = left.size === right.size && [...left].every((x) => right.has(x));
      return ShaderValue.scalar(same === (op === "==") ? 1 : 0);
    }
    // C++ pointer arithmetic on an array (vertices.data() + 36): the elements from there on.
    if (this.lenient && op === "+" && a.items !== null && bv !== null && bv.length === 1) return ShaderValue.array(a.items.slice(toInt(Math.max(0, b.x))));
    const ia = a.iterator, ib = b.iterator;
    if (ia !== null && ib !== null && (op === "==" || op === "!=")) return ShaderValue.scalar((ia.position === ib.position) === (op === "==") ? 1 : 0);
    if (av === null || bv === null) throw new ShaderRuntimeException(`invalid operands to binary '${op}'`, line);
    if (op === "*" && (a.isMatrix || b.isMatrix)) return matrixMultiply(a, b, line);
    if (op === "==" || op === "!=" || op === "<" || op === ">" || op === "<=" || op === ">=") {
      const r = op === "==" ? sequenceEqual(av, bv)
        : op === "!=" ? !sequenceEqual(av, bv)
        : op === "<" ? a.x < b.x
        : op === ">" ? a.x > b.x
        : op === "<=" ? a.x <= b.x
        : a.x >= b.x;
      return ShaderValue.scalar(r ? 1 : 0);
    }
    const n = Math.max(av.length, bv.length);
    if (av.length !== 1 && bv.length !== 1 && av.length !== bv.length) throw new ShaderRuntimeException(`cannot combine a ${describe(a)} and a ${describe(b)} with '${op}'`, line);
    // Two integers: the result is an integer, and a division drops the fraction (7 / 2 is 3).
    if (n === 1 && a.int && b.int) {
      const x = av[0]!, y = bv[0]!;
      return ShaderValue.integer(op === "/" ? (y === 0 ? 0 : Math.trunc(x / y)) : intOp(op, x, y, line));
    }
    const r2 = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const x = av[av.length === 1 ? 0 : i]!, y = bv[bv.length === 1 ? 0 : i]!;
      r2[i] = op === "/" ? (y === 0 ? 0 : x / y) : intOp(op, x, y, line);
    }
    return new ShaderValue({ v: r2, cols: a.isMatrix ? a.cols : b.cols });
  }

  /** A number converted for a variable of a type: float x = vec.x keeps 1 component, vec4 v = 1.0 broadcasts. */
  private coerce(type: string, v: ShaderValue): ShaderValue {
    const n = componentCount(type);
    const vv = v.v;
    // A number keeps its variable's type: int x = 2.7 is 2, float x = 2 divides as a float.
    if (n === 1 && vv !== null && vv.length === 1 && !v.isMatrix && type !== "auto")
      return ShaderValue.isIntType(type) ? (v.int ? v : ShaderValue.integer(Math.trunc(v.x))) : v.int ? ShaderValue.scalar(v.x) : v;
    if (n === 0 || vv === null || v.isMatrix || vv.length === n) return v;
    if (vv.length === 1) return ShaderValue.vecOf(new Array<number>(n).fill(vv[0]!));
    if (vv.length > n) return ShaderValue.vecOf(vv.slice(0, n));
    return ShaderValue.vecOf(v.padded(n));
  }

  /** Number of components of a scalar or vector type (0 = not one). */
  static componentCount(type: string): number {
    return componentCount(type);
  }

  /** The size of a square matrix type (mat4, float4x4, XMFLOAT4X4, XMMATRIX), or 0. */
  static matrixSize(type: string): number {
    return matrixSize(type);
  }

  /** The component indices of a swizzle (.xyz, .rgba, .stpq), or null. */
  static swizzle(s: string): number[] | null {
    return swizzle(s);
  }

  // ---------- calls: constructors, built-in functions, texture sampling, the shader's own functions (ShaderRunner.Builtins.cs) ----------

  private callExpr(c: A.Call): ShaderValue {
    let name = c.function_;
    // A string literal: its text (kept as a name).
    if (name === ShaderParser.StringLiteral) return ShaderValue.str((c.args[0] as A.Name).id);
    // C++'s std::string(expr): the text of its value; std::string(): empty.
    if (name === "string" && c.args.length === 1) {
      const text = this.eval(c.args[0]!).text;
      return text !== null ? ShaderValue.str(text) : ShaderValue.str(this.eval(c.args[0]!).toString());
    }
    if (name === "string" && c.args.length === 0) return ShaderValue.str("");
    if (c.arrayConstructor) return ShaderValue.array(c.args.map((a) => this.coerce(name, this.eval(a))));
    // A shader's maths and constructors, the calls a fragment makes most: straight to the result.
    if (!this.lenient) {
      const fast = this.fastCall(c, name);
      if (fast !== null) return fast;
    }
    // C++: std::fmaxf, std::sqrt … are the maths functions themselves.
    if (this.lenient && name.startsWith("std::") && name.length > 5) name = name.slice(5);
    // C's float versions of the maths functions (tanf, sqrtf, powf …) are the functions themselves.
    if (this.lenient && name.length > 3 && name.endsWith("f") && FloatMath.has(name.slice(0, -1)) && this.program.findFunction(name) === null) name = name.slice(0, -1);
    if (name.startsWith(".")) {
      // assimp's methods are the runner's (the hook would take an upper-case method for an API object's).
      if (this.lenient && [".ReadFile", ".GetErrorString", ".GetTextureCount", ".GetTexture", ".C_Str"].includes(name)) return this.method(name.slice(1), c);
      if (this.lenient && this.hook !== null) {
        const methodHooked = this.hook(name, c.args);
        if (methodHooked !== null) return methodHooked;
      }
      return this.method(name.slice(1), c);
    }
    if ((name === "EmitVertex" || name === "EndPrimitive") && this.emit !== null) {
      this.emit(name, null);
      return ShaderValue.scalar(0);
    }
    if (name === "glfwGetTime") {
      this.usedTime = true;
      return ShaderValue.scalar(this.time);
    }
    // DirectXMath stores into its first argument: XMStoreFloat4x4(&constants.transform, m).
    if (name.startsWith("XMStoreFloat") && c.args.length === 2) {
      const stored = this.eval(c.args[1]!);
      // &points[0] arrives as the array (the parser's &a[0]): a vector goes into its first element, not over it.
      let into: ShaderValue | null = null;
      try {
        into = this.eval(c.args[0]!);
      } catch (e) {
        if (!isRuntime(e)) throw e;
      }
      if (into !== null && into.items !== null && into.items.length > 0 && stored.v !== null) this.store(new A.IndexOf(c.args[0]!, new A.Number(0, c.line, true), c.line), stored);
      else this.store(c.args[0]!, stored);
      return ShaderValue.scalar(0);
    }
    if (name === "sizeof") return ShaderValue.scalar(this.sizeOf(c.args[0] ?? null));
    // offsetof(Vertex, texCoord): the bytes of the fields before it (4 per number, no padding).
    if (name === "offsetof" && c.args.length === 2 && c.args[0] instanceof A.Name && c.args[1] instanceof A.Name) {
      const offStruct = this.program.findStruct(c.args[0].id);
      if (offStruct !== null) {
        let at = 0;
        for (const member of offStruct.fields) {
          if (member.id === c.args[1].id) return ShaderValue.scalar(at);
          at += 4 * countNumbers(this.default(member.type)) * Math.max(1, member.arraySize);
        }
        return ShaderValue.scalar(0);
      }
    }
    if (this.lenient && name === "__newarray" && c.args.length === 2 && c.args[0] instanceof A.Name) {
      const elementType = c.args[0];
      const newCount = toInt(Math.max(0, Math.min(100000, this.eval(c.args[1]!).x)));
      return ShaderValue.array(range(newCount, () => this.default(elementType.id)));
    }
    // The C library's random numbers, as glibc makes them (the same sequence for the same seed on Linux).
    if (this.lenient && name === "srand" && c.args.length === 1) {
      this.random = new GlibcRandom(toUint(this.eval(c.args[0]!).x));
      return ShaderValue.scalar(0);
    }
    if (this.lenient && name === "rand" && c.args.length === 0) return ShaderValue.scalar((this.random ??= new GlibcRandom(1)).next());
    if (this.lenient && (name === "to_string" || name === "to_wstring") && c.args.length === 1) {
      const x = this.eval(c.args[0]!);
      return ShaderValue.str(x.text ?? (x.x === Math.floor(x.x) && Math.abs(x.x) < 1e15 ? toLongBig(x.x).toString() : formatCustom(x.x, 6, false)));
    }
    if (this.lenient) {
      const library = this.cppLibrary(c, name);
      if (library !== null) return library;
    }
    // std::pair<K, V>(k, v), std::make_pair(k, v): the two values.
    if (this.lenient && (name === "pair" || name === "make_pair") && c.args.length === 2) return ShaderValue.array([this.eval(c.args[0]!), this.eval(c.args[1]!)]);
    // std::tuple<…>(a, b, c), std::make_tuple(a, b, c): the values in order; std::get<N>(t) the N-th.
    if (this.lenient && (name === "tuple" || name === "make_tuple" || name === "tie")) return ShaderValue.array(c.args.map((a) => this.eval(a).clone()));
    if (this.lenient && name === ShaderParser.TupleGet && c.args.length === 2) {
      const at = toInt(this.eval(c.args[0]!).x);
      const tuple = this.eval(c.args[1]!);
      const elements = tuple.items;
      if (elements !== null && at >= 0 && at < elements.length) return elements[at]!;
      if (tuple.v !== null && at >= 0 && at < tuple.v.length) return ShaderValue.scalar(tuple.v[at]!);
      throw new ShaderRuntimeException(`std::get<${at}> of a value with fewer elements`, c.line);
    }
    // _countof(array): the number of elements of a C array (MSVC's macro, used by the D3D12 samples).
    if (name === "_countof" && c.args.length === 1) {
      try {
        const arr = this.eval(c.args[0]!);
        return ShaderValue.scalar(arr.isArray ? arr.count : arr.map?.count ?? arr.v?.length ?? 0);
      } catch (e) {
        if (!(isRuntime(e) && this.lenient)) throw e;
        return ShaderValue.scalar(0);
      }
    }

    // The shader's own functions and structs.
    const f = this.program.findFunction(name);
    if (f !== null) return this.callFunction(f, c);
    const st = this.program.findStruct(name);
    if (st !== null) {
      const args = c.args.map((a) => this.eval(a));
      const fields = new Map<string, ShaderValue>();
      for (let i = 0; i < st.fields.length; i++) fields.set(st.fields[i]!.id, i < args.length ? this.coerce(st.fields[i]!.type, args[i]!) : this.default(st.fields[i]!.type));
      return ShaderValue.struct(fields);
    }

    // glm::quat(w, x, y, z): a quaternion, kept as (x, y, z, w) like GLM's memory (.w is the last).
    if (this.lenient && (name === "quat" || name === "fquat" || name === "dquat") && c.args.length === 4) {
      const q = c.args.map((a) => this.eval(a));
      return ShaderValue.vec(q[1]!.x, q[2]!.x, q[3]!.x, q[0]!.x);
    }
    const m = matrixSize(name);
    if (m > 0) {
      const made = matrixConstructor(m, c.args.map((a) => this.eval(a)), c.line);
      // HLSL's float4x4(…) and DirectXMath's XMFLOAT4X4(…) take the matrix row by row, GLSL's mat4(…) column by column
      // (one matrix argument is a cast either way).
      const rows = ["float4x4", "float3x3", "float2x2", "XMFLOAT4X4", "XMFLOAT3X3", "XMMATRIX"].includes(name);
      return rows && c.args.length > 1 ? transpose(made) : made;
    }
    const n = componentCount(name);
    // int(x), uint(x): the whole part, as an integer.
    if (n === 1 && ShaderValue.isIntType(name) && c.args.length === 1) {
      const whole = this.eval(c.args[0]!);
      if (whole.v !== null && whole.v.length > 0) return ShaderValue.integer(Math.trunc(whole.x));
    }
    if (n > 0) return vectorConstructor(name, n, c.args.map((a) => this.eval(a)), c.line);

    // C++ mode: the API calls go to the hook before their arguments are evaluated (they name API objects).
    if (this.lenient && this.hook !== null) {
      const hooked = this.hook(name, c.args);
      if (hooked !== null) return hooked;
    }
    const a = c.args.map((x) => this.eval(x));
    const matrix = this.matrixFunction(name, a, c.line);
    if (matrix !== null) return matrix;
    const need = (count: number): boolean => a.length === count && a.every((x) => x.v !== null);
    const arity = (): ShaderRuntimeException => new ShaderRuntimeException(`wrong arguments to '${name}'`, c.line);
    const map = (fn: (x: number) => number): ShaderValue => {
      if (!need(1)) throw arity();
      return ShaderValue.vecOf(a[0]!.v!.map(fn));
    };
    const zip = (fn: (x: number, y: number) => number): ShaderValue => {
      if (!need(2)) throw arity();
      return componentwise(a[0]!, a[1]!, fn, c.line);
    };

    switch (name) {
      case "sin": return map(libm.sin);
      case "cos": return map(libm.cos);
      case "tan": return map(libm.tan);
      case "asin": return map(libm.asin);
      case "acos": return map(libm.acos);
      case "atan": return a.length === 2 ? zip(libm.atan2) : map(libm.atan);
      case "atan2":
        if (a.length === 2) return zip(libm.atan2);
        break;
      case "radians": return map((x) => (x * Math.PI) / 180);
      case "degrees": return map((x) => (x * 180) / Math.PI);
      case "XMConvertToRadians": return map((x) => (x * Math.PI) / 180);
      case "exp": return map(libm.exp);
      case "exp2": return map((x) => libm.pow(2, x));
      case "log": return map(libm.log);
      case "log2": return map(libm.log2);
      case "sqrt": return map(Math.sqrt);
      case "inversesqrt": case "rsqrt": return map((x) => 1 / Math.sqrt(x));
      case "abs": case "fabs": return map(Math.abs);
      case "sign": return map(sign);
      case "floor": return map(Math.floor);
      case "ceil": return map(Math.ceil);
      case "round": return map(roundEven);
      case "trunc": return map(Math.trunc);
      case "fract": case "frac": return map((x) => x - Math.floor(x));
      case "saturate": return map((x) => clamp(x, 0, 1));
      case "pow": return zip(libm.pow);
      case "mod": return zip((x, y) => x - y * Math.floor(x / y));
      case "fmod": return zip((x, y) => x % y);
      case "min": case "fmin": case "fminf": return zip(Math.min);
      case "max": case "fmax": case "fmaxf": return zip(Math.max);
      case "step": return zip((edge, x) => (x < edge ? 0 : 1));
      // isinf / isnan (GLSL and HLSL): a bool per component (weighted blended OIT's overflow check).
      case "isinf": return map((x) => (x === Infinity || x === -Infinity ? 1 : 0));
      case "isnan": return map((x) => (Number.isNaN(x) ? 1 : 0));
      case "clamp":
        if (a.length === 3) return componentwise(componentwise(a[0]!, a[1]!, Math.max, c.line), a[2]!, Math.min, c.line);
        break;
      case "mix": case "lerp":
        if (a.length === 3) {
          const d = componentwise(a[1]!, a[0]!, (x, y) => x - y, c.line);
          return componentwise(a[0]!, componentwise(d, a[2]!, (x, y) => x * y, c.line), (x, y) => x + y, c.line);
        }
        break;
      case "smoothstep":
        if (a.length === 3) {
          const t = componentwise(componentwise(a[2]!, a[0]!, (x, y) => x - y, c.line), componentwise(a[1]!, a[0]!, (x, y) => x - y, c.line), (x, y) => (y === 0 ? 0 : clamp(x / y, 0, 1)), c.line);
          return ShaderValue.vecOf(t.v!.map((x) => x * x * (3 - 2 * x)));
        }
        break;
      case "length":
        if (!need(1)) throw arity();
        return ShaderValue.scalar(Math.sqrt(sum(a[0]!.v!.map((x) => x * x))));
      case "distance":
        if (!need(2)) throw arity();
        return ShaderValue.scalar(Math.sqrt(sum(zipArrays(a[0]!.v!, a[1]!.v!, (x, y) => (x - y) * (x - y)))));
      case "dot":
        if (!need(2)) throw arity();
        return ShaderValue.scalar(sum(zipArrays(a[0]!.v!, a[1]!.v!, (x, y) => x * y)));
      case "normalize": {
        if (!need(1)) throw arity();
        const len = Math.sqrt(sum(a[0]!.v!.map((x) => x * x)));
        return ShaderValue.vecOf(a[0]!.v!.map((x) => (len === 0 ? 0 : x / len)));
      }
      case "cross": {
        if (!need(2)) throw arity();
        const p = a[0]!.padded(3);
        const q = a[1]!.padded(3);
        return ShaderValue.vec(p[1]! * q[2]! - p[2]! * q[1]!, p[2]! * q[0]! - p[0]! * q[2]!, p[0]! * q[1]! - p[1]! * q[0]!);
      }
      case "reflect": {
        if (!need(2)) throw arity();
        const d = sum(zipArrays(a[0]!.v!, a[1]!.v!, (x, y) => x * y));
        return ShaderValue.vecOf(zipArrays(a[0]!.v!, a[1]!.v!, (i, nn) => i - 2 * d * nn));
      }
      case "refract": {
        // refract(I, N, eta): the GLSL/HLSL formula; a zero vector past the critical angle.
        if (a.length !== 3 || a.some((x) => x.v === null)) throw arity();
        const i = a[0]!.v!;
        const nn = a[1]!.v!;
        const eta = a[2]!.x, d = sum(zipArrays(i, nn, (x, y) => x * y));
        const k = 1 - eta * eta * (1 - d * d);
        if (k < 0) return ShaderValue.vecOf(new Array<number>(i.length).fill(0));
        const factor = eta * d + Math.sqrt(k);
        return ShaderValue.vecOf(i.map((x, j) => eta * x - factor * nn[Math.min(j, nn.length - 1)]!));
      }
      case "transpose":
        if (a.length !== 1 || !a[0]!.isMatrix) throw arity();
        return transpose(a[0]!);
      case "mul":
        // HLSL: mul(vector, matrix) treats the vector as a row; mul(matrix, vector) as a column.
        if (a.length !== 2) throw arity();
        return matrixMultiply(a[0]!, a[1]!, c.line);
      case "texture": case "texture2D": case "textureCube":
        if (a.length < 2) throw arity();
        return this.sampleTexture(c.args[0]!, a[1]!);
      case "textureLod":
        // textureLod(sampler, coordinates, lod): the mip level is given (a cube map's pre-filtered levels).
        if (a.length < 2) throw arity();
        return this.sampleTexture(c.args[0]!, a[1]!, null, a.length >= 3 ? a[2]!.x : null);
      case "texelFetch": {
        // texelFetch(sampler, ivec2 texel, lod): the texel's centre.
        if (a.length < 2) throw arity();
        const size = programSize(this.textureImage?.(this.pathOf(c.args[0]!)) ?? null) ?? [1, 1];
        const p = a[1]!.padded(2);
        return this.sampleTexture(c.args[0]!, ShaderValue.vec((Math.floor(p[0]!) + 0.5) / size[0], (Math.floor(p[1]!) + 0.5) / size[1]), null, 0);
      }
      case "imageStore": {
        // imageStore(image, ivec2 texel, vec4 value): a compute shader writes a texel.
        if (a.length < 3) throw arity();
        const p = a[1]!.padded(2);
        this.imageStore?.(this.pathOf(c.args[0]!), toInt(Math.floor(p[0]!)), toInt(Math.floor(p[1]!)), a[2]!.padded(4));
        return ShaderValue.scalar(0);
      }
      case "imageLoad": {
        if (a.length < 2) throw arity();
        const p = a[1]!.padded(2);
        return ShaderValue.vecOf(this.imageLoad?.(this.pathOf(c.args[0]!), toInt(Math.floor(p[0]!)), toInt(Math.floor(p[1]!))) ?? [0, 0, 0, 0]);
      }
      case "imageSize": {
        if (a.length < 1) throw arity();
        const size = this.imageSize?.(this.pathOf(c.args[0]!)) ?? [1, 1];
        return new ShaderValue({ v: [size[0], size[1]] });
      }
      case "barrier": case "memoryBarrier": case "memoryBarrierImage": case "memoryBarrierShared": case "groupMemoryBarrier": case "GroupMemoryBarrierWithGroupSync":
      case "DeviceMemoryBarrier": case "AllMemoryBarrier": case "GroupMemoryBarrier": case "DeviceMemoryBarrierWithGroupSync": case "AllMemoryBarrierWithGroupSync":
        // The invocations run one after another here: nothing to wait for.
        return ShaderValue.scalar(0);
      case "textureSize": {
        if (a.length < 1) throw arity();
        const image = this.textureImage?.(this.pathOf(c.args[0]!)) ?? null;
        const size = image !== null ? [image.width, image.height] : [1, 1];
        return ShaderValue.vec(size[0]!, size[1]!);
      }
    }
    if (this.lenient) return ShaderValue.scalar(0);
    throw new ShaderRuntimeException(`'${name}' was not declared in this scope`, c.line);
  }

  /** sizeof in bytes, counting every number as 4 bytes (float, int, uint32_t); a 16-bit index type is 2. */
  private sizeOf(e: A.Expr | null): number {
    if (e instanceof A.Name) {
      const id = e.id;
      if (["float", "int", "GLfloat", "GLint", "GLuint", "uint32_t", "int32_t", "unsigned", "UINT", "DWORD"].includes(id)) return 4;
      if (["uint16_t", "UINT16", "GLushort", "short", "unsigned short"].includes(id)) return 2;
      if (["double", "uint64_t", "size_t"].includes(id)) return 8;
      if (["uint8_t", "int8_t", "char", "BYTE", "UINT8", "stbi_uc", "GLubyte", "bool"].includes(id)) return 1;
      const comps = componentCount(id);
      if (comps > 0) return 4 * comps;
      const m = matrixSize(id);
      if (m > 0) return 4 * m * m;
      // A struct of the program (sizeof(Vertex)): its fields' numbers.
      if (this.program.findStruct(id) !== null) return 4 * countNumbers(this.default(id));
    }
    if (e === null) return 0;
    try {
      return 4 * countNumbers(this.eval(e));
    } catch (x) {
      if (!isRuntime(x)) throw x;
      return 0;
    }
  }

  private method(method: string, c: A.Call): ShaderValue {
    const args = c.args;
    const evalArg0 = (): ShaderValue => this.eval(args[0]!);
    if (method === "Append" && this.emit !== null && args.length >= 2) {
      this.emit("Append", this.eval(args[1]!));
      return ShaderValue.scalar(0);
    }
    if (method === "RestartStrip" && this.emit !== null) {
      this.emit("RestartStrip", null);
      return ShaderValue.scalar(0);
    }
    if (method === "Load" && args.length >= 2 && !this.lenient) {
      // HLSL Texture2D.Load(int3(x, y, mip)): one texel, unfiltered (GLSL's texelFetch); a Texture2DArray's
      // int4(x, y, layer, mip) names the layer too.
      const path = this.pathOf(args[0]!);
      const at = this.eval(args[1]!).padded(4);
      const array = this.isArrayTexture(path);
      const size = programSize(this.textureImage?.(path) ?? null) ?? [1, 1];
      const uv = array ? ShaderValue.vec((Math.floor(at[0]!) + 0.5) / size[0], (Math.floor(at[1]!) + 0.5) / size[1], at[2]!)
        : ShaderValue.vec((Math.floor(at[0]!) + 0.5) / size[0], (Math.floor(at[1]!) + 0.5) / size[1]);
      return this.sampleTexture(args[0]!, uv, null, 0);
    }
    if ((method === "Sample" || method === "SampleLevel") && args.length >= 3) {
      // HLSL names the sampler: the texture is looked up as "texture|sampler". SampleLevel gives the mip level.
      return this.sampleTexture(args[0]!, this.eval(args[2]!), this.pathOf(args[1]!), method === "SampleLevel" && args.length >= 4 ? this.eval(args[3]!).x : null);
    }
    if (method === "find" && this.lenient && args.length === 2) {
      const searched = evalArg0().map;
      if (searched !== null) {
        // map.find(key): an iterator at the key, or end().
        const key = ShaderValue.mapKey(this.eval(args[1]!));
        let position = 0;
        let found = false;
        for (const k of searched.keys()) {
          if (k === key) {
            found = true;
            break;
          }
          position++;
        }
        return new ShaderValue({ iterator: new MapIterator(searched, found ? position : searched.count, false) });
      }
    }
    if ((method === "count" || method === "contains") && this.lenient && args.length === 2) {
      const counted = evalArg0().map;
      if (counted !== null) return ShaderValue.integer(counted.has(ShaderValue.mapKey(this.eval(args[1]!))) ? 1 : 0);
    }
    if (method === "size" || method === "length" || method === "Length" || method === "count") {
      const target = evalArg0();
      return ShaderValue.scalar(target.map?.count ?? (target.isArray ? target.count : null) ?? target.v?.length ?? 0);
    }
    if (method === "begin" || method === "end" || method === "rbegin" || method === "rend") {
      const map = evalArg0().map;
      if (map !== null) return new ShaderValue({ iterator: new MapIterator(map, method.endsWith("end") && !method.endsWith("begin") ? map.count : 0, method.startsWith("r")) });
    }
    if ((method === "begin" || method === "end" || method === "cbegin" || method === "cend") && this.lenient) {
      const str = evalArg0().text;
      if (str !== null) {
        // A std::string's iterator: *it is the character there (learnopengl's RenderText walks the text with one).
        const chars = new SortedMap<ShaderValue>();
        for (let i = 0; i < str.length; i++) chars.set(i, ShaderValue.integer(str.charCodeAt(i)));
        const it = new MapIterator(chars, method.endsWith("end") ? str.length : 0, false);
        return new ShaderValue({ iterator: it, v: it.current?.[1].v ?? null });
      }
    }
    if ((method === "insert" || method === "emplace") && this.lenient) {
      const into = evalArg0().map;
      if (into !== null) {
        // map.insert(std::pair<K, V>(k, v)) / map.emplace(k, v): added unless the key is there already.
        let key: ShaderValue | null = null, value: ShaderValue | null = null;
        if (args.length >= 3) [key, value] = [this.eval(args[1]!), this.eval(args[2]!)];
        else {
          const pair = this.eval(args[1]!).items;
          if (pair !== null && pair.length === 2) [key, value] = [pair[0]!, pair[1]!];
        }
        if (key !== null && value !== null && !into.has(ShaderValue.mapKey(key))) into.set(ShaderValue.mapKey(key), value.clone());
        return ShaderValue.scalar(0);
      }
    }
    if (method === "insert" && this.lenient && args.length === 4 && args[2] instanceof A.Call && (args[2].function_ === ".begin" || args[2].function_ === ".cbegin") && args[2].args.length === 1
      && args[3] instanceof A.Call && (args[3].function_ === ".end" || args[3].function_ === ".cend") && args[3].args.length === 1
      && exprText(args[2].args[0]!) === exprText(args[3].args[0]!) && evalArg0().isArray) {
      // v.insert(v.end(), other.begin(), other.end()): the other vector's elements appended (or put first).
      const from = args[2].args[0]!;
      const into = evalArg0();
      const added = (this.eval(from).items ?? []).map((x) => x.clone());
      const atStart = args[1] instanceof A.Call && (args[1].function_ === ".begin" || args[1].function_ === ".cbegin");
      if (atStart) this.store(args[0]!, ShaderValue.array([...added, ...(into.items ?? [])]));
      else for (const item of added) into.append(item);
      return ShaderValue.scalar(0);
    }
    if ((method === "is_open" || method === "good") && this.lenient) {
      const openStream = evalArg0();
      if (isStream(openStream)) return ShaderValue.scalar(openStream.fields!.get(StreamOk)!.x);
    }
    if ((method === "fail" || method === "eof") && this.lenient) {
      const failStream = evalArg0();
      if (isStream(failStream)) return ShaderValue.scalar(failStream.fields!.get(StreamOk)!.x === 0 ? 1 : 0);
    }
    if (method === "close" && this.lenient) return ShaderValue.scalar(0);
    if (method === "clear" && this.lenient && args.length === 1) {
      const cleared = evalArg0();
      if (cleared.items !== null || cleared.map !== null) {
        // vector.clear(), map.clear(): empty.
        if (cleared.map !== null) cleared.map.clear();
        else this.store(args[0]!, ShaderValue.array([]));
        return ShaderValue.scalar(0);
      }
    }
    if (method === "empty" && this.lenient && args.length === 1) {
      const target = evalArg0();
      return ShaderValue.scalar((target.map?.count ?? (target.isArray ? target.count : null) ?? target.text?.length ?? 0) === 0 ? 1 : 0);
    }
    if (method === "rdbuf" && this.lenient) {
      const bufStream = evalArg0();
      if (isStream(bufStream)) return bufStream;
    }
    if (method === "str" && this.lenient) {
      const strStream = evalArg0();
      if (isStream(strStream)) return ShaderValue.str(strStream.fields!.get(StreamText)!.text ?? "");
    }
    if (method === "open" && this.lenient && args.length >= 2) {
      const fileStream = evalArg0();
      if (isStream(fileStream)) {
        const path = this.eval(args[1]!).text;
        const text = path === null ? null : (this.readText?.(path) ?? null);
        fileStream.fields!.set(StreamText, ShaderValue.str(text ?? ""));
        fileStream.fields!.set(StreamPos, ShaderValue.scalar(0));
        fileStream.fields!.set(StreamOk, ShaderValue.scalar(text === null ? 0 : 1));
        return ShaderValue.scalar(0);
      }
    }
    if (method === "C_Str") return evalArg0();
    if (method === "ReadFile" && this.lenient && args.length >= 2) {
      const modelPath = this.eval(args[1]!).text;
      if (modelPath !== null) {
        // Assimp::Importer::ReadFile(path, flags): the model's aiScene (glTF), with aiProcess_FlipUVs as asked.
        const flipUvs = args.length >= 3 && exprText(args[2]!).includes("aiProcess_FlipUVs");
        const key = modelPath + (flipUvs ? "|flip" : "");
        let loadedScene = this.assimpScenes.get(key);
        if (loadedScene === undefined) {
          const read = this.readBytes;
          const gltf = read !== null && GltfModel.isGltf(modelPath) ? GltfModel.loadFrom(read, modelPath) : null;
          loadedScene = gltf !== null ? gltf.scene(flipUvs) : ShaderValue.str("nullptr");
          this.assimpScenes.set(key, loadedScene);
        }
        return loadedScene;
      }
    }
    if (method === "GetErrorString" && this.lenient) return ShaderValue.str("");
    if (method === "GetTextureCount" && this.lenient && args.length >= 2) {
      const byType = evalArg0().fields?.get(GltfModel.MaterialTextures)?.fields ?? null;
      if (byType !== null) return ShaderValue.integer(byType.get(this.eval(args[1]!).text ?? "")?.count ?? 0);
    }
    if (method === "GetTexture" && this.lenient && args.length >= 4) {
      const textureFiles = evalArg0().fields?.get(GltfModel.MaterialTextures)?.fields ?? null;
      if (textureFiles !== null) {
        const files = textureFiles.get(this.eval(args[1]!).text ?? "")?.items ?? [];
        const index = toInt(this.eval(args[2]!).x);
        const address = args[3]!;
        if (index >= 0 && index < files.length) this.store(address instanceof A.Unary && address.op === "&" ? address.operand : address, files[index]!);
        return ShaderValue.str("aiReturn_SUCCESS");
      }
    }
    if (method === "data" || method === "c_str") return evalArg0();
    if ((method === "Get" || method === "get") && this.lenient && args.length === 1) {
      // ComPtr<T>::Get(), unique_ptr<T>::get(): the pointer itself (a resource passed to a helper).
      try {
        return evalArg0();
      } catch (e) {
        if (!isRuntime(e)) throw e;
        return ShaderValue.scalar(0);
      }
    }
    if (method === "erase" && this.lenient && args.length >= 2 && args[1] instanceof A.Call && args[1].function_ === "remove_if" && args[1].args.length === 3) {
      // v.erase(std::remove_if(v.begin(), v.end(), predicate), v.end()): the elements the predicate keeps.
      const removeIf = args[1];
      const vec = evalArg0();
      const predicate = this.eval(removeIf.args[2]!);
      this.store(args[0]!, ShaderValue.array((vec.items ?? []).filter((item) => !truthy(this.invokeLambda(predicate, [item], c.line)))));
      return ShaderValue.scalar(0);
    }
    if ((method === "back" || method === "front") && this.lenient && args.length === 1) {
      const elements = evalArg0().items;
      // vector.back() / front(): the element itself (a reference: &children.back() points at it).
      if (elements !== null && elements.length > 0) return method === "back" ? elements[elements.length - 1]! : elements[0]!;
    }
    if ((method === "push_back" || method === "emplace_back") && this.lenient && args.length >= 2) {
      // vector.push_back(x): the variable holds a new, longer array.
      const vec = evalArg0();
      const item = this.eval(args[1]!).clone();
      if (vec.isArray && !vec.shared) vec.append(item);
      else this.store(args[0]!, ShaderValue.array([...(vec.items ?? []), item]));
      return ShaderValue.scalar(0);
    }
    if (method === "GetDimensions" && args.length >= 3) {
      // HLSL Texture2D::GetDimensions(out width, out height): the texture's size in texels.
      // A RWTexture2D (a compute shader's UAV) reports the storage image's size.
      let size: [number, number] | null = this.isRwTexture(args[0]!) ? (this.imageSize?.(this.pathOf(args[0]!)) ?? null) : null;
      if (size === null) {
        const image = this.textureImage?.(this.pathOf(args[0]!)) ?? null;
        size = image !== null ? [image.width, image.height] : [1, 1];
      }
      this.store(args[1]!, ShaderValue.scalar(size[0]));
      this.store(args[2]!, ShaderValue.scalar(size[1]));
      return ShaderValue.scalar(0);
    }
    if (method === "resize" && this.lenient && args.length >= 2) {
      // vector.resize(n[, value]): new elements are the value given, else the element type's zero value (an empty
      // struct when the type is not known). Up to a 1024 × 1024 byte image.
      const vec = evalArg0();
      const n = toInt(Math.max(0, Math.min(1 << 20, this.eval(args[1]!).x)));
      const old = vec.items ?? [];
      const fill = args.length >= 3 ? this.eval(args[2]!) : (this.elementDefault?.(args[0]!) ?? null);
      this.store(args[0]!, ShaderValue.array(range(n, (i) => (i < old.length ? old[i]! : fill?.clone() ?? ShaderValue.struct(new Map())))));
      return ShaderValue.scalar(0);
    }
    if (this.lenient) return ShaderValue.scalar(0);
    throw new ShaderRuntimeException(`no member function '${method}'`, c.line);
  }

  private callFunction(f: A.Function, c: A.Call): ShaderValue {
    const args = new Array<ShaderValue>(c.args.length);
    for (let i = 0; i < args.length; i++) args[i] = this.eval(c.args[i]!);
    return this.invoke(f, args) ?? ShaderValue.scalar(0);
  }

  /**
   * A call of a built-in maths function, a vector constructor or one of the shader's own functions, without the lists
   * and checks of the general path; null when the call is something else (the general path takes it). The results
   * are the general path's.
   */
  private fastCall(c: A.Call, name: string): ShaderValue | null {
    if (c.arrayConstructor || name.length === 0 || name[0] === ".") return null;
    const own = this.program.findFunction(name);
    if (own !== null) return this.callFunction(own, c);
    const args = c.args;
    let op = FastCalls.get(name);
    if (op === undefined) {
      // vec3(…), float4(…), float(x): the components in order (one number fills the vector).
      const n = componentCount(name);
      if (n === 0 || args.length === 0 || this.program.findStruct(name) !== null || matrixSize(name) > 0 || (n === 1 && ShaderValue.isIntType(name))) return null;
      if (args.length === 1) {
        const v = this.eval(args[0]!).v;
        if (v === null) throw new ShaderRuntimeException(`cannot build a ${name} from this value`, c.line);
        let made: number[];
        if (v.length === 1) made = new Array<number>(n).fill(v[0]!);
        else if (v.length < n) throw new ShaderRuntimeException(`too few components to construct '${name}'`, c.line);
        else made = v.slice(0, n);
        return ShaderValue.vecOf(made);
      }
      const parts = new Array<number>(n).fill(0);
      let count = 0;
      for (let i = 0; i < args.length; i++) {
        const v = this.eval(args[i]!).v;
        if (v === null) throw new ShaderRuntimeException(`cannot build a ${name} from this value`, c.line);
        for (let k = 0; k < v.length; k++, count++) if (count < n) parts[count] = v[k]!;
      }
      if (count === 1) parts.fill(parts[0]!);
      else if (count < n) throw new ShaderRuntimeException(`too few components to construct '${name}'`, c.line);
      return ShaderValue.vecOf(parts);
    }
    if (this.program.findStruct(name) !== null) return null;
    const arity = (): ShaderRuntimeException => new ShaderRuntimeException(`wrong arguments to '${name}'`, c.line);
    if (op < 100) {
      if (args.length === 2 && op === 5) op = 106;
      else {
        if (args.length !== 1) return null;
        const v = this.eval(args[0]!).v;
        if (v === null) throw arity();
        const fn = UnaryMath[op]!;
        const r = new Array<number>(v.length);
        for (let i = 0; i < r.length; i++) r[i] = fn(v[i]!);
        return ShaderValue.vecOf(r);
      }
    }
    if (op < 200) {
      if (args.length !== 2) return null;
      const a = this.eval(args[0]!);
      const b = this.eval(args[1]!);
      if (a.v === null || b.v === null) throw arity();
      return componentwise(a, b, BinaryMath[op - 100]!, c.line);
    }
    switch (op) {
      case 300: case 301: {
        if (args.length < 2) return null;
        const at = this.eval(args[1]!);
        return this.sampleTexture(args[0]!, at, null, op === 301 && args.length >= 3 ? this.eval(args[2]!).x : null);
      }
      case 200: case 201: {
        if (args.length !== 3) return null;
        const a = this.eval(args[0]!), b = this.eval(args[1]!), t = this.eval(args[2]!);
        if (op === 200) return componentwise(componentwise(a, b, Math.max, c.line), t, Math.min, c.line);
        const d = componentwise(b, a, (x, y) => x - y, c.line);
        return componentwise(a, componentwise(d, t, (x, y) => x * y, c.line), (x, y) => x + y, c.line);
      }
      case 202: case 204: {
        if (args.length !== 1) return null;
        const v = this.eval(args[0]!).v;
        if (v === null) throw arity();
        let s = 0;
        for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
        const len = Math.sqrt(s);
        if (op === 202) return ShaderValue.scalar(len);
        const r = new Array<number>(v.length);
        for (let i = 0; i < r.length; i++) r[i] = len === 0 ? 0 : v[i]! / len;
        return ShaderValue.vecOf(r);
      }
      default: {
        if (args.length !== 2) return null;
        const a = this.eval(args[0]!).v;
        const b = this.eval(args[1]!).v;
        if (a === null || b === null) throw arity();
        if (op === 205) {
          const p = [a.length > 0 ? a[0]! : 0, a.length > 1 ? a[1]! : 0, a.length > 2 ? a[2]! : 0];
          const q = [b.length > 0 ? b[0]! : 0, b.length > 1 ? b[1]! : 0, b.length > 2 ? b[2]! : 0];
          return ShaderValue.vec(p[1]! * q[2]! - p[2]! * q[1]!, p[2]! * q[0]! - p[0]! * q[2]!, p[0]! * q[1]! - p[1]! * q[0]!);
        }
        const n = Math.min(a.length, b.length);
        let d = 0;
        for (let i = 0; i < n; i++) d += a[i]! * b[i]!;
        if (op === 203) return ShaderValue.scalar(d);
        const r = new Array<number>(n);
        for (let i = 0; i < n; i++) r[i] = a[i]! - 2 * d * b[i]!;
        return ShaderValue.vecOf(r);
      }
    }
  }

  private sampleTexture(texture: A.Expr, uv: ShaderValue, sampler: string | null = null, lod: number | null = null): ShaderValue {
    let path = this.pathOf(texture);
    if (uv.size >= 3 && this.isArrayTexture(path)) {
      // A texture array (sampler2DArray, Texture2DArray): the third coordinate picks the layer, "name@layer".
      path += "@" + Math.max(0, toInt(Math.floor(uv.v![2]! + 0.5)));
      uv = ShaderValue.vec(uv.v![0]!, uv.v![1]!);
    }
    const id = sampler === null ? path : path + "|" + sampler;
    if (uv.size >= 3 && lod !== null && this.sampleCubeLod !== null) {
      const mip = this.sampleCubeLod(id, uv.v![0]!, uv.v![1]!, uv.v![2]!, lod);
      if (mip !== null) return ShaderValue.vecOf(mip);
    }
    if (uv.size >= 3 && this.sampleCube !== null) {
      const cube = this.sampleCube(id, uv.v![0]!, uv.v![1]!, uv.v![2]!);
      if (cube !== null) return ShaderValue.vecOf(cube);
    }
    const at = uv.padded(2);
    if (this.sample === null) return ShaderValue.vec(1, 0, 1, 1);
    // A minified texture is read from its mip levels: where these coordinates go from pixel to pixel.
    Texture.footprint = this.footprint !== null && lod === null ? this.footprint(at[0]!, at[1]!) : null;
    try {
      return ShaderValue.vecOf(this.sample(id, at[0]!, at[1]!));
    } finally {
      Texture.footprint = null;
    }
  }

  private arrayTextures: Set<string> | null = null;

  /** Whether a texture the shader declares is an array of 2D layers (sampler2DArray, Texture2DArray). */
  private isArrayTexture(name: string): boolean {
    this.arrayTextures ??= new Set(this.program.globals
      .filter((g) => ["sampler2DArray", "sampler2DArrayShadow", "isampler2DArray", "usampler2DArray", "texture2DArray"].includes(g.type) || g.type.startsWith("Texture2DArray"))
      .map((g) => g.id));
    return this.arrayTextures.has(name);
  }

  /** The uniform name of a texture expression: texture1, material.diffuse, shadowMaps[2]. */
  private pathOf(e: A.Expr): string {
    if (e instanceof A.Name) return e.id;
    if (e instanceof A.Member) return this.pathOf(e.target) + "." + e.field;
    if (e instanceof A.IndexOf) return this.pathOf(e.target) + "[" + toInt(Math.floor(this.eval(e.at).x)) + "]";
    return "";
  }

  // ---------- the GLM and DirectXMath functions (ShaderRunner.Matrices.cs) ----------

  /** The GLM and DirectXMath functions; null when the name is neither. */
  private matrixFunction(name: string, a: ShaderValue[], line: number): ShaderValue | null {
    const arity = (): ShaderRuntimeException => new ShaderRuntimeException(`wrong arguments to '${name}'`, line);
    const S = (i: number): number => {
      if (i < a.length) return a[i]!.x;
      throw arity();
    };
    const len4 = (v: ShaderValue): boolean => v.v !== null && v.v.length === 4;
    switch (name) {
      // ---------- GLM ----------
      case "value_ptr":
        if (a.length === 1) return a[0]!;
        throw arity();
      case "translate":
        if (a.length === 2 && a[0]!.isMatrix) {
          const v = v3(a[1]!);
          return matrixMultiply(a[0]!, rows([[1, 0, 0, v[0]!], [0, 1, 0, v[1]!], [0, 0, 1, v[2]!], [0, 0, 0, 1]]), line);
        }
        break;
      case "rotate":
        if (a.length === 3 && a[0]!.isMatrix) return matrixMultiply(a[0]!, axisAngle(a[1]!.x, v3(a[2]!)), line);
        break;
      case "scale":
        if (a.length === 2 && a[0]!.isMatrix) {
          const v = v3(a[1]!);
          return matrixMultiply(a[0]!, rows([[v[0]!, 0, 0, 0], [0, v[1]!, 0, 0], [0, 0, v[2]!, 0], [0, 0, 0, 1]]), line);
        }
        break;
      case "perspective":
        if (a.length === 4) {
          const f = 1 / libm.tan(S(0) / 2), aspect = S(1), n = S(2), fa = S(3);
          return this.depthZeroToOne
            ? rows([[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, fa / (n - fa), -(fa * n) / (fa - n)], [0, 0, -1, 0]])
            : rows([[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n)], [0, 0, -1, 0]]);
        }
        break;
      case "ortho":
        if (a.length === 4 || a.length === 6) {
          const l = S(0), r = S(1), b = S(2), t = S(3), n = a.length === 6 ? S(4) : -1, f = a.length === 6 ? S(5) : 1;
          return this.depthZeroToOne
            ? rows([[2 / (r - l), 0, 0, -(r + l) / (r - l)], [0, 2 / (t - b), 0, -(t + b) / (t - b)], [0, 0, -1 / (f - n), -n / (f - n)], [0, 0, 0, 1]])
            : rows([[2 / (r - l), 0, 0, -(r + l) / (r - l)], [0, 2 / (t - b), 0, -(t + b) / (t - b)], [0, 0, -2 / (f - n), -(f + n) / (f - n)], [0, 0, 0, 1]]);
        }
        break;
      case "lookAt":
        if (a.length === 3) {
          const eye = v3(a[0]!);
          const c = a[1]!.padded(3);
          const f = normalize3([c[0]! - eye[0]!, c[1]! - eye[1]!, c[2]! - eye[2]!]);
          const s = normalize3(cross(f, v3(a[2]!)));
          const u = cross(s, f);
          return rows([[s[0]!, s[1]!, s[2]!, -dot3(s, eye)], [u[0]!, u[1]!, u[2]!, -dot3(u, eye)], [-f[0]!, -f[1]!, -f[2]!, dot3(f, eye)], [0, 0, 0, 1]]);
        }
        break;
      case "inverse":
        if (a.length === 1 && a[0]!.isMatrix) return inverse(a[0]!, line);
        break;
      // Quaternions (x, y, z, w): glm::slerp, glm::toMat4 / mat4_cast, DirectXMath's XMQuaternion*.
      case "slerp":
        if (a.length === 3 && len4(a[0]!) && len4(a[1]!)) return slerp(a[0]!.v!, a[1]!.v!, S(2), 1 - 1.1920929e-7);
        break;
      case "XMQuaternionSlerp":
        if (a.length === 3) return slerp(a[0]!.padded(4), a[1]!.padded(4), S(2), 1 - 0.00001);
        break;
      case "XMQuaternionNormalize":
        if (a.length === 1) {
          const q = a[0]!.padded(4);
          const l = Math.sqrt(q[0]! * q[0]! + q[1]! * q[1]! + q[2]! * q[2]! + q[3]! * q[3]!);
          return l === 0 ? ShaderValue.vecOf(q) : ShaderValue.vec(q[0]! / l, q[1]! / l, q[2]! / l, q[3]! / l);
        }
        break;
      case "toMat4": case "mat4_cast":
        if (a.length === 1 && len4(a[0]!)) return quaternionMatrix(a[0]!.v!, 4);
        break;
      case "toMat3": case "mat3_cast":
        if (a.length === 1 && len4(a[0]!)) return quaternionMatrix(a[0]!.v!, 3);
        break;
      case "XMMatrixRotationQuaternion":
        // Row vectors: the transpose of the column-vector rotation.
        if (a.length === 1) return transpose(quaternionMatrix(a[0]!.padded(4), 4));
        break;
      case "XMMatrixTranslationFromVector":
        if (a.length === 1) {
          const v = v3(a[0]!);
          return rows([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [v[0]!, v[1]!, v[2]!, 1]]);
        }
        break;
      case "XMMatrixScalingFromVector":
        if (a.length === 1) {
          const v = v3(a[0]!);
          return rows([[v[0]!, 0, 0, 0], [0, v[1]!, 0, 0], [0, 0, v[2]!, 0], [0, 0, 0, 1]]);
        }
        break;
      case "XMVectorLerp":
        if (a.length === 3) {
          const x = a[0]!.padded(4);
          const y = a[1]!.padded(4);
          const t = S(2);
          return ShaderValue.vec(x[0]! + (y[0]! - x[0]!) * t, x[1]! + (y[1]! - x[1]!) * t, x[2]! + (y[2]! - x[2]!) * t, x[3]! + (y[3]! - x[3]!) * t);
        }
        break;

      // ---------- DirectXMath (row vectors: v' = v * M) ----------
      case "XMMatrixIdentity":
        return ShaderValue.identity(4);
      case "XMMatrixTranslation":
        return rows([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [S(0), S(1), S(2), 1]]);
      case "XMMatrixScaling":
        return rows([[S(0), 0, 0, 0], [0, S(1), 0, 0], [0, 0, S(2), 0], [0, 0, 0, 1]]);
      case "XMMatrixRotationX": {
        const c = libm.cos(S(0)), s = libm.sin(S(0));
        return rows([[1, 0, 0, 0], [0, c, s, 0], [0, -s, c, 0], [0, 0, 0, 1]]);
      }
      case "XMMatrixRotationY": {
        const c = libm.cos(S(0)), s = libm.sin(S(0));
        return rows([[c, 0, -s, 0], [0, 1, 0, 0], [s, 0, c, 0], [0, 0, 0, 1]]);
      }
      case "XMMatrixRotationZ": {
        const c = libm.cos(S(0)), s = libm.sin(S(0));
        return rows([[c, s, 0, 0], [-s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
      }
      case "XMMatrixRotationAxis": case "XMMatrixRotationNormal":
        // DirectXMath's rotation is the transpose of the column-vector one (row vectors).
        if (a.length === 2) return transpose(axisAngle(S(1), v3(a[0]!)));
        break;
      case "XMMatrixPerspectiveFovLH":
        if (a.length === 4) {
          const h = 1 / libm.tan(S(0) / 2), w = h / S(1), range = S(3) / (S(3) - S(2));
          return rows([[w, 0, 0, 0], [0, h, 0, 0], [0, 0, range, 1], [0, 0, -range * S(2), 0]]);
        }
        break;
      case "XMMatrixPerspectiveFovRH":
        if (a.length === 4) {
          const h = 1 / libm.tan(S(0) / 2), w = h / S(1), range = S(3) / (S(2) - S(3));
          return rows([[w, 0, 0, 0], [0, h, 0, 0], [0, 0, range, -1], [0, 0, range * S(2), 0]]);
        }
        break;
      case "XMMatrixOrthographicRH":
        if (a.length === 4) {
          const range = 1 / (S(2) - S(3));
          return rows([[2 / S(0), 0, 0, 0], [0, 2 / S(1), 0, 0], [0, 0, range, 0], [0, 0, range * S(2), 1]]);
        }
        break;
      case "XMMatrixOrthographicOffCenterRH": case "XMMatrixOrthographicOffCenterLH":
        if (a.length === 6) {
          // (left, right, bottom, top, near, far), as DirectXMath builds it for row vectors.
          const rw = 1 / (S(1) - S(0)), rh = 1 / (S(3) - S(2));
          const rhs = name.endsWith("RH");
          const range = rhs ? 1 / (S(4) - S(5)) : 1 / (S(5) - S(4));
          return rows([[2 * rw, 0, 0, 0], [0, 2 * rh, 0, 0], [0, 0, range, 0], [-(S(0) + S(1)) * rw, -(S(3) + S(2)) * rh, (rhs ? range : -range) * S(4), 1]]);
        }
        break;
      case "XMMatrixLookAtRH":
        if (a.length === 3) {
          // LookAtRH(eye, focus, up) = LookToLH(eye, eye - focus, up).
          const eye = v3(a[0]!);
          const f = a[1]!.padded(3);
          const r2 = normalize3([eye[0]! - f[0]!, eye[1]! - f[1]!, eye[2]! - f[2]!]);
          const r0 = normalize3(cross(v3(a[2]!), r2));
          const r1 = cross(r2, r0);
          return rows([[r0[0]!, r1[0]!, r2[0]!, 0], [r0[1]!, r1[1]!, r2[1]!, 0], [r0[2]!, r1[2]!, r2[2]!, 0], [-dot3(r0, eye), -dot3(r1, eye), -dot3(r2, eye), 1]]);
        }
        break;
      case "XMMatrixOrthographicLH":
        if (a.length === 4) {
          const range = 1 / (S(3) - S(2));
          return rows([[2 / S(0), 0, 0, 0], [0, 2 / S(1), 0, 0], [0, 0, range, 0], [0, 0, -range * S(2), 1]]);
        }
        break;
      case "XMMatrixLookAtLH":
        if (a.length === 3) {
          const eye = v3(a[0]!);
          const f = a[1]!.padded(3);
          const r2 = normalize3([f[0]! - eye[0]!, f[1]! - eye[1]!, f[2]! - eye[2]!]);
          const r0 = normalize3(cross(v3(a[2]!), r2));
          const r1 = cross(r2, r0);
          return rows([[r0[0]!, r1[0]!, r2[0]!, 0], [r0[1]!, r1[1]!, r2[1]!, 0], [r0[2]!, r1[2]!, r2[2]!, 0], [-dot3(r0, eye), -dot3(r1, eye), -dot3(r2, eye), 1]]);
        }
        break;
      case "XMVector3TransformCoord": case "XMVector3TransformNormal": case "XMVector3Transform": case "XMVector4Transform":
        if (a.length === 2 && a[1]!.isMatrix) {
          // DirectXMath's row vector times the matrix: (x, y, z, 1) for a point (divided by w; XMVector3Transform keeps
          // w), w = 0 for a normal.
          const m = a[1]!;
          const v = a[0]!.padded(4);
          const w = name === "XMVector3TransformCoord" || name === "XMVector3Transform" ? 1 : name === "XMVector3TransformNormal" ? 0 : v[3]!;
          const row = [v[0]!, v[1]!, v[2]!, w];
          const r = [0, 0, 0, 0];
          for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) r[c]! += row[k]! * m.v![c * 4 + k]!;
          if (name === "XMVector3TransformCoord" && r[3] !== 0) return ShaderValue.vec(r[0]! / r[3]!, r[1]! / r[3]!, r[2]! / r[3]!, 1);
          return ShaderValue.vecOf(r);
        }
        break;
      case "XMMatrixMultiply":
        if (a.length === 2) return matrixMultiply(a[0]!, a[1]!, line);
        break;
      case "XMMatrixTranspose":
        if (a.length === 1) return transpose(a[0]!);
        break;
      case "XMMatrixInverse":
        if (a.length === 2) return inverse(a[1]!, line);
        break;
      case "XMVectorAdd":
        if (a.length === 2) return ShaderValue.vecOf(zipArrays(a[0]!.padded(4), a[1]!.padded(4), (x, y) => x + y));
        break;
      case "XMVectorSubtract":
        if (a.length === 2) return ShaderValue.vecOf(zipArrays(a[0]!.padded(4), a[1]!.padded(4), (x, y) => x - y));
        break;
      case "XMVectorScale":
        if (a.length === 2) return ShaderValue.vecOf(a[0]!.padded(4).map((x) => x * S(1)));
        break;
      case "XMVector3Cross":
        if (a.length === 2) {
          const c = cross(v3(a[0]!), v3(a[1]!));
          return ShaderValue.vec(c[0]!, c[1]!, c[2]!, 0);
        }
        break;
      case "XMVectorSet":
        if (a.length === 4) return ShaderValue.vec(S(0), S(1), S(2), S(3));
        break;
      case "XMLoadFloat2":
        if (a.length === 1) return ShaderValue.vec(a[0]!.padded(2)[0]!, a[0]!.padded(2)[1]!, 0, 0);
        break;
      case "XMVectorReplicate":
        if (a.length === 1) return ShaderValue.vec(S(0), S(0), S(0), S(0));
        break;
      case "XMVectorSplatX": case "XMVectorSplatY": case "XMVectorSplatZ": case "XMVectorSplatW":
        if (a.length === 1) {
          const c = a[0]!.padded(4)["XYZW".indexOf(name[name.length - 1]!)]!;
          return ShaderValue.vec(c, c, c, c);
        }
        break;
      case "XMVectorZero":
        if (a.length === 0) return ShaderValue.vec(0, 0, 0, 0);
        break;
      case "XMVectorMultiply":
        if (a.length === 2) return ShaderValue.vecOf(zipArrays(a[0]!.padded(4), a[1]!.padded(4), (x, y) => x * y));
        break;
      case "XMVectorDivide":
        if (a.length === 2) return ShaderValue.vecOf(zipArrays(a[0]!.padded(4), a[1]!.padded(4), (x, y) => x / y));
        break;
      case "XMVectorAbs":
        if (a.length === 1) return ShaderValue.vecOf(a[0]!.padded(4).map(Math.abs));
        break;
      case "XMVectorMin": case "XMVectorMax":
        if (a.length === 2) return ShaderValue.vecOf(zipArrays(a[0]!.padded(4), a[1]!.padded(4), (x, y) => (name === "XMVectorMin" ? Math.min(x, y) : Math.max(x, y))));
        break;
      case "XMVectorClamp":
        if (a.length === 3) {
          const v = a[0]!.padded(4);
          const lo = a[1]!.padded(4);
          const hi = a[2]!.padded(4);
          return ShaderValue.vecOf(range(4, (i) => Math.min(Math.max(v[i]!, lo[i]!), hi[i]!)));
        }
        break;
      case "XMVector2Length": case "XMVector2LengthSq":
        if (a.length === 1) {
          const v = a[0]!.padded(2);
          const sq = v[0]! * v[0]! + v[1]! * v[1]!;
          const len = name === "XMVector2Length" ? Math.sqrt(sq) : sq;
          return ShaderValue.vec(len, len, len, len);
        }
        break;
      case "XMVector2Dot":
        if (a.length === 2) {
          const p = a[0]!.padded(2);
          const q = a[1]!.padded(2);
          const dot = p[0]! * q[0]! + p[1]! * q[1]!;
          return ShaderValue.vec(dot, dot, dot, dot);
        }
        break;
      case "XMVector2Normalize":
        if (a.length === 1) {
          // DirectXMath scales the whole vector by 1 / its 2D length.
          const v = a[0]!.padded(4);
          const len = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]!);
          return ShaderValue.vecOf(v.map((x) => (len > 0 ? x / len : 0)));
        }
        break;
      case "XMLoadFloat3":
        // An XMVECTOR has four components: w = 0 for a loaded XMFLOAT3.
        if (a.length === 1 && !a[0]!.isMatrix) return ShaderValue.vec(a[0]!.padded(3)[0]!, a[0]!.padded(3)[1]!, a[0]!.padded(3)[2]!, 0);
        if (a.length === 1) return a[0]!;
        break;
      case "XMLoadFloat4": case "XMLoadFloat4x4": case "XMLoadFloat3x3":
        if (a.length === 1) return a[0]!;
        break;
      case "XMVectorGetX": case "XMVectorGetY": case "XMVectorGetZ": case "XMVectorGetW":
        if (a.length === 1) return ShaderValue.scalar(a[0]!.padded(4)["XYZW".indexOf(name[name.length - 1]!)]!);
        break;
      case "XMVector3Length":
        if (a.length === 1) {
          const v = v3(a[0]!);
          const len = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
          return ShaderValue.vec(len, len, len, len);
        }
        break;
      case "XMVector3Dot":
        if (a.length === 2) {
          const p = v3(a[0]!);
          const q = v3(a[1]!);
          const dot = p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
          return ShaderValue.vec(dot, dot, dot, dot);
        }
        break;
      case "XMVectorNegate":
        if (a.length === 1) return ShaderValue.vecOf(a[0]!.padded(4).map((x) => -x));
        break;
      case "XMVector3Normalize":
        if (a.length === 1) {
          const n = normalize3(v3(a[0]!));
          return ShaderValue.vec(n[0]!, n[1]!, n[2]!, 0);
        }
        break;
    }
    return null;
  }

  // ---------- C++ mode: the C++ library and FreeType (ShaderRunner.CppLibrary.cs) ----------

  /** std::cout &lt;&lt; x: x as C++ prints it (a float with 6 significant digits); a finished line goes out. */
  private consoleWrite(value: ShaderValue): ShaderValue {
    const v = value.v;
    const text = value.text ?? (v !== null && v.length === 1
      ? value.int || (v[0] === Math.floor(v[0]!) && Math.abs(v[0]!) < 1e15) ? toLongBig(v[0]!).toString() : formatG(v[0]!, 6)
      : value.toString());
    let all = this.console + text;
    let nl: number;
    while ((nl = all.indexOf("\n")) >= 0) {
      this.output?.(all.slice(0, nl));
      all = all.slice(nl + 1);
    }
    this.console = all;
    return ConsoleValue;
  }

  private isFormat(e: A.Expr): boolean {
    try {
      return this.eval(e).text !== null;
    } catch (x) {
      if (!isRuntime(x)) throw x;
      return false;
    }
  }

  /** printf's formatting: %d %i %u %ld %f %.2f %e %g %s %c %x %X %08X %p %% (format, then the arguments). */
  private printf(args: readonly A.Expr[]): string {
    const format = this.eval(args[0]!).text ?? "";
    let sb = "";
    let next = 1;
    const arg = (): ShaderValue => (next < args.length ? this.eval(args[next++]!) : ShaderValue.scalar(0));
    for (let i = 0; i < format.length; i++) {
      if (format[i] !== "%" || i + 1 >= format.length) {
        sb += format[i];
        continue;
      }
      const spec = /^([-+ 0#]*)(\d+|\*)?(?:\.(\d+|\*))?(hh|h|ll|l|L|z|j|t|I64|I32)?([diouxXfFeEgGcspn%])/.exec(format.slice(i + 1));
      if (!spec) {
        sb += "%";
        continue;
      }
      i += spec[0].length;
      const flags = spec[1]!;
      const widthText = spec[2] ?? "", precisionText = spec[3] ?? "";
      const width = widthText === "*" ? toInt(arg().x) : (tryParseInt(widthText) ?? 0);
      const precision = precisionText === "*" ? toInt(arg().x) : tryParseInt(precisionText);
      const kind = spec[5]!;
      let text: string;
      switch (kind) {
        case "%":
          text = "%";
          break;
        case "d": case "i":
          text = toLongBig(Math.trunc(arg().x)).toString();
          break;
        case "u":
          text = BigInt.asUintN(64, toLongBig(Math.trunc(arg().x))).toString();
          break;
        case "x": case "X": {
          const s = BigInt.asUintN(32, toLongBig(Math.trunc(arg().x))).toString(16);
          text = kind === "x" ? s : s.toUpperCase();
          break;
        }
        case "o": {
          const l = toLongBig(Math.trunc(arg().x));
          text = (l < 0n ? BigInt.asUintN(64, l) : l).toString(8);
          break;
        }
        case "c":
          text = toChar(arg().x);
          break;
        case "s": {
          const v = arg();
          text = v.text ?? v.toString();
          if (precision !== null && text.length > precision) text = text.slice(0, precision);
          break;
        }
        case "p":
          text = "0x" + hex64(arg().x);
          break;
        case "e": case "E":
          text = formatE(arg().x, precision ?? 6, kind === "E");
          break;
        case "g": case "G":
          text = formatG(arg().x, precision ?? 6);
          break;
        default:
          text = formatFixed(arg().x, precision ?? 6);
          break;
      }
      if (text.length < width) {
        text = flags.includes("-") ? text.padEnd(width)
          : flags.includes("0") && kind !== "s" && kind !== "c" ? (text.startsWith("-") ? "-" + text.slice(1).padStart(width - 1, "0") : text.padStart(width, "0"))
          : text.padStart(width);
      }
      sb += text;
    }
    return sb;
  }

  /** The C++ library and FreeType calls the runner answers itself, or null. */
  private cppLibrary(c: A.Call, name: string): ShaderValue | null {
    const args = c.args;
    if (["snprintf", "_snprintf", "swprintf", "_snwprintf", "sprintf_s", "swprintf_s"].includes(name) && args.length >= 3 && this.isFormat(args[2]!)) {
      // snprintf(buffer, size, format, …): the formatted text into the buffer.
      this.store(args[0]!, ShaderValue.str(this.printf(args.slice(2))));
      return ShaderValue.scalar(0);
    }
    if (["sprintf", "sprintf_s", "swprintf", "wsprintfA", "wsprintfW", "wsprintf"].includes(name) && args.length >= 2 && this.isFormat(args[1]!)) {
      this.store(args[0]!, ShaderValue.str(this.printf(args.slice(1))));
      return ShaderValue.scalar(0);
    }
    switch (name) {
      case "printf":
        if (args.length >= 1) {
          this.consoleWrite(ShaderValue.str(this.printf(args)));
          return ShaderValue.scalar(0);
        }
        break;
      case "OutputDebugStringA": case "OutputDebugStringW": case "OutputDebugString":
        if (args.length === 1) {
          // Windows' debugger output (Visual Studio's Output window): the output pane, like std::cout.
          this.consoleWrite(this.eval(args[0]!));
          return ShaderValue.scalar(0);
        }
        break;
      case "__assign":
        if (args.length === 2) {
          const assigned = this.eval(args[1]!);
          this.store(args[0]!, assigned);
          return assigned;
        }
        break;
      case "ifstream": case "fstream": {
        // std::ifstream file(path): the project's file (a stream that fails when it does not exist).
        const path = args.length > 0 ? this.eval(args[0]!).text : null;
        return newStream(path === null ? null : (this.readText?.(path) ?? null));
      }
      case "istringstream": case "stringstream":
        return newStream(args.length > 0 ? (this.eval(args[0]!).text ?? this.eval(args[0]!).toString()) : "");
      case "getline":
        if (args.length >= 2) {
          const stream = this.eval(args[0]!);
          if (isStream(stream)) {
            const text = stream.fields!.get(StreamText)!.text ?? "";
            const pos = toInt(stream.fields!.get(StreamPos)!.x);
            if (pos >= text.length) {
              stream.fields!.set(StreamOk, ShaderValue.scalar(0));
              return ShaderValue.scalar(0);
            }
            let end = text.indexOf("\n", pos);
            if (end < 0) end = text.length;
            this.store(args[1]!, ShaderValue.str(trimChars(text.slice(pos, end), "\r", false, true)));
            stream.fields!.set(StreamPos, ShaderValue.scalar(end + 1));
            return ShaderValue.scalar(1);
          }
        }
        break;
      case "memcpy":
        if (args.length === 3) {
          const dst = this.pointer(args[0]!);
          const into = dst.container?.items ?? null;
          if (into !== null) {
            // memcpy into an array of the program (a glyph's rows into an atlas vector): element by element – bytes, or
            // 4-byte numbers when the size is counted with sizeof(float).
            const { container: from, offset: at } = this.pointer(args[1]!);
            const bytes = toLong(this.eval(args[2]!).x);
            const sizeText = exprText(args[2]!);
            const fours = sizeText.includes("sizeof") && !sizeText.includes("char");
            const count = fours ? Math.trunc(bytes / 4) : bytes;
            for (let i = 0; i < count; i++) {
              const s = at + i, d = dst.offset + i;
              if (d < 0 || d >= into.length) break;
              let v: number | null;
              const fv = from?.v ?? null;
              if (fv !== null) {
                if (s < 0) throw new RangeError("Index was outside the bounds of the array.");
                v = s < fv.length ? fv[s]! : null;
              } else {
                const fi = from?.items ?? null;
                if (fi !== null && s < 0) throw new RangeError("Index was outside the bounds of the array.");
                v = fi !== null && s < fi.length ? fi[s]!.x : null;
              }
              if (v === null) break;
              into[d] = ShaderValue.integer(v);
            }
            return ShaderValue.scalar(0);
          }
        }
        break;
      case "FT_Init_FreeType":
        if (args.length === 1) {
          this.store(args[0]!, ShaderValue.str("FT_Library"));
          return ShaderValue.integer(0);
        }
        break;
      case "FT_New_Face":
        if (args.length >= 4) {
          // FT_New_Face(ft, path, 0, &face): 0 when the font loads (a font the simulator has glyphs for).
          const path = this.eval(args[1]!).text;
          const bytes = path === null ? null : (this.readBytes?.(path) ?? null);
          const font = bytes === null ? null : FreeTypeGlyphs.identify(bytes);
          if (font === null) return ShaderValue.integer(1);
          this.store(args[3]!, ShaderValue.struct(new Map([
            ["__font", ShaderValue.str(font)],
            ["__size", ShaderValue.integer(0)],
            ["glyph", newGlyph(null)],
          ])));
          return ShaderValue.integer(0);
        }
        break;
      case "FT_Set_Pixel_Sizes":
        if (args.length >= 3) {
          const face = this.eval(args[0]!).fields;
          if (face !== null && face.has("__font")) {
            const width = toInt(this.eval(args[1]!).x), height = toInt(this.eval(args[2]!).x);
            face.set("__size", ShaderValue.integer(height === 0 ? width : height));
            return ShaderValue.integer(0);
          }
        }
        break;
      case "FT_Load_Char":
        if (args.length >= 2) {
          const face = this.eval(args[0]!).fields;
          if (face !== null && face.has("__font")) {
            const code = toInt(this.eval(args[1]!).x);
            const font = face.get("__font")!.text ?? "";
            const size = toInt(face.get("__size")!.x);
            if (!FreeTypeGlyphs.sizesOf(font).includes(size)) return ShaderValue.integer(1);
            // A character the font has no glyph for gets the empty glyph (FreeType loads glyph 0, .notdef).
            face.set("glyph", newGlyph(FreeTypeGlyphs.get(font, size, code)));
            return ShaderValue.integer(0);
          }
        }
        break;
      case "FT_Done_Face": case "FT_Done_FreeType":
        return ShaderValue.integer(0);
    }
    return null;
  }

  /** What a C++ pointer argument points at: the array and the element (&amp;a[i], buffer + n, v.data()). */
  private pointer(e: A.Expr): { container: ShaderValue | null; offset: number } {
    try {
      if (e instanceof A.IndexOf) return { container: this.eval(e.target), offset: toLong(this.eval(e.at).x) };
      if (e instanceof A.Binary && e.op === "+") {
        const { container, offset } = this.pointer(e.left);
        return { container, offset: offset + toLong(this.eval(e.right).x) };
      }
      if (e instanceof A.Call && e.function_ === ".data" && e.args.length === 1) return this.pointer(e.args[0]!);
      return { container: this.eval(e), offset: 0 };
    } catch (x) {
      if (!isRuntime(x)) throw x;
      return { container: null, offset: 0 };
    }
  }

  /** stream &lt;&lt; x: appends x (another stream's rest – file.rdbuf() –, a string or a number). */
  private streamWrite(stream: ShaderValue, value: ShaderValue): ShaderValue {
    let text: string;
    if (isStream(value)) {
      const all = value.fields!.get(StreamText)!.text ?? "";
      const at = Math.min(all.length, toInt(value.fields!.get(StreamPos)!.x));
      text = all.slice(at);
      value.fields!.set(StreamPos, ShaderValue.scalar(all.length));
    } else text = value.text ?? value.toString();
    stream.fields!.set(StreamText, ShaderValue.str((stream.fields!.get(StreamText)!.text ?? "") + text));
    stream.fields!.set(StreamOk, ShaderValue.scalar(1));
    return stream;
  }

  /** A stream declared without arguments (std::stringstream ss; std::ifstream file; – opened later). */
  static emptyStream(type: string): ShaderValue | null {
    switch (type) {
      case "stringstream": case "ostringstream": case "istringstream":
        return newStream("");
      case "ifstream": case "fstream":
        return newStream(null);
      default:
        return null;
    }
  }

  /** stream &gt;&gt; x: the next whitespace-separated word into x (as a number when x holds one); 0 at the end. */
  private streamRead(stream: ShaderValue, target: A.Expr): ShaderValue {
    const text = stream.fields!.get(StreamText)!.text ?? "";
    let pos = toInt(stream.fields!.get(StreamPos)!.x);
    while (pos < text.length && isWhiteSpace(text[pos])) pos++;
    const start = pos;
    while (pos < text.length && !isWhiteSpace(text[pos])) pos++;
    stream.fields!.set(StreamPos, ShaderValue.scalar(pos));
    if (start === pos) {
      stream.fields!.set(StreamOk, ShaderValue.scalar(0));
      return ShaderValue.scalar(0);
    }
    const word = text.slice(start, pos);
    let old: ShaderValue | null = null;
    try {
      old = this.eval(target);
    } catch (e) {
      if (!isRuntime(e)) throw e;
    }
    const number = tryParseDouble(word, false);
    if (old?.text != null) this.store(target, ShaderValue.str(word));
    else if (number !== null) this.store(target, old?.int === true ? ShaderValue.integer(Math.trunc(number)) : ShaderValue.scalar(number));
    else {
      stream.fields!.set(StreamOk, ShaderValue.scalar(0));
      return ShaderValue.scalar(0);
    }
    return ShaderValue.scalar(1);
  }
}

// ---------- helpers of the runner (static members in C#) ----------

/** Enumerable.Range(0, n).Select(f).ToArray(). */
function range<T>(n: number, f: (i: number) => T): T[] {
  const r = new Array<T>(Math.max(0, n));
  for (let i = 0; i < r.length; i++) r[i] = f(i);
  return r;
}

/** ToDictionary: a duplicate key throws, as in C#. */
function toDictionary<T>(items: readonly T[], key: (t: T) => string, value: (t: T) => ShaderValue): Map<string, ShaderValue> {
  const map = new Map<string, ShaderValue>();
  for (const item of items) {
    const k = key(item);
    if (map.has(k)) throw new Error(`An item with the same key has already been added. Key: ${k}`);
    map.set(k, value(item));
  }
  return map;
}

/** The UTF-16 code units of a string (a C# string's chars). */
function* utf16(s: string): Generator<number> {
  for (let i = 0; i < s.length; i++) yield s.charCodeAt(i);
}

/** Enumerable.Sum: left to right from 0. */
function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Enumerable.Zip: as long as the shorter. */
function zipArrays(a: readonly number[], b: readonly number[], fn: (x: number, y: number) => number): number[] {
  const n = Math.min(a.length, b.length);
  const r = new Array<number>(n);
  for (let i = 0; i < n; i++) r[i] = fn(a[i]!, b[i]!);
  return r;
}

/** Enumerable.Union / Intersect of names (distinct, in first-seen order). */
function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function intersect(a: string[], b: string[]): string[] {
  const right = new Set(b);
  return [...new Set(a.filter((x) => right.has(x)))];
}

/** A struct, an array or a map: what a C++ reference or pointer refers to without a copy. */
function isObject(v: ShaderValue): boolean {
  return v.fields !== null || v.items !== null || v.map !== null;
}

/** True: a non-zero number; in C++ also a handle or a set of flags (a name), but not a null handle. */
function truthy(v: ShaderValue): boolean {
  if (v.v !== null && v.v.length > 0) return v.v[0] !== 0;
  // if (fstream): a stream is true while it is good.
  const ok = v.fields?.get(StreamOk);
  if (ok !== undefined) return ok.x !== 0;
  // C++: a pointer to an object or a container (if (!scene), if (mesh->mTextureCoords[0])) is not null.
  const t = v.text;
  return v.fields !== null || v.isArray || v.map !== null || (t !== null && t.length > 0 && t !== "VK_NULL_HANDLE" && t !== "nullptr" && t !== "NULL");
}

/** A value stored into a variable keeps the variable's number of components (float → vecN broadcasts). */
function like(old: ShaderValue, value: ShaderValue): ShaderValue {
  // A float variable given an integer holds a float (x = 1; x / 2 is 0.5).
  if (value.int && old.v !== null && old.v.length === 1 && !old.int) return ShaderValue.scalar(value.x);
  if (old.v === null || value.v === null || old.isMatrix || value.isMatrix || old.v.length === value.v.length) return value;
  if (value.v.length === 1) return ShaderValue.vecOf(new Array<number>(old.v.length).fill(value.v[0]!));
  return ShaderValue.vecOf(value.padded(old.v.length));
}

/**
 * A DirectXMath matrix member: r (its rows, as DirectXMath's row vectors use them) or _RC. The runner keeps a matrix
 * column by column of the row-vector convention: row i is element i of each column.
 */
function matrixMember(matrix: ShaderValue, field: string): ShaderValue | null {
  const n = matrix.cols;
  if (field === "r") return ShaderValue.array(range(n, (row) => ShaderValue.vecOf(range(n, (col) => matrix.v![col * n + row]!))));
  if (field.length === 3 && field[0] === "_") {
    const r = field.charCodeAt(1) - 49, c = field.charCodeAt(2) - 49;
    if (r >= 0 && c >= 0 && r < n && c < n) return ShaderValue.scalar(matrix.v![c * n + r]!);
  }
  return null;
}

function negated(v: ShaderValue): ShaderValue {
  const r = v.v!.map((x) => -x);
  return new ShaderValue({ v: r, cols: v.cols, int: v.int });
}

/** The integer and remaining operators of BinaryOp (C# longs for &amp; | ^ &lt;&lt; &gt;&gt;). */
function intOp(op: string, x: number, y: number, line: number): number {
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "%": return y === 0 ? 0 : x % y;
    case "&": return and64(x, y);
    case "|": return or64(x, y);
    case "^": return xor64(x, y);
    // 32 bits, as uint has (the bits shifted out are gone).
    case "<<": return shl32(x, y);
    case ">>": return sar64(x, y);
    default: throw new ShaderRuntimeException(`unsupported operator '${op}'`, line);
  }
}

function describe(v: ShaderValue): string {
  return v.isMatrix ? `mat${v.cols}` : v.size === 1 ? "float" : `vec${v.size}`;
}

/** GLSL: matrices are column-major, mat * vec treats vec as a column, vec * mat as a row. */
export function matrixMultiply(a: ShaderValue, b: ShaderValue, line: number): ShaderValue {
  if (a.isMatrix && b.isMatrix) {
    const n = a.cols;
    if (b.cols !== n) throw new ShaderRuntimeException("matrix sizes do not match", line);
    const r = new Array<number>(n * n);
    for (let c = 0; c < n; c++)
      for (let row = 0; row < n; row++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += a.v![k * n + row]! * b.v![c * n + k]!;
        r[c * n + row] = s;
      }
    return ShaderValue.matrix(n, r);
  }
  if (a.isMatrix) {
    const n = a.cols;
    if (b.size === 1) return new ShaderValue({ v: a.v!.map((x) => x * b.x), cols: n });
    if (b.size !== n) throw new ShaderRuntimeException(`cannot multiply a mat${n} by a vec${b.size}`, line);
    const r = new Array<number>(n).fill(0);
    for (let row = 0; row < n; row++) for (let k = 0; k < n; k++) r[row]! += a.v![k * n + row]! * b.v![k]!;
    return ShaderValue.vecOf(r);
  }
  const n = b.cols;
  if (a.size === 1) return new ShaderValue({ v: b.v!.map((x) => x * a.x), cols: n });
  if (a.size !== n) throw new ShaderRuntimeException(`cannot multiply a vec${a.size} by a mat${n}`, line);
  const r = new Array<number>(n).fill(0);
  for (let c = 0; c < n; c++) for (let k = 0; k < n; k++) r[c]! += a.v![k]! * b.v![c * n + k]!;
  return ShaderValue.vecOf(r);
}

function countNumbers(v: ShaderValue): number {
  if (v.v !== null) return v.v.length;
  const items = v.items;
  if (items !== null) return sum(items.map(countNumbers));
  if (v.fields !== null) return sum([...v.fields.values()].map(countNumbers));
  return 0;
}

function componentwise(a: ShaderValue, b: ShaderValue, fn: (x: number, y: number) => number, line: number): ShaderValue {
  const av = a.v, bv = b.v;
  if (av === null || bv === null) throw new ShaderRuntimeException("expected numbers", line);
  const n = Math.max(av.length, bv.length);
  const r = new Array<number>(n);
  for (let i = 0; i < n; i++) r[i] = fn(av[av.length === 1 ? 0 : Math.min(i, av.length - 1)]!, bv[bv.length === 1 ? 0 : Math.min(i, bv.length - 1)]!);
  return ShaderValue.vecOf(r);
}

function vectorConstructor(type: string, n: number, args: ShaderValue[], line: number): ShaderValue {
  const parts: number[] = [];
  for (const a of args) {
    if (a.v === null) throw new ShaderRuntimeException(`cannot build a ${type} from this value`, line);
    parts.push(...a.v);
  }
  if (parts.length === 0) return ShaderValue.vecOf(new Array<number>(n).fill(0));
  if (parts.length === 1) return ShaderValue.vecOf(new Array<number>(n).fill(parts[0]!));
  if (parts.length < n) throw new ShaderRuntimeException(`too few components to construct '${type}'`, line);
  return ShaderValue.vecOf(parts.slice(0, n));
}

function matrixConstructor(n: number, args: ShaderValue[], line: number): ShaderValue {
  if (args.length === 0) return ShaderValue.identity(n);
  if (args.length === 1 && args[0]!.v !== null && args[0]!.v.length === 1) {
    const r = ShaderValue.identity(n);
    return ShaderValue.matrix(n, r.v!.map((x) => x * args[0]!.x));
  }
  if (args.length === 1 && args[0]!.isMatrix) {
    const src = args[0]!;
    const r = ShaderValue.identity(n).v!;
    for (let col = 0; col < Math.min(n, src.cols); col++)
      for (let row = 0; row < Math.min(n, src.cols); row++) r[col * n + row] = src.v![col * src.cols + row]!;
    return ShaderValue.matrix(n, r);
  }
  const flat: number[] = [];
  for (const a of args) {
    if (a.v === null) throw new ShaderRuntimeException("cannot build a matrix from this value", line);
    flat.push(...a.v);
  }
  if (flat.length !== n * n) throw new ShaderRuntimeException(`a mat${n} needs ${n * n} components`, line);
  return ShaderValue.matrix(n, flat);
}

/** The width and height a program addresses an image's texels in (Image.ProgramSize), or null for no image. */
function programSize(image: Image | null): [number, number] | null {
  return image === null ? null : image.programSize;
}

function exprText(e: A.Expr): string {
  if (e instanceof A.Call) return e.function_ + "(" + e.args.map(exprText).join(",") + ")";
  if (e instanceof A.Binary) return exprText(e.left) + e.op + exprText(e.right);
  if (e instanceof A.Name) return e.id;
  if (e instanceof A.Member) return exprText(e.target) + "." + e.field;
  return "";
}

/** face->glyph: bitmap (width, rows, pitch, buffer), bitmap_left, bitmap_top, advance (x in 1/64 pixel). */
function newGlyph(g: Glyph | null): ShaderValue {
  return ShaderValue.struct(new Map([
    ["bitmap", ShaderValue.struct(new Map([
      ["width", ShaderValue.integer(g?.width ?? 0)],
      ["rows", ShaderValue.integer(g?.rows ?? 0)],
      ["pitch", ShaderValue.integer(g?.pitch ?? 0)],
      // The coverage bytes, row by row from the top (what glTexImage2D receives as GL_UNSIGNED_BYTE data).
      ["buffer", g === null || g.bitmap.length === 0 ? ShaderValue.str("nullptr") : ShaderValue.vecOf(Array.from(g.bitmap))],
    ]))],
    ["bitmap_left", ShaderValue.integer(g?.left ?? 0)],
    ["bitmap_top", ShaderValue.integer(g?.top ?? 0)],
    ["advance", ShaderValue.struct(new Map([
      ["x", ShaderValue.integer(g?.advance ?? 0)],
      ["y", ShaderValue.integer(0)],
    ]))],
  ]));
}

const UnaryMath: ((x: number) => number)[] = [
  libm.sin, libm.cos, libm.tan, libm.asin, libm.acos, libm.atan, (x) => (x * Math.PI) / 180, (x) => (x * 180) / Math.PI, libm.exp, (x) => libm.pow(2, x),
  libm.log, libm.log2, Math.sqrt, (x) => 1 / Math.sqrt(x), Math.abs, sign, Math.floor, Math.ceil, roundEven, Math.trunc,
  (x) => x - Math.floor(x), (x) => clamp(x, 0, 1),
];

const BinaryMath: ((x: number, y: number) => number)[] = [
  libm.pow, (x, y) => x - y * Math.floor(x / y), (x, y) => x % y, Math.min, Math.max, (edge, x) => (x < edge ? 0 : 1), libm.atan2,
];

/** The built-in functions with a fast path: 0–99 one argument, 100–199 two, 200 and up their own code. */
const FastCalls = new Map<string, number>([
  ["sin", 0], ["cos", 1], ["tan", 2], ["asin", 3], ["acos", 4], ["atan", 5], ["radians", 6], ["degrees", 7], ["exp", 8], ["exp2", 9],
  ["log", 10], ["log2", 11], ["sqrt", 12], ["inversesqrt", 13], ["rsqrt", 13], ["abs", 14], ["fabs", 14], ["sign", 15], ["floor", 16], ["ceil", 17],
  ["round", 18], ["trunc", 19], ["fract", 20], ["frac", 20], ["saturate", 21],
  ["pow", 100], ["mod", 101], ["fmod", 102], ["min", 103], ["max", 104], ["step", 105], ["atan2", 106],
  ["clamp", 200], ["mix", 201], ["lerp", 201], ["length", 202], ["dot", 203], ["normalize", 204], ["cross", 205], ["reflect", 206],
  ["texture", 300], ["texture2D", 300], ["textureCube", 300], ["textureLod", 301],
]);

// ---------- the matrix helpers (ShaderRunner.Matrices.cs) ----------

function M(n: number, at: (r: number, c: number) => number): ShaderValue {
  const v = new Array<number>(n * n);
  for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) v[c * n + r] = at(r, c);
  return ShaderValue.matrix(n, v);
}

/** A 4×4 matrix from its rows (as DirectXMath and the docs write them). */
function rows(r: number[][]): ShaderValue {
  return M(4, (row, c) => r[row]![c]!);
}

function v3(v: ShaderValue): number[] {
  return v.padded(3);
}

function normalize3(v: number[]): number[] {
  const l = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
  return l === 0 ? v : [v[0]! / l, v[1]! / l, v[2]! / l];
}

function cross(a: number[], b: number[]): number[] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}

function dot3(a: number[], b: number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

/** A rotation about a normalised axis (right-handed, counter-clockwise looking down the axis) as a column-vector matrix. */
function axisAngle(angle: number, axis: number[]): ShaderValue {
  const a = normalize3(axis);
  const c = libm.cos(angle), s = libm.sin(angle), t = 1 - c;
  const x = a[0]!, y = a[1]!, z = a[2]!;
  return rows([
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0],
    [0, 0, 0, 1],
  ]);
}

/** A quaternion's rotation (x, y, z, w) as a column-vector matrix (GLM's toMat4). */
function quaternionMatrix(q: number[], n: number): ShaderValue {
  const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
  const r = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 0],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 0],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y), 0],
    [0, 0, 0, 1],
  ];
  return M(n, (row, col) => r[row]![col]!);
}

/** Spherical interpolation the short way round (GLM's slerp, DirectXMath's XMQuaternionSlerp); nearly equal: linear. */
function slerp(x: number[], y: number[], t: number, linearAbove: number): ShaderValue {
  let cos = x[0]! * y[0]! + x[1]! * y[1]! + x[2]! * y[2]! + x[3]! * y[3]!;
  const z = y.slice();
  if (cos < 0) {
    for (let i = 0; i < 4; i++) z[i] = -z[i]!;
    cos = -cos;
  }
  const r = new Array<number>(4);
  if (cos > linearAbove) {
    for (let i = 0; i < 4; i++) r[i] = x[i]! + (z[i]! - x[i]!) * t;
    return ShaderValue.vecOf(r);
  }
  const angle = libm.acos(Math.min(1, cos)), s = libm.sin(angle);
  const a = libm.sin((1 - t) * angle) / s, b = libm.sin(t * angle) / s;
  for (let i = 0; i < 4; i++) r[i] = a * x[i]! + b * z[i]!;
  return ShaderValue.vecOf(r);
}

function transpose(m: ShaderValue): ShaderValue {
  return M(m.cols, (r, c) => m.v![r * m.cols + c]!);
}

function inverse(m: ShaderValue, line: number): ShaderValue {
  const n = m.cols;
  const a: number[][] = range(n, () => new Array<number>(2 * n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) a[r]![c] = m.v![c * n + r]!;
    a[r]![n + r] = 1;
  }
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) throw new ShaderRuntimeException("the matrix cannot be inverted", line);
    for (let c = 0; c < 2 * n; c++) [a[col]![c], a[pivot]![c]] = [a[pivot]![c]!, a[col]![c]!];
    const p = a[col]![col]!;
    for (let c = 0; c < 2 * n; c++) a[col]![c]! /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      for (let c = 0; c < 2 * n; c++) a[r]![c]! -= f * a[col]![c]!;
    }
  }
  return M(n, (r, c) => a[r]![n + c]!);
}
