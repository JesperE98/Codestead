import { formatDouble, isUpper, roundEven, toInt } from "../internal/dotnet.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import type { GpuProject } from "../GpuProject.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import { ObjModel } from "../Models/ObjModel.js";
import type { Scene } from "../Scene/Scene.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppExec } from "./CppExec.js";
import { CppSource } from "./CppSource.js";
import type { IDeviceModel } from "./IDeviceModel.js";
import { StructLayout } from "./StructLayout.js";

/** The optional parts of a RecordedDraw (C#'s named record arguments). */
export interface RecordedDrawOptions {
  /** The draw is a Model::Draw (learnopengl's Model class): one draw per mesh of the model. */
  model?: boolean;
  /** The stencil reference set before the draw (vkCmdSetStencilReference, OMSetStencilRef), or null. */
  stencilRef?: number | null;
  /**
   * What was bound before the draw: descriptor sets (vkCmdBindDescriptorSets) and descriptor tables
   * (SetGraphicsRootDescriptorTable) as their argument text, by set number / root parameter.
   */
  bound?: ReadonlyMap<number, string> | null;
  state?: unknown;
  modelName?: string | null;
}

/** A draw the program recorded, with the constants set before it. (A C# record.) */
export class RecordedDraw {
  readonly model: boolean;
  readonly stencilRef: number | null;
  readonly bound: ReadonlyMap<number, string> | null;
  readonly state: unknown;
  readonly modelName: string | null;

  constructor(
    readonly indexed: boolean,
    readonly count: number,
    readonly instances: number,
    readonly first: number,
    readonly constants: Map<string, ShaderValue>,
    readonly pipeline: string | null,
    o: RecordedDrawOptions = {},
  ) {
    this.model = o.model ?? false;
    this.stencilRef = o.stencilRef ?? null;
    this.bound = o.bound ?? null;
    this.state = o.state ?? null;
    this.modelName = o.modelName ?? null;
  }
}

/** The variable an argument names: graphicsPipeline, m_lightPSO.Get(), &amp;x. */
function nameOf(e: A.Expr): string | null {
  if (e instanceof A.Name) return e.id;
  if (e instanceof A.Member) return e.field;
  if (e instanceof A.Call && e.function_ === ".Get" && e.args.length === 1) return nameOf(e.args[0]!);
  return null;
}

/** A recursive function goes as deep as the program's data (a scene graph's chain of entities). */
const MaxCallDepth = 32;

const isObjectValue = (v: ShaderValue): boolean => v.fields !== null || v.items !== null || v.map !== null;

/**
 * Runs the functions an explicit API program calls every frame (vulkan-tutorial's updateUniformBuffer and
 * recordCommandBuffer; the D3D12 samples' OnUpdate and PopulateCommandList) and records what reaches the GPU: each draw
 * with the push constants / root constants set before it, and the uniform buffer / constant buffer structs.
 */
export class FrameRecorder {
  /** The pipeline / pipeline state object bound now (vkCmdBindPipeline, SetPipelineState, Reset(…, pso)). */
  private pipeline: string | null = null;
  private stencilRef: number | null = null;
  private readonly bound = new Map<number, string>();

  private readonly exec: CppExec;
  private constants = new Map<string, ShaderValue>();

  readonly draws: RecordedDraw[] = [];

  /** The draws and device ops recorded while the program set itself up (see setup()). */
  setupDraws = 0;
  setupOps = 0;

  get runner(): ShaderRunner {
    return this.exec.runner;
  }

  /**
   * `blocks`: the shaders' uniform blocks / cbuffers (their fields are the names constants are set under).
   * `transposeMatrices`: HLSL reads a C++ (row-major) matrix transposed (column_major packing). `project` (C#'s init-only
   * Project property): the project, for the model files a loadModel reads (and the files std::ifstream and FreeType
   * read).
   */
  constructor(
    private readonly source: CppSource,
    time: number,
    private readonly scene: Scene,
    private readonly blocks: readonly A.Global[],
    private readonly transposeMatrices: boolean,
    private readonly device: IDeviceModel | null = null,
    readonly project: GpuProject | null = null,
  ) {
    this.exec = new CppExec(source, time, (n, a) => this.hook(n, a), scene);
    // What the program prints (std::cout, std::cerr, OutputDebugStringA): the output pane.
    this.exec.runner.output = (line) => scene.log.push(line);
    if (device !== null) {
      device.attach(this.exec);
      device.drawCount = () => this.draws.length;
    }
    if (project !== null) {
      this.exec.runner.readText = (p) => project.find(p);
      this.exec.runner.readBytes = (p) => project.findAsset(p);
    }
  }

