// GlReader.cs. C#'s partial class GlReader is this class (its state and the walk over main) and the modules
// GlReader.Calls.ts, GlReader.Advanced.ts, GlReader.Debug.ts, GlReader.Draw.ts, GlReader.Dsa.ts, GlReader.Frames.ts and
// GlReader.Textures.ts, whose functions take the reader; the members they use are marked @internal.
import { Apis } from "../Apis.js";
import type { GpuProject } from "../GpuProject.js";
import { roundEven, toInt, trimChars, trimNet } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import type { ObjMesh } from "../Models/ObjMesh.js";
import { ObjModel } from "../Models/ObjModel.js";
import type { DrawCall, VertexData } from "../Scene/DrawCall.js";
import { ClearOp, CopyOp } from "../Scene/FrameOp.js";
import { Scene } from "../Scene/Scene.js";
import { SimNote } from "../Scene/SimNote.js";
import type { Topology } from "../Scene/Topology.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException, ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import type { Texture } from "../Textures/Texture.js";
import { CppExec } from "./CppExec.js";
import { CppSource } from "./CppSource.js";
import { CppStatement } from "./CppStatement.js";
import { CppStatements } from "./CppStatements.js";
import { SpacePressFrame, SpaceReleaseFrame } from "./FrameConstants.js";
import { call, computeShaderClass, modelObjects, shaderClass, shaderMethod } from "./GlReader.Calls.js";
import { apiValue, expandMacros } from "./GlReader.Debug.js";
import { topologyOf } from "./GlReader.Draw.js";
import { loopEnd, runFrames, stepped } from "./GlReader.Frames.js";
import { GlState, type TextureObject } from "./GlState.js";
import { registerReader } from "./ReaderRegistry.js";
import { StbImage } from "./StbImage.js";

