import { roundEven, toInt, tryParseInt } from "../internal/dotnet.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import type { Scene } from "../Scene/Scene.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException, ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppSource } from "./CppSource.js";
import { StructLayout } from "./StructLayout.js";

/** A hook of the C++ runner: an API call by name with its argument expressions; null when it is not one. */
export type CppHook = (name: string, args: readonly A.Expr[]) => ShaderValue | null;

const MaxHelperDepth = 48;

const D3D12Limits = new Map<string, number>([
  ["D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR", 64],
  ["D3D12_TESSELLATOR_MAX_ODD_TESSELLATION_FACTOR", 63],
  ["D3D12_TESSELLATOR_MAX_EVEN_TESSELLATION_FACTOR", 64],
  ["D3D12_TESSELLATOR_MIN_ODD_TESSELLATION_FACTOR", 1],
  ["D3D12_TESSELLATOR_MIN_EVEN_TESSELLATION_FACTOR", 2],
  ["D3D12_IA_PATCH_MAX_CONTROL_POINT_COUNT", 32],
  ["D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION", 65535],
  ["D3D12_CS_THREAD_GROUP_MAX_X", 1024],
  ["D3D12_CS_THREAD_GROUP_MAX_Y", 1024],
  ["D3D12_CS_THREAD_GROUP_MAX_Z", 64],
  ["D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP", 1024],
  ["D3D12_CS_TGSM_REGISTER_COUNT", 8192],
  ["D3D12_REQ_TEXTURE2D_U_OR_V_DIMENSION", 16384],
  ["D3D12_SIMULTANEOUS_RENDER_TARGET_COUNT", 8],
]);

interface Helper {
  params: { name: string; ref: boolean; default_: string | null }[];
  body: A.Stmt[];
}

const isObjectValue = (v: ShaderValue): boolean => v.fields !== null || v.items !== null || v.map !== null;

/**
 * Runs the learner's C++ the way the program would, for the values the GPU gets: locals, structs (UBO and constant
 * buffer structs), GLM / DirectXMath maths, loops and ifs, at a point in time. What it does not understand is skipped;
 * API calls go to a hook (the readers record draws, push constants and root constants there).
 */
export class CppExec {
  readonly runner: ShaderRunner;

  /**
   * Getters of the program's classes (std::map&lt;…&gt;&amp; GetBoneInfoMap() { return m_BoneInfoMap; }): method → the member
   * it returns – so a call on an object the reader made (a Model) answers with that member.
   */
  readonly getters = new Map<string, string>();

  /** The reader's answers to API queries the program's own code evaluates (null: not one of them). */
  apiValue: CppHook | null = null;

  private helperDepth = 0;
  private readonly helpers = new Map<string, Helper | null>();
  private readonly parsedStatements = new Map<string, A.Stmt[]>();
  private readonly parsedExpressions = new Map<string, A.Expr | null>();