  run(func: string): void {
    this.exec.runFunction(func);
  }

  /**
   * Runs the program's setup (the D3D12 samples' OnInit, or LoadPipeline and LoadAssets) so the device model sees the
   * resources, views and data it creates. What it draws into off-screen targets there stays for every frame (an
   * environment captured into a cube map once): those draws are kept as the first setupDraws of draws, with the
   * device's ops so far. Draws into the window before the first frame are dropped.
   */
  setup(): void {
    const fns = this.source.functions;
    if (fns.has("OnInit")) this.exec.runFunction("OnInit");
    else if (fns.has("initVulkan")) this.exec.runFunction("initVulkan");
    else for (const fn of ["LoadPipeline", "LoadAssets"].filter((f) => fns.has(f))) this.exec.runFunction(fn);
    const device = this.device;
    if (device !== null && this.draws.length > 0 && this.draws.every((d) => device.offscreen(d.state))) {
      this.setupDraws = this.draws.length;
      this.setupOps = device.ops.length;
    } else {
      this.draws.length = 0;
      if (device !== null) device.ops.length = 0;
    }
    // The window's size is the simulated window's (the swap chain helpers may have left something else).
    for (const name of ["swapChainExtent", "m_width", "m_height", "m_aspectRatio"]) this.exec.runner.globals.delete(name);
  }

  private callDepth = 0;
  private readonly bodies = new Map<string, A.Stmt[]>();
  private readonly headers = new Map<string, { name: string; ref: boolean; default_: string | null }[] | null>();