const CallStart = /(?<![\w.>])(?<name>gl[A-Z]\w*|glfw[A-Z]\w*|gladLoadGL(?:Loader)?|memcpy)\s*\(|(?<![\w.>])(?<obj>[A-Za-z_]\w*(?:\s*(?:\.|->)\s*[A-Za-z_]\w*|\[[^\[\]]*\])*)\s*(?:\.|->)\s*(?<method>use|setFloat|setInt|setBool|setVec2|setVec3|setVec4|setMat2|setMat3|setMat4|Draw)\s*\(/g;
const AssignRe = /^(?:[A-Za-z_][\w:<>]*(?:\s*[*&]+\s*|\s+))*(?<lhs>[A-Za-z_]\w*(?:(?:\.|->)\w+|\[[^\]=]*\])*)\s*=(?!=)\s*(?<rhs>[\s\S]+)$/;
const ModelRe = /^Model\s+(?<name>\w+)\s*\(\s*"(?<path>[^"]+)"/;
const ComputeClassRe = /^ComputeShader\s+(?<name>\w+)\s*\(\s*"(?<cs>[^"]+)"/;
const ShaderClassRe = /^Shader\s+(?<name>\w+)\s*\(\s*"(?<vs>[^"]+)"\s*,\s*"(?<fs>[^"]+)"(?:\s*,\s*(?:"(?<gs>[^"]+)"|nullptr|NULL|0)(?:\s*,\s*(?:"(?<tcs>[^"]+)"|nullptr|NULL|0)(?:\s*,\s*(?:"(?<tes>[^"]+)"|nullptr|NULL|0))?)?)?/;
const CallOf = /(?<![\w.>])(\w+)\s*\(/g;

/**
 * How deep the program's own drawing functions are followed: a recursive one (drawSelfAndChild over a scene graph) as
 * deep as its data goes, up to this.
 */
const MaxInlineDepth = 32;
/** @internal */
export const ReturnedPrefix = "__returned";

/**
 * Reads an OpenGL program the way a driver would see it: walks main() call by call (GLFW, GLAD, shaders, buffers,
 * vertex arrays, uniforms, clears and draws) and records one frame of the render loop. The calls are handled in
 * GlReader.Calls.ts, the draw calls in GlReader.Draw.ts.
 */
export class GlReader {
  /** The frames in which the space bar is pressed and released (0.5 s and 0.55 s). */
  static readonly SpacePressFrame = SpacePressFrame;
  static readonly SpaceReleaseFrame = SpaceReleaseFrame;

  /** The topology a draw mode names (GL_TRIANGLES, VK_PRIMITIVE_TOPOLOGY_LINE_LIST …): the Vulkan and D3D12 readers use it too. */
  static topologyOf(mode: string): Topology {
    return topologyOf(mode);
  }

  /** @internal */ readonly project: GpuProject;
  /** @internal */ readonly src: CppSource;
  /** @internal */ readonly scene = new Scene({ api: Apis.OpenGL });
  /** @internal */ readonly gl = new GlState();
  /** @internal */ inLoop = false;
  /** @internal */ glfwInit = false;
  /** @internal */ gladLoaded = false;
  /** @internal */ windowCreated = false;
  /** @internal */ readonly setupDraws: DrawCall[] = [];
  /** @internal */ readonly images: StbImage[];
  /** @internal */ statementOffset = 0;
  /** @internal */ readonly env: CppExec;
  /** @internal */ readonly models = new Map<string, { model: ObjModel; path: string }>();

  // GlReader.Calls.cs
  /** @internal A buffer's own name (buffer#3) → the variable it was generated into, which holds its data. */
  readonly bufferAliases = new Map<string, string>();
  /** @internal */ retiredBuffers = 0;
  /** @internal */ objectCount = 0;
  // GlReader.Debug.cs
  /** @internal The error flag glGetError returns (and clears): only the first error is kept until then. */
  errorFlag = 0;
  /** @internal */ debugContext = false;
  /** @internal */ debugOutput = false;
  /** @internal */ debugCallback: string | null = null;
  // GlReader.Draw.cs
  /** @internal The texture sizes of the samplers the last Samplers call bound. */
  samplerSizes: ((name: string) => Image | null) | null = null;
  /** @internal The cube maps of the last Samplers call read at a mip level (textureLod). */
  samplerCubeLod: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null = null;
  /** @internal */ readonly meshData = new Map<ObjMesh, { vertices: VertexData[]; maps: Map<string, Texture | null> }>();
  // GlReader.Dsa.cs
  /** @internal The texture a glTexture* call names: the texture calls of the bind-to-edit API work on it meanwhile. */
  namedTexture: TextureObject | null = null;
  // GlReader.Frames.cs
  /** @internal The frame being run is not the one shown: its draws are skipped. */
  discardDraws = false;
  /** @internal */ readonly drawOnly = new Map<string, boolean>();

  private constructor(project: GpuProject, time: number) {
    this.project = project;
    const main = project.mainFile;
    this.src = new CppSource(main, project.mainText());
    this.images = StbImage.all(this.src, project, this.scene);
    this.env = new CppExec(this.src, time, null, this.scene);
    const runner = this.env.runner;
    // std::ifstream reads the project's files (a game's levels), FreeType its fonts.
    runner.readText = (p) => project.find(p);
    runner.readBytes = (p) => project.findAsset(p);
    // What the program prints (std::cout) is its output; its own code's API queries are answered here.
    runner.output = (line) => this.scene.log.push(line);
    this.env.apiValue = (name, args) => apiValue(this, name, args);
    // The getters of the project's headers (learnopengl's Model::GetBoneInfoMap): the reader's Model answers them.
    for (const [path, text] of project.files)
      if (path.endsWith(".h") || path.endsWith(".hpp")) this.env.addGetters(CppSource.blankComments(text));
    // Bytes read through a pointer into an image stb_image loaded (pixelOffset[0]).
    runner.pointerRead = (handle, at) => {
      const load = this.loadedImages.get(handle);
      const img = load?.image ?? null;
      return load !== undefined && img !== null ? StbImage.byte(img, load.wanted > 0 ? load.wanted : img.channels, at) : null;
    };
  }

  /** What the program does when its clock reads `time` seconds. */
  static read(project: GpuProject, time = 1.0): Scene {
    return new GlReader(project, time).run();
  }

  /** @internal Values of arguments: the program's own variables first, then constants of the file. */
  eval(expr: string): ShaderValue | null {
    return this.env.eval(expr) ?? this.src.evaluate(expr, this.env.runner.time);
  }

  /** @internal */
  int(expr: string): number | null {
    return this.env.int(expr) ?? this.src.int(expr, this.env.runner.time);
  }

  /** @internal */
  numbers(expr: string): number[] | null {
    return this.env.numbers(expr) ?? this.src.numbers(expr, this.env.runner.time);
  }

  private run(): Scene {
    const scene = this.scene;
    if (!this.src.functions.has("main")) {
      scene.notes.push(SimNote.error("noMain"));
      return scene;
    }
    const statements = CppStatements.walk(this.src, "main");
    for (let index = 0; index < statements.length; index++) {
      const st = statements[index]!;
      // A game (a key callback, deltaTime): the render loop runs frame by frame up to the time shown.
      if (st.kind === "loop-start" && !this.inLoop && stepped(this)) {
        const end = loopEnd(statements, index);
        if (end !== null) {
          if (scene.setupDraws === 0) [scene.setupDraws, scene.setupOps] = [scene.draws.length, scene.ops.length];
          scene.renderLoop = this.windowCreated;
          this.inLoop = true;
          runFrames(this, statements.slice(index + 1, end));
          this.inLoop = false;
          index = end;
          continue;
        }
      }
      switch (st.kind) {
        case "loop-start":
          // What was drawn into framebuffer objects so far is the program's setup, drawn once.
          if (!this.inLoop && scene.setupDraws === 0) [scene.setupDraws, scene.setupOps] = [scene.draws.length, scene.ops.length];
          this.inLoop = true;
          scene.renderLoop = this.windowCreated;
          continue;
        case "loop-end":
          this.inLoop = false;
          continue;
      }
      this.statement(st);
      // Once the render loop is reached, the frame is what the loop does.
    }
    this.finish();
    return scene;
  }

  private inlineDepth = 0;
  private inlineReturn: (string | null)[] | null = null;

  /** Runs a function of the program with its arguments; returns the name of the variable it returns. */
  private inline(fn: string, args: readonly string[]): string | null {
    const env = this.env;
    const globals = env.runner.globals;
    // An overloaded function: the definition these arguments call.
    if (this.src.functions.has(fn + "#2"))
      fn = this.src.chooseOverload(fn, args.map((a) => new A.Name(trimNet(a), 0)), (e) => this.eval((e as A.Name).id));
    const declared = this.src.parametersOf(fn) ?? [];
    const parameters = declared.map((p) => p.name);
    const values = args.map((a) => this.eval(a));
    // The parameters are globals while the function runs: what they named before comes back afterwards (a recursive
    // drawSelfAndChild(child, shader) leaves its caller's entity as it was).
    const outer = new Map<string, ShaderValue | null>();
    for (const p of parameters) if (p !== "" && !outer.has(p)) outer.set(p, globals.get(p) ?? null);
    for (let i = 0; i < parameters.length; i++) {
      // A parameter not given takes its default value (DrawSprite(…, float rotate = 0.0f, glm::vec3 color = …)).
      const fallback = declared[i]!.default_;
      const v = i < values.length ? values[i]! : fallback !== null ? this.eval(fallback) : null;
      // By value: a copy (a struct changed in the function stays as it was for the caller).
      if (v !== null) globals.set(parameters[i]!, declared[i]!.ref ? v : v.clone());
    }
    // A parameter that receives a Shader or Model (renderScene(simpleDepthShader) with `const Shader& shader`)
    // names the caller's object while the function runs.
    const aliases = new Map<string, string>();
    for (let i = 0; i < parameters.length && i < args.length; i++) {
      const target = this.resolveAlias(this.obj(args[i]!));
      if (parameters[i] !== "" && parameters[i] !== target && (this.gl.programs.has(target) || this.models.has(target))) aliases.set(parameters[i]!, target);
    }
    this.aliasStack.push(aliases);
    const saved = this.inlineReturn;
    this.inlineReturn = [null];
    this.inlineDepth++;
    try {
      for (const st of CppStatements.walk(this.src, fn))
        if (st.kind === "stmt" || st.kind === "for" || st.kind === "if" || st.kind === "while") this.statement(st);
      return this.inlineReturn[0] ?? null;
    } finally {
      this.inlineDepth--;
      this.inlineReturn = saved;
      this.aliasStack.pop();
      // A number given by reference (unsigned int& display: display++ counts for the caller) goes back to the
      // argument once the caller's names are back.
      const written: { arg: string; value: ShaderValue }[] = [];
      for (let i = 0; i < parameters.length && i < args.length; i++) {
        const number = globals.get(parameters[i]!);
        if (declared[i]!.ref && number !== undefined && number.v !== null && /^[A-Za-z_][\w.]*(?:\[[^\]]*\])?$/.test(trimNet(args[i]!)))
          written.push({ arg: trimNet(args[i]!), value: number });
      }
      for (const [p, v] of outer) {
        if (v === null) globals.delete(p);
        else globals.set(p, v);
      }
      for (const { arg, value } of written) {
        try {
          env.runner.assign(ShaderParser.parseExpression(arg), value);
        } catch (e) {
          if (!(e instanceof ShaderSyntaxException) && !(e instanceof ShaderRuntimeException)) throw e;
        }
      }
    }
  }

  /**
   * After a followed function returned an expression: when the statement assigns or declares with that call as its
   * value, the target gets the expression's value now (a struct returned by value is copied).
   */
  private passReturnValue(statement: string, fn: string, returned: string): void {
    let parsed: A.Stmt[];
    try {
      parsed = ShaderParser.parseStatementsLenient(CppSource.prepare(statement + ";"));
    } catch (e) {
      if (e instanceof ShaderSyntaxException) return;
      throw e;
    }
    const first = parsed[0];
    let target: A.Expr | null = null;
    if (first instanceof A.Assign && first.op === "=" && first.value instanceof A.Call && first.value.function_ === fn) target = first.target;
    else if (first instanceof A.Declare && first.value instanceof A.Call && first.value.function_ === fn) target = new A.Name(first.id, 0);
    if (target === null) return;
    const value = this.env.eval(returned);
    if (value === null) return;
    try {
      this.env.runner.assign(target, value.clone());
    } catch (e) {
      if (!(e instanceof ShaderRuntimeException)) throw e;
    }
  }

  /** @internal Images loaded while the program ran, by the name their variable now holds ("stbi#2"). */
  readonly loadedImages = new Map<string, StbImage>();

  /**
   * stbi_load(…) has just run: the image it loaded (its path worked out now, when it is a helper's parameter) is
   * remembered under a name of its own, which its variable holds – so glTexImage2D finds it in any function it is
   * passed to (Generate(texture, width, height, data)).
   */
  private rememberImage(st: CppStatement): void {
    let load = this.images.find((i) => i.offset >= st.offset && i.offset < st.offset + st.text.length + 1 && i.variable !== null);
    if (load === undefined) return;
    if (load.image === null && load.file === "") {
      const path = this.eval(load.arg)?.text ?? null;
      if (path !== null) {
        load = load.with({ file: path, image: StbImage.load(this.project, path, load.flip, load.wanted) });
        if (load.image === null) this.scene.notes.push(SimNote.error("textureFileMissing", ["file", path]));
      }
    }
    const own = `stbi#${this.loadedImages.size + 1}`;
    this.loadedImages.set(own, load);
    try {
      this.env.runner.assign(new A.Name(load.variable!, 0), ShaderValue.str(own));
      // The size stb_image reports through its out-parameters (&width, &height, &nrChannels).
      const img = load.image;
      const callMatch = img !== null ? /stbi_loadf?\s*\(([^;]*)\)/.exec(st.text) : null;
      const a = callMatch !== null ? CppSource.splitArgs(callMatch[1]!) : null;
      if (img !== null && a !== null && a.length >= 4) {
        for (const [arg, value] of [[a[1]!, img.width], [a[2]!, img.height], [a[3]!, img.channels]] as const)
          if (/^&\s*[A-Za-z_][\w.]*$/.test(trimNet(arg))) this.env.runner.assign(ShaderParser.parseExpression(trimNet(trimNet(arg).slice(1))), ShaderValue.integer(value));
      }
    } catch (e) {
      if (!(e instanceof ShaderRuntimeException) && !(e instanceof ShaderSyntaxException)) throw e;
    }
  }

  /** The helpers' parameters that stand for the caller's objects, innermost call last. */
  private readonly aliasStack: Map<string, string>[] = [];

  /** @internal The object a name means here: a helper's parameter is the argument it was called with. */
  resolveAlias(name: string): string {
    for (let i = this.aliasStack.length - 1; i >= 0; i--) {
      const target = this.aliasStack[i]!.get(name);
      if (target !== undefined) name = target;
    }
    return name;
  }

  /** A variable that now names the same OpenGL object as another (unsigned int diffuseMap = loadTexture(…)). */
  private alias(name: string, existing: string): void {
    const gl = this.gl;
    const t = gl.textureObjects.get(existing);
    if (t !== undefined) gl.textureObjects.set(name, t);
    const v = gl.vertexArrays.get(existing);
    if (v !== undefined) gl.vertexArrays.set(name, v);
    if (gl.buffers.has(existing)) gl.buffers.set(name, gl.buffers.get(existing)!);
    const p = gl.programs.get(existing);
    if (p !== undefined) gl.programs.set(name, p);
  }

  private readonly pureLoops = new Map<number, A.Stmt[] | null>();

  /** for (init; condition; step) { … }: runs the body while the condition holds (at most 1000 times). */
  private for_(loop: CppStatement): void {
    const env = this.env;
    const header = loop.text.split(";");
    const each = /^\s*(?:const\s+)?[\w:<>,\s]*?[\s&*]+(\w+)\s*:\s*(.+)$/.exec(loop.text);
    if (header.length === 1 && each !== null) {
      // for (GameObject& tile : level.Bricks): the body for each element (the element itself: a change to a
      // member stays in the container, as with a reference).
      const container = env.eval(trimNet(each[2]!));
      const items = container?.items ?? container?.map?.valuesInOrder() ?? (container?.text != null ? container.text.split("").map((ch) => ShaderValue.integer(ch.charCodeAt(0))) : null) ?? [];
      for (const item of items.slice(0, 4096)) {
        env.runner.globals.set(each[1]!, item);
        for (const st of loop.body ?? []) this.statement(st);
      }
      return;
    }
    if (header.length !== 3) return;
    // A loop of the program's own C++ only (a height map's 65,536 vertices from its pixels): run as a whole by the
    // C++ runner, every iteration, instead of statement by statement.
    if (loop.end > loop.offset && this.src.isPureLoop(this.src.code.slice(loop.offset, loop.end))) {
      let parsed = this.pureLoops.get(loop.offset);
      if (parsed === undefined) {
        const statements = ShaderParser.parseStatementsLenient(CppSource.prepare(this.src.code.slice(loop.offset, loop.end)));
        // Only a loop that parses as one (else statement by statement, as before).
        parsed = statements.length === 1 && statements[0] instanceof A.For ? statements : null;
        this.pureLoops.set(loop.offset, parsed);
      }
      if (parsed !== null) {
        env.runner.runStatements(parsed);
        return;
      }
    }
    env.run(header[0] + ";");
    for (let n = 0; n < 1000; n++) {
      if (trimNet(header[1]!) !== "") {
        const c = env.eval(header[1]!);
        if (c === null || c.x === 0) return;
      }
      for (const st of loop.body ?? []) this.statement(st);
      env.run(header[2] + ";");
    }
  }

  /**
   * Whether a condition on one variable holds, when the reader knows: an OpenGL object's name is not 0 once the
   * object exists (if (cubeVAO == 0) builds learnopengl's cube once), a bool variable has its value (if (!oddRow)).
   * Null: not known (a pointer from stb_image, a status code …).
   */
  private decide(condition: string): boolean | null {
    const m = /^\s*(!?)\s*([A-Za-z_]\w*)\s*(?:([!=]=)\s*(0|true|false|NULL|nullptr)\s*)?$/.exec(condition);
    // Any other condition: its value when the program's own variables give one (if (!tile.Destroyed),
    // if (nrComponents == 1)); a pointer, a handle or an API result is not known.
    if (m === null) {
      const decided = this.env.eval(condition);
      return decided !== null && decided.v !== null && decided.v.length === 1 && decided.iterator === null ? decided.v[0] !== 0 : null;
    }
    const name = m[2]!;
    const gl = this.gl;
    // The value a followed function returned (FollowCalls).
    const returnedValue = this.env.runner.globals.get(name);
    if (name.startsWith(ReturnedPrefix) && m[3] === undefined && returnedValue !== undefined)
      return returnedValue.v !== null && returnedValue.v.length === 1 ? (m[1] === "!") === (returnedValue.v[0] === 0) : null;
    let value: boolean | null;
    if (gl.vertexArrays.has(name) || gl.buffers.has(name) || gl.textureObjects.has(name) || gl.framebuffers.has(name)
      || gl.renderbuffers.has(name) || gl.programs.has(name)) value = true;
    else {
      const type = this.src.declaredType(name);
      const v = type !== null && (type === "bool" || ShaderValue.isIntType(type) || type === "float" || type === "double" || type === "GLboolean") ? this.env.eval(name) : null;
      value = v !== null && v.v !== null && v.v.length === 1 ? v.v[0] !== 0 : null;
    }
    if (value === null) return null;
    let truth = value;
    if (m[3] !== undefined) {
      const compared = m[4] === "true";
      truth = (truth === compared) === (m[3] === "==");
    }
    return m[1] === "!" ? !truth : truth;
  }

  private followedResults = 0;

  /**
   * Follows the calls of the program's own API-calling functions in a condition, and gives the condition with each
   * call replaced by a name that holds the value it returned.
   */
  private followCalls(text: string, offset: number): string {
    for (const c of matchesAll(CallOf, text).reverse()) {
      const fn = c[1]!;
      if (fn === "main" || this.inlineDepth > MaxInlineDepth || !this.src.functions.has(fn) || !this.src.callsApi(fn)) continue;
      const open = c.index + c[0].length - 1;
      const close = CppSource.matchBracket(text, open);
      if (close < 0) continue;
      this.statementOffset = offset;
      const returned = this.inline(fn, CppSource.splitArgs(text.slice(open + 1, close)));
      const holder = ReturnedPrefix + ++this.followedResults;
      const value = returned !== null ? this.env.eval(returned) : null;
      this.env.runner.globals.set(holder, value !== null ? value.clone() : ShaderValue.str("?"));
      text = text.slice(0, c.index) + holder + text.slice(close + 1);
    }
    return text;
  }

  /** The API calls (gl*, glfw*, Shader methods) in a piece of code, without running its C++ again. */
  private apiCalls(text: string, offset: number): void {
    this.statementOffset = offset;
    for (const m of matchesAll(CallStart, text)) {
      const open = m.index + m[0].length - 1;
      const close = CppSource.matchBracket(text, open);
      if (close < 0) continue;
      const args = CppSource.splitArgs(text.slice(open + 1, close));
      const line = this.src.lineAt(offset + m.index);
      if (m.groups!["method"] !== undefined) shaderMethod(this, m.groups!["obj"]!, m.groups!["method"]!, args, line);
      else call(this, m.groups!["name"]!, args, null, line);
    }
  }

  /** @internal */
  statement(st: CppStatement): void {
    if (st.kind === "for") {
      this.for_(st);
      return;
    }
    if (st.kind === "if") {
      // The condition's API calls first (if (glCheckFramebufferStatus(…) != …)), and the program's own functions
      // that make API calls (if (!InitBloomFBO(bloomFBO, …))), then the branch it picks: decided, that branch; not
      // decided, the body, as for any other if.
      this.apiCalls(st.text, st.offset);
      const condition = this.followCalls(st.text, st.offset);
      for (const inner of (this.decide(condition) === false ? st.else_ : st.body) ?? []) this.statement(inner);
      return;
    }
    if (st.kind === "while") {
      for (let n = 0; n < 10000; n++) {
        this.apiCalls(st.text, st.offset);
        if (this.decide(st.text) !== true) break;
        for (const inner of st.body ?? []) this.statement(inner);
      }
      return;
    }
    const text = expandMacros(this, st.text, this.src.lineAt(st.offset));
    this.statementOffset = st.offset;
    // The program's own variables (GL calls do nothing here; they are followed below).
    this.env.run(text + ";");
    if (text.includes("stbi_load")) this.rememberImage(st);
    const ret = this.inlineReturn !== null ? /^return\s+([\s\S]+)$/.exec(text) : null;
    if (this.inlineReturn !== null && ret !== null) this.inlineReturn[0] = trimNet(ret[1]!);
    // The program's own functions that make GL calls (learnopengl's loadTexture): followed as if written here.
    for (const c of matchesAll(CallOf, text)) {
      const fn = c[1]!;
      if (fn === "main" || this.inlineDepth > MaxInlineDepth || !this.src.functions.has(fn) || !this.src.callsApi(fn)) continue;
      const open = c.index + c[0].length - 1;
      const close = CppSource.matchBracket(text, open);
      if (close < 0) continue;
      const returned = this.inline(fn, CppSource.splitArgs(text.slice(open + 1, close)));
      const lhsMatch = AssignRe.exec(text);
      if (returned !== null && lhsMatch !== null && /^\w+$/.test(returned)) this.alias(lhsMatch.groups!["lhs"]!, returned);
      // The value it returns reaches the caller (Shaders[name] = loadShaderFromFile(…); Shader s = Compile(…)):
      // the C++ above ran before the function was followed.
      if (returned !== null) this.passReturnValue(text, fn, returned);
    }
    this.statementOffset = st.offset;
    const sc = ShaderClassRe.exec(text);
    if (sc !== null) {
      const g = sc.groups!;
      shaderClass(this, g["name"]!, g["vs"]!, g["fs"]!, g["gs"] ?? null, this.src.lineAt(st.offset), g["tcs"] ?? null, g["tes"] ?? null);
      return;
    }
    const cc = ComputeClassRe.exec(text);
    if (cc !== null) {
      // learnopengl's ComputeShader class (shader_c.h): a program of one compute shader.
      computeShaderClass(this, cc.groups!["name"]!, cc.groups!["cs"]!, this.src.lineAt(st.offset));
      return;
    }
    const modelDecl = ModelRe.exec(text);
    if (modelDecl !== null) {
      // learnopengl.com's Model class: Model ourModel("planet.obj"); loads the file with Assimp.
      const path = modelDecl.groups!["path"]!;
      const model = ObjModel.load(this.project, path);
      if (model !== null) {
        this.models.set(modelDecl.groups!["name"]!, { model, path });
        modelObjects(this, modelDecl.groups!["name"]!, model, path);
      } else this.scene.notes.push(SimNote.error("modelFileMissing", ["file", path]));
      return;
    }
    let lhs: string | null = null;
    const assign = AssignRe.exec(text);
    if (assign !== null && !text.startsWith("return")) lhs = assign.groups!["lhs"]!;
    for (const m of matchesAll(CallStart, text)) {
      const open = m.index + m[0].length - 1;
      const close = CppSource.matchBracket(text, open);
      if (close < 0) continue;
      const args = CppSource.splitArgs(text.slice(open + 1, close));
      const line = this.src.lineAt(st.offset + m.index);
      if (m.groups!["method"] !== undefined) shaderMethod(this, m.groups!["obj"]!, m.groups!["method"]!, args, line);
      else call(this, m.groups!["name"]!, args, lhs, line);
    }
  }

  /**
   * @internal The OpenGL object an argument names: "colorBuffers[1]" also for colorBuffers[i] in a loop or
   * pingpongFBO[!horizontal] (an index worked out now).
   */
  obj(arg: string): string {
    const name = trimChars(trimNet(arg), "&", true, false).replace(/\s+/g, "");
    return name.replace(/\[([^\[\]]*[^\d\[\]][^\[\]]*)\]/g, (whole: string, index: string) => {
      const v = this.eval(index);
      return v !== null && v.v !== null && v.v.length > 0 ? `[${toInt(roundEven(v.v[0]!))}]` : whole;
    });
  }

  /** @internal The array or vector behind a data argument: vertices, &amp;vertices[0], vertices.data(). */
  dataName(arg: string): string {
    return this.obj(arg).replace(/\.data\(\)$|\[0\]$/g, "");
  }

  private finish(): void {
    const scene = this.scene;
    scene.windowCreated = this.windowCreated;
    // Uniforms that read the clock make the frame change over time.
    if (this.env.runner.usedTime || this.src.usedTime) scene.animated = scene.draws.length > 0;
    if (!this.glfwInit && this.src.hasCall("glfwCreateWindow")) scene.notes.push(SimNote.error("glfwInitMissing"));
    if (!this.windowCreated) {
      scene.notes.push(SimNote.info("noWindow"));
      return;
    }
    if (!scene.renderLoop) {
      scene.notes.push(SimNote.warning("noLoop"));
      return;
    }
    if (!scene.presents) scene.notes.push(SimNote.warning("noPresent", ["call", "glfwSwapBuffers(window)"]));
    if (!this.src.hasCall("glfwPollEvents")) scene.notes.push(SimNote.warning("noPollEvents"));
    if (this.setupDraws.length > 0 && scene.draws.length === 0) scene.notes.push(SimNote.warning("drawOutsideLoop", ["call", "glDrawArrays"]));
    if (scene.clearColor === null && !scene.ops.some((o) => (o instanceof ClearOp && o.target === null && o.color !== null) || (o instanceof CopyOp && o.to === null))
      && (this.gl.clearColorSet || scene.draws.length > 0)) scene.notes.push(SimNote.warning("noClear", ["call", "glClear(GL_COLOR_BUFFER_BIT)"]));
  }
}

registerReader(Apis.OpenGL, (project, time) => GlReader.read(project, time));