  constructor(private readonly src: CppSource, time: number, hook: CppHook | null = null, private readonly scene: Scene | null = null) {
    const program = new ShaderProgram();
    for (const m of matchesAll(/\bstruct\s+(\w+)\s*(?::\s*(?:public\s+)?\w+\s*)?\{/g, src.code)) {
      const name = m[1]!;
      const fields = StructLayout.fields(src, name);
      if (fields === null) continue;
      // Default member initialisers (unsigned int Width = SCREEN_WIDTH;) are what a new value starts with.
      const defaults = StructLayout.defaults(src, name);
      program.structs.push(new A.Struct(name, fields.map((f) => {
        const per = StructLayout.floatsOf(f.type);
        let init: A.Expr | null = null;
        const text = defaults.get(f.name);
        if (text !== undefined && (text.trim() === "{}" || text.trim() === "{ }")) init = new A.InitList([], 0);
        else if (text !== undefined) {
          try {
            init = ShaderParser.parseExpression(CppSource.prepare(text));
          } catch (e) {
            if (!(e instanceof ShaderSyntaxException)) throw e;
          }
        }
        return new A.Field(f.type, f.name, null, f.floats > per ? Math.trunc(f.floats / per) : 0, init);
      })));
    }
    this.runner = new ShaderRunner(program, {
      lenient: true,
      time,
      // Without a hook of its own (the OpenGL reader), the program's helpers that make no API calls run here. The
      // reader can answer API queries first (glGetError, glGetShaderiv …: apiValue).
      hook: (name, args) => this.getter(name, args) ?? this.apiValue?.(name, args) ?? (hook ?? ((n, a) => this.helperFunction(n, a)))(name, args),
      depthZeroToOne: src.code.includes("GLM_FORCE_DEPTH_ZERO_TO_ONE"),
    });
    this.runner.resolve = (name) => this.resolve(name);
    this.addGetters(src.code);
    this.runner.elementDefault = (target) => {
      const name = target instanceof A.Name ? target.id : target instanceof A.Member ? target.field : null;
      const declared = name === null ? null : src.declaredType(name);
      if (declared === null) return null;
      const element = /vector\s*<\s*(?:unsigned\s+)?([\w:]+)/.exec(declared);
      if (element === null) return null;
      const type = element[1]!.replaceAll("glm::", "").replaceAll("DirectX::", "").replaceAll("std::", "");
      // An API type the program does not declare is a placeholder (its name): a handle stays one, a struct becomes one
      // when a field is set (attributeDescriptions[4].location = 4).
      return this.runner.default(type);
    };
  }

  /** Adds the trivial getters of a piece of C++ (a header of the project). */
  addGetters(code: string): void {
    for (const m of matchesAll(/\b(\w+)\s*\(\s*\)\s*(?:const\s*)?\{\s*return\s+(?:this\s*->\s*)?(\w+)\s*;\s*\}/g, code))
      if (!this.getters.has(m[1]!)) this.getters.set(m[1]!, m[2]!);
  }

  private getter(name: string, args: readonly A.Expr[]): ShaderValue | null {
    if (args.length !== 1 || name.length < 2 || name[0] !== ".") return null;
    const field = this.getters.get(name.slice(1));
    if (field === undefined) return null;
    return this.tryEval(args[0]!)?.fields?.get(field) ?? null;
  }

  /**
   * A call of one of the program's own functions that makes no graphics API calls (learnopengl's ourLerp in the SSAO
   * kernel): its body runs with the arguments, reference parameters written back. Functions with gl* calls are left to
   * the OpenGL reader, which follows them itself.
   */
  private helperFunction(name: string, args: readonly A.Expr[]): ShaderValue | null {
    // A recursive function goes as deep as the program's data (a scene graph's chain of eleven entities); the limit
    // only stops a recursion that never ends.
    if (this.helperDepth > MaxHelperDepth || name === "main" || name.startsWith(".") || !this.src.functions.has(name)) return null;
    name = this.src.chooseOverload(name, args, (e) => this.tryEval(e));
    let helper = this.helpers.get(name);
    if (helper === undefined) {
      const body = this.src.expandedBody(name) ?? "";
      const declared = this.src.parametersOf(name);
      helper = declared === null || this.src.callsApi(name) ? null
        : { params: declared.map((p) => ({ name: p.name, ref: p.ref, default_: p.default_ })), body: ShaderParser.parseStatementsLenient(CppSource.prepare("{" + body + "}")) };
      this.helpers.set(name, helper);
    }
    if (helper === null) return null;
    const h = helper;
    const values = new Map<string, ShaderValue>();
    for (let i = 0; i < h.params.length; i++) {
      // The parameters' types are not read: numbers come in as plain numbers. A parameter not given takes its default
      // value.
      const fallback = h.params[i]!.default_;
      const arg = i < args.length ? this.runner.evalArg(args[i]!) : fallback !== null ? this.eval(fallback) : null;
      if (arg === null) continue;
      // A struct or container given by reference (addChild(Entity& parent, …)) is the caller's object itself: what the
      // function changes in it, the caller sees.
      values.set(h.params[i]!.name, arg.int ? ShaderValue.scalar(arg.x) : h.params[i]!.ref && isObjectValue(arg) ? arg : arg.clone());
    }
    this.helperDepth++;
    try {
      const { value: result, scope } = this.runner.runBody(h.body, values);
      for (let i = 0; i < h.params.length && i < args.length; i++) {
        const a = args[i]!;
        const v = scope.get(h.params[i]!.name);
        if (h.params[i]!.ref && (a instanceof A.Name || a instanceof A.Member || a instanceof A.IndexOf) && v !== undefined) this.runner.assign(a, v);
      }
      return result ?? ShaderValue.scalar(0);
    } catch (e) {
      if (e instanceof ShaderRuntimeException) return null;
      throw e;
    } finally {
      this.helperDepth--;
    }
  }

  /** The window's size, for the names the tutorials use for it (swapChainExtent, m_width, m_aspectRatio …). */
  private get size(): [number, number] {
    return this.scene !== null ? [this.scene.width, this.scene.height] : [800, 600];
  }

  private resolve(name: string): ShaderValue | null {
    const src = this.src;
    // d3d12.h's numeric limits (the same on every device).
    const limit = D3D12Limits.get(name);
    if (limit !== undefined) return ShaderValue.integer(limit);
    switch (name) {
      case "swapChainExtent":
        return ShaderValue.struct(new Map([["width", ShaderValue.scalar(this.size[0])], ["height", ShaderValue.scalar(this.size[1])]]));
      case "m_aspectRatio":
        return ShaderValue.scalar(this.size[0] / this.size[1]);
      case "m_width":
        return ShaderValue.scalar(this.size[0]);
      case "m_height":
        return ShaderValue.scalar(this.size[1]);
    }
    // A member of a struct type the runner does not know (D3D12_VERTEX_BUFFER_VIEW m_vertexBufferViews[2] = {};):
    // empty structs that keep the fields the program sets.
    const declared = src.declaredType(name);
    if (declared !== null && this.runner.default(declared.replaceAll("glm::", "").replaceAll("DirectX::", "")).text !== null
      && !["float", "double", "int", "UINT", "bool", "auto"].includes(declared) && !declared.startsWith("std::")
      && new RegExp(String.raw`\b` + escapeRegex(declared) + String.raw`\s+` + escapeRegex(name) + String.raw`\s*(?:\[[^\]]*\]\s*)?(?:=\s*\{\s*\}\s*)?;`).test(src.code)) {
      const size = new RegExp(String.raw`\b` + escapeRegex(name) + String.raw`\s*\[\s*([^\]]+)\]`).exec(src.code);
      const empty = (): ShaderValue => ShaderValue.struct(new Map());
      const n = size !== null ? (src.int(size[1]!) ?? 0) : 0;
      const made = size !== null && n > 0 && n < 4096 ? ShaderValue.array(Array.from({ length: n }, empty)) : empty();
      this.runner.globals.set(name, made);
      return made;
    }
    // A std::vector member with no initializer (filled by push_back in a setup helper): empty, kept as a global. A
    // std::map likewise (learnopengl's Characters). (A local of another function with the same name and an initializer –
    // QueueFamilyIndices indices = findQueueFamilies(…) – does not make the member something else.)
    const vectorType = src.declaredType(name);
    if (vectorType !== null && /^(?:const)?std::(?:vector|map|unordered_map)</.test(vectorType)
      && (src.initializer(name) === null || new RegExp(String.raw`(?:vector|map)\s*<[^;=(){}]*>\s+` + escapeRegex(name) + String.raw`\s*;`).test(src.code))) {
      const empty = vectorType.includes("map<") ? this.runner.default("map") : ShaderValue.array([]);
      this.runner.globals.set(name, empty);
      return empty;
    }
    let v = src.evaluate(name, this.runner.time);
    if (v !== null) {
      // An array of the program's structs (const std::vector<Vertex> vertices = { … }): its elements as structs.
      const arrayType = v.items !== null ? src.declaredType(name) : null;
      const elem = arrayType !== null ? /^(?:const)?(?:std::)?(?:vector|array)<(\w+)/.exec(arrayType) : null;
      if (v.items !== null && arrayType !== null && elem !== null) v = this.runner.asStructArray(elem[1]!, v);
      else if (v.items !== null && arrayType !== null && new RegExp(String.raw`\b` + escapeRegex(arrayType) + String.raw`\s+` + escapeRegex(name) + String.raw`\s*\[`).test(src.code))
        v = this.runner.asStructArray(arrayType, v);
      if (src.usedTime) this.runner.usedTime = true;
      // A global of the program: kept, so assignments to it (lightPos.x = …) last.
      if (v.text === null) this.runner.globals.set(name, v);
      return v;
    }
    // A member or global of a struct type with no initializer: zero-initialised, kept between statements.
    const type = src.declaredType(name);
    if (type !== null) {
      const t = type.replaceAll("glm::", "").replaceAll("DirectX::", "");
      // An array of them (XMFLOAT3 lightPositions[32];): that many zero values.
      const arraySize = new RegExp(String.raw`\b` + escapeRegex(name) + String.raw`\s*\[\s*(\w+)\s*\]\s*;`).exec(src.code);
      if (arraySize !== null) {
        const count = tryParseInt(arraySize[1]!) ?? src.int(arraySize[1]!) ?? 0;
        if (count > 0 && count <= 4096) {
          const items = ShaderValue.array(Array.from({ length: count }, () => this.runner.default(t)));
          if (items.items!.every((i) => i.fields !== null || i.v !== null)) {
            this.runner.globals.set(name, items);
            return items;
          }
        }
      }
      const value = this.runner.default(t);
      if (value.fields !== null || value.v !== null) {
        this.runner.globals.set(name, value);
        return value;
      }
    }
    // An API constant (DXGI_FORMAT_R8G8B8A8_UNORM, D3D12_SRV_DIMENSION_TEXTURECUBE): its name, so descriptions keep it.
    if (/^(?:D3D12|DXGI|D3D|VK|GL)_[A-Z0-9_]+$/.test(name)) return ShaderValue.str(name);
    return null;
  }

  /** An argument's value now, or null (for choosing an overload). */
  tryEval(e: A.Expr): ShaderValue | null {
    try {
      return this.runner.evalArg(e);
    } catch (x) {
      if (x instanceof ShaderRuntimeException) return null;
      throw x;
    }
  }

  /** Runs C++ statements (text). */
  run(code: string): void {
    // A statement in a loop runs many times (a sphere's vertices, a grid of objects): parsed once.
    let statements = this.parsedStatements.get(code);
    if (statements === undefined) {
      statements = ShaderParser.parseStatementsLenient(CppSource.prepare(code));
      this.parsedStatements.set(code, statements);
    }
    this.runner.runStatements(statements);
  }

  /** Runs a function's body (by name), if the file defines it. */
  runFunction(name: string): boolean {
    const body = this.src.expandedBody(name);
    if (body === null) return false;
    this.run(body);
    return true;
  }

  /** The value of an expression now, or null. */
  eval(expr: string): ShaderValue | null {
    if (expr.trim().length === 0) return null;
    let parsed = this.parsedExpressions.get(expr);
    if (parsed === undefined) {
      try {
        parsed = ShaderParser.parseExpression(CppSource.prepare(expr));
      } catch (e) {
        if (!(e instanceof ShaderSyntaxException)) throw e;
        parsed = null;
      }
      this.parsedExpressions.set(expr, parsed);
    }
    if (parsed === null) return null;
    try {
      return this.runner.evaluate(parsed);
    } catch (e) {
      if (e instanceof ShaderRuntimeException) return null;
      throw e;
    }
  }

  int(expr: string): number | null {
    const v = this.eval(expr);
    return v !== null && v.v !== null && v.v.length > 0 ? toInt(roundEven(v.v[0]!)) : null;
  }

  /** All numbers of a value, flattened. */
  numbers(expr: string): number[] | null {
    const v = this.eval(expr);
    if (v === null) return null;
    const list: number[] = [];
    CppExec.flatten(v, list);
    return list;
  }

  /**
   * The numbers of a value in memory order. rowMajor: matrices row by row, as DirectXMath stores XMFLOAT4X4 / XMMATRIX
   * (GLM stores them column by column, the runner's own order).
   */
  static flatten(v: ShaderValue, into: number[], rowMajor = false): void {
    if (v.v !== null && rowMajor && v.isMatrix) {
      for (let r = 0; r < v.cols; r++) for (let c = 0; c < v.cols; c++) into.push(v.v[c * v.cols + r]!);
    } else if (v.v !== null) for (const x of v.v) into.push(x);
    else if (v.packed !== null) for (const x of v.packed) into.push(x);
    else {
      const items = v.items;
      if (items !== null) for (const i of items) CppExec.flatten(i, into, rowMajor);
      else if (v.fields !== null) for (const f of v.fields.values()) CppExec.flatten(f, into, rowMajor);
    }
  }
}