  /**
   * A call of one of the program's own functions (LoadTexture(…), LoadCubemap(…)) while the device model runs: its body
   * runs with the arguments; reference parameters (ComPtr&lt;…&gt;&amp; texture) are written back to the caller.
   */
  private callProgramFunction(name: string, args: readonly A.Expr[]): ShaderValue | null {
    if (name.includes("::")) name = name.slice(name.lastIndexOf("::") + 2);
    if (this.device === null || this.callDepth > MaxCallDepth || ["main", "wWinMain", "WinMain", "OnRender", "mainLoop", "run", "drawFrame"].includes(name)
      || !this.source.functions.has(name)) return null;
    name = this.source.chooseOverload(name, args, (e) => this.exec.tryEval(e));
    let parameters = this.headers.get(name);
    if (parameters === undefined) {
      parameters = this.source.parametersOf(name)?.map((p) => ({ name: p.name, ref: p.ref, default_: p.default_ })) ?? null;
      this.headers.set(name, parameters);
    }
    if (parameters === null) return null;
    const emulated = this.emulateLoadObj(name, parameters, args);
    if (emulated !== null) return emulated;
    let body = this.bodies.get(name);
    if (body === undefined) {
      body = ShaderParser.parseStatementsLenient(CppSource.prepare("{" + this.source.expandedBody(name) + "}"));
      this.bodies.set(name, body);
    }
    const values = new Map<string, ShaderValue>();
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i]!;
      // A parameter not given takes its default value (DrawSprite(…, float rotate = 0.0f, …)).
      // A struct or container by reference (addChild(Entity& parent, …)) is the caller's object itself.
      if (i < args.length) {
        const given = this.value(args[i]!);
        values.set(p.name, given !== null ? (p.ref && isObjectValue(given) ? given : given.clone()) : ShaderValue.scalar(0));
      } else if (p.default_ !== null) {
        const v = this.exec.eval(p.default_);
        if (v !== null) values.set(p.name, v);
      }
    }
    this.callDepth++;
    try {
      const { value: result, scope } = this.exec.runner.runBody(body, values);
      for (let i = 0; i < parameters.length && i < args.length; i++) {
        const a = args[i]!;
        const v = scope.get(parameters[i]!.name);
        if (parameters[i]!.ref && (a instanceof A.Name || a instanceof A.Member || a instanceof A.IndexOf) && v !== undefined) this.exec.runner.assign(a, v);
      }
      return result ?? ShaderValue.scalar(0);
    } finally {
      this.callDepth--;
    }
  }

  /**
   * vulkan-tutorial's loadModel (tinyobj::LoadObj and the loop over the shapes' indices): instead of running the loop,
   * the vectors it fills get the model's vertices – as the program's Vertex structs, position, normal, texCoord with v
   * flipped (1 - v), colour white, the material index – and its indices. The vectors are the ones the body push_backs
   * into: the program's members (vertices, indices) or reference parameters (loadModel(path, v, i)).
   */
  private emulateLoadObj(name: string, parameters: { name: string }[], args: readonly A.Expr[]): ShaderValue | null {
    const body = this.source.functionBody(name);
    if (this.project === null || body === null || !body.includes("LoadObj")) return null;
    const call = /\bLoadObj\s*\(/.exec(body);
    if (call === null) return null;
    const close = CppSource.matchBracket(body, call.index + call[0].length - 1);
    if (close < 0) return null;
    const loadArgs = CppSource.splitArgs(body.slice(call.index + call[0].length, close));
    if (loadArgs.length < 6) return null;
    const pathText = loadArgs[5]!.trim().replace(/\s*\.\s*c_str\s*\(\s*\)$/, "");
    const pathParam = parameters.findIndex((p) => p.name === pathText);
    const literal = CppSource.stringArg(pathText);
    const pathValue = pathParam >= 0 && pathParam < args.length ? this.value(args[pathParam]!)
      : literal !== null ? ShaderValue.str(literal)
      : this.value(new A.Name(pathText, 0)) ?? this.source.evaluate(pathText, this.exec.runner.time);
    const path = pathValue?.text ?? ModelFiles.path(this.source);
    const model = path === null ? null : ObjModel.load(this.project, path);
    if (model === null) return null;

    const pushes = matchesAll(/(\w+)\s*\.\s*(?:push_back|emplace_back)\s*\(\s*([^;]*)\)\s*;/g, body).map((m) => ({ target: m[1]!, arg: m[2]!.trim() }));
    const vertexVector = pushes.find((p) => p.arg === "vertex")?.target ?? "vertices";
    const others = pushes.filter((p) => p.target !== vertexVector).map((p) => p.target);
    // OrderByDescending(contains "ind"): stable, the first of the targets that contain it, else the first.
    const indexVector = others.find((t) => t.toLowerCase().includes("ind")) ?? others[0] ?? "indices";
    // The vertex type: std::vector<Vertex> – of the parameter or of the member.
    const header = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(name) + String.raw`\s*\(([^()]*)\)`).exec(this.source.code);
    const vertexParamText = header !== null ? (CppSource.splitArgs(header[1]!).find((p) => new RegExp(String.raw`\b` + vertexVector + String.raw`\s*$`).test(p)) ?? null) : null;
    const vectorType = vertexParamText ?? this.source.declaredType(vertexVector) ?? "";
    const structName = /<\s*(\w+)\s*>/.exec(vectorType)?.[1] ?? "";
    const fields = StructLayout.fields(this.source, structName);
    if (fields === null) return null;

    const vertices: ShaderValue[] = [];
    const indices: ShaderValue[] = [];
    for (const mesh of model.meshes) {
      const baseVertex = vertices.length;
      for (let i = 0; i < mesh.positions.length; i++) {
        const v = new Map<string, ShaderValue>();
        for (const { name: field } of fields) {
          const f = field.toLowerCase();
          v.set(field, f.includes("material") || f.includes("index") ? ShaderValue.scalar(mesh.material?.index ?? -1)
            : f.includes("pos") ? ShaderValue.vecOf(mesh.positions[i]!)
            : f.includes("tex") || f.includes("uv") ? ShaderValue.vec(mesh.texCoords[i]![0]!, 1 - mesh.texCoords[i]![1]!)
            : f.includes("normal") ? ShaderValue.vecOf(mesh.normals[i]!)
            : ShaderValue.vec(1, 1, 1));
        }
        vertices.push(ShaderValue.struct(v));
      }
      for (const x of mesh.indices) indices.push(ShaderValue.scalar(x + baseVertex));
    }
    const fill = (vector: string, value: ShaderValue): void => {
      const k = parameters.findIndex((p) => p.name === vector);
      if (k >= 0 && k < args.length) this.exec.runner.assign(args[k]!, value);
      else this.exec.runner.globals.set(vector, value);
    };
    fill(vertexVector, ShaderValue.array(vertices));
    fill(indexVector, ShaderValue.array(indices));
    return ShaderValue.scalar(0);
  }

  /** Functions of the program not run now (a game's drawFrame in a frame that is not shown). */
  readonly skip = new Set<string>();

  /** Called when the program polls its window's events (glfwPollEvents): the frame's key presses. */
  onPollEvents: (() => void) | null = null;

  /** Runs C++ statements (text) with the program's state. */
  runCode(code: string): void {
    this.exec.run(code);
  }

  private hook(name: string, args: readonly A.Expr[]): ShaderValue | null {
    if (this.skip.has(name)) return ShaderValue.scalar(0);
    if (name === "glfwPollEvents" && this.onPollEvents !== null) {
      this.onPollEvents();
      return ShaderValue.scalar(0);
    }
    const fromDevice = this.device?.hook(name, args) ?? null;
    const zero = (): ShaderValue => ShaderValue.scalar(0);
    const record = (indexed: boolean, o: RecordedDrawOptions = {}): void => {
      this.draws.push(new RecordedDraw(indexed, o.model ? 0 : this.int(args[1]!), o.model ? 1 : this.int(args[2]!), o.model ? 0 : this.int(args[3]!), new Map(this.constants), this.pipeline, {
        ...o, stencilRef: this.stencilRef, bound: new Map(this.bound), state: this.device?.snapshot() ?? null,
      }));
    };
    switch (name) {
      case "SetWindowTextW": case "SetWindowTextA": case "SetWindowText": case "glfwSetWindowTitle":
        if (args.length >= 2) {
          // The title the program sets while it runs (the frame's counts: "drawn: 37 / 101").
          const title = this.value(args[1]!)?.text ?? null;
          if (title !== null) this.scene.windowTitle = title;
          return zero();
        }
        break;
      case "vkCmdBindPipeline": case "vkCmdBindDescriptorSets":
        // The compute bind point's pipeline and sets are the device model's (a dispatch), not the draws'.
        if (args.length >= 3 && (this.value(args[1]!)?.text ?? "").includes("COMPUTE")) return fromDevice ?? zero();
        if (name === "vkCmdBindPipeline" && args.length >= 3) {
          this.pipeline = this.pipelineName(args[2]!);
          return zero();
        }
        if (name === "vkCmdBindDescriptorSets" && args.length >= 6) {
          this.bound.set(this.int(args[3]!), this.argText(args[5]!));
          return zero();
        }
        break;
      case ".SetPipelineState":
        if (args.length >= 2) {
          this.pipeline = this.pipelineName(args[1]!);
          return zero();
        }
        break;
      case ".Reset":
        if (args.length >= 3) {
          this.pipeline = nameOf(args[2]!) ?? this.pipeline;
          return zero();
        }
        break;
      case "vkCmdSetStencilReference":
        if (args.length >= 3) {
          this.stencilRef = this.int(args[2]!);
          return zero();
        }
        break;
      case ".OMSetStencilRef":
        if (args.length >= 2) {
          this.stencilRef = this.int(args[1]!);
          return zero();
        }
        break;
      case ".SetGraphicsRootDescriptorTable":
        if (args.length >= 3) {
          this.bound.set(this.int(args[1]!), this.argText(args[2]!));
          return zero();
        }
        break;
      case "vkCmdPushConstants":
        if (args.length >= 6) {
          this.set(this.value(args[5]!));
          return zero();
        }
        break;
      case ".SetGraphicsRoot32BitConstants":
        if (args.length >= 4) {
          this.set(this.value(args[3]!));
          return zero();
        }
        break;
      case ".SetGraphicsRoot32BitConstant":
        if (args.length >= 3) {
          this.set(this.value(args[2]!));
          return zero();
        }
        break;
      case "vkCmdDraw":
        if (args.length >= 5) {
          record(false);
          return zero();
        }
        break;
      case "vkCmdDrawIndexed":
        if (args.length >= 6) {
          record(true);
          return zero();
        }
        break;
      case ".Draw":
        if (args.length >= 1) {
          const target = nameOf(args[0]!);
          if (target !== null && (this.source.declaredType(target) ?? "").includes("Model")) {
            record(true, { model: true, modelName: target });
            return zero();
          }
        }
        break;
      case ".DrawInstanced":
        if (args.length >= 5) {
          record(false);
          return zero();
        }
        break;
      case ".DrawIndexedInstanced":
        if (args.length >= 6) {
          record(true);
          return zero();
        }
        break;
    }
    if (fromDevice !== null) return fromDevice;
    const returned = this.callProgramFunction(name, args);
    if (returned !== null) return returned;
    // Other API calls do nothing here (their arguments name API objects the runner does not have).
    return name.startsWith("vk") || (name.startsWith("glfw") && name !== "glfwGetTime")
      // Methods of API objects (m_device->CreateCommittedResource, COM's upper-case names) do nothing here; the C++
      // library's lower-case ones (insert, push_back, str, c_str …) are the runner's.
      || (name.startsWith(".") && name.length > 1 && isUpper(name[1]) && name !== ".Get") || ["memcpy", "ThrowIfFailed", "WaitForPreviousFrame"].includes(name)
      ? zero() : null;
  }

  /**
   * The program's variable for a pipeline argument: a helper's parameter (renderToCubemap(VkPipeline pipeline, …)) is
   * the member that holds the same handle.
   */
  private pipelineName(e: A.Expr): string | null {
    const name = nameOf(e);
    const handle = name === null ? null : (this.value(e)?.text ?? null);
    if (name === null || handle === null || handle.length === 0 || !handle.includes(":")) return name;
    const own = this.exec.runner.globals.get(name);
    if (own !== undefined && own.text === handle) return name;
    const holders = [...this.exec.runner.globals].filter(([, v]) => v.text === handle).map(([k]) => k);
    return holders.length === 1 ? holders[0]! : name;
  }

  private value(e: A.Expr): ShaderValue | null {
    try {
      return this.exec.runner.evalArg(e);
    } catch (x) {
      if (x instanceof ShaderRuntimeException) return null;
      throw x;
    }
  }

  /**
   * An argument as text, with indices and plain numbers worked out: &amp;descriptorSets[currentFrame] →
   * "descriptorSets[0]", CD3DX12_GPU_DESCRIPTOR_HANDLE(heapStart, 2, size) → "CD3DX12_GPU_DESCRIPTOR_HANDLE(…, 2, …)".
   */
  private argText(e: A.Expr): string {
    if (e instanceof A.Name) return e.id;
    if (e instanceof A.Number) return formatDouble(e.value);
    if (e instanceof A.Member) return this.argText(e.target) + "." + e.field;
    if (e instanceof A.IndexOf) return this.argText(e.target) + "[" + this.int(e.at) + "]";
    if (e instanceof A.Unary && (e.op === "&" || e.op === "*")) return this.argText(e.operand);
    if (e instanceof A.Call) {
      if (e.function_.startsWith(".") && e.args.length > 0)
        return this.argText(e.args[0]!) + e.function_ + "(" + e.args.slice(1).map((a) => this.argOrNumber(a)).join(", ") + ")";
      return e.function_ + "(" + e.args.map((a) => this.argOrNumber(a)).join(", ") + ")";
    }
    return this.argOrNumber(e);
  }

  private argOrNumber(e: A.Expr): string {
    if (e instanceof A.Name || e instanceof A.Member || e instanceof A.Call || e instanceof A.IndexOf) return this.argText(e);
    const v = this.value(e);
    return v !== null && v.v !== null && v.v.length === 1 ? formatDouble(v.v[0]!) : "?";
  }

  private int(e: A.Expr): number {
    const v = this.value(e);
    return v !== null && v.v !== null && v.v.length > 0 ? toInt(roundEven(v.v[0]!)) : 0;
  }

  /** Constants pushed: a struct's fields by name, or a single value for a block with one field. */
  private set(value: ShaderValue | null): void {
    if (value === null) return;
    this.constants = new Map(this.constants);
    if (value.fields !== null) {
      for (const [k, v] of value.fields) this.constants.set(k, this.upload(v.clone()));
      return;
    }
    const single = this.blocks.find((b) => b.block !== null && b.block.length === 1);
    if (single !== undefined) this.constants.set(single.block![0]!.id, this.upload(value.clone()));
  }

  /** The uniform buffer / constant buffer contents: the fields of the variables of the blocks' struct types. */
  bufferContents(): Map<string, ShaderValue> {
    const d = new Map<string, ShaderValue>();
    for (const block of this.blocks.filter((b) => !b.pushConstant))
      for (const g of [...this.exec.runner.globals.values()].filter((v) => v.fields !== null && block.block!.every((f) => v.fields!.has(f.id))))
        for (const [k, v] of g.fields!) d.set(k, this.upload(v.clone()));
    return d;
  }

  private upload(v: ShaderValue): ShaderValue {
    if (this.transposeMatrices && v.isMatrix) return ShaderValue.matrix(v.cols, Array.from({ length: v.cols * v.cols }, (_, i) => v.v![(i % v.cols) * v.cols + Math.trunc(i / v.cols)]!));
    // An array of matrices (float4x4 shadowMatrices[6]): each one.
    const items = this.transposeMatrices ? v.items : null;
    if (items !== null && items.length > 0 && items.some((x) => x.isMatrix)) return ShaderValue.array(items.map((x) => this.upload(x)));
    return v;
  }
}
