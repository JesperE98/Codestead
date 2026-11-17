// CppSource.cs and CppSource.Values.cs.
import { isLetter, isLetterOrDigit, isWhiteSpace, roundEven, toInt, trimNet } from "../internal/dotnet.js";
import { escapeRegex, matchFrom, matchesAll, regexUnescape } from "../internal/regex.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException, ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppCall } from "./CppCall.js";
import { StructLayout } from "./StructLayout.js";

/** A parameter of one of the program's functions: its name, whether it is a reference, its default value. */
export class Parameter {
  constructor(
    readonly name: string,
    readonly ref: boolean,
    readonly default_: string | null,
    /** The parameter's type without const, &amp;, * and namespaces (GameObject, vec2, float). */
    readonly type: string = "",
  ) {}
}

/** A function body's offsets: the text between its braces. */
export interface Range {
  readonly start: number;
  readonly end: number;
}

/** An assignment "target.field = value;". */
export interface FieldAssignment {
  readonly target: string;
  readonly field: string;
  readonly value: string;
  readonly offset: number;
}

const callRes = new Map<string, RegExp>();

function callRe(name: string): RegExp {
  let re = callRes.get(name);
  if (re === undefined) {
    re = name.startsWith(".")
      ? new RegExp(String.raw`(?:\.|->)\s*` + escapeRegex(name.slice(1)) + String.raw`\s*\(`, "g")
      : new RegExp(String.raw`(?<![\w.>])` + escapeRegex(name) + String.raw`\s*\(`, "g");
    callRes.set(name, re);
  }
  return re;
}

const FunctionHead = /(?<![\w.>])(?<name>[A-Za-z_]\w*)\s*\((?<params>[^;{}()]*(?:\([^;{}()]*\)[^;{}()]*)*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?\{/g;
const FunctionMacroRe = /^[ \t]*#[ \t]*define[ \t]+(\w+)\(([^)]*)\)[ \t]*([^\n]*?)[ \t]*$/gm;
const ApiCallRe = /\b(?!glGetError\b)(?:gl[A-Z]\w*|glfw[A-Z]\w*|vk[A-Z]\w*)\s*\(|(?:\.|->)\s*(?:use|setFloat|setInt|setBool|setVec2|setVec3|setVec4|setMat2|setMat3|setMat4|Draw)\s*\(/;
const CalledRe = /(?<![\w.>])([A-Za-z_]\w*)\s*\(/g;

// ---------- CppSource.Values.cs ----------
const ChronoRe = /(?:std::)?chrono::duration\s*<[^;]*?>\s*\([^;]*?\)\s*\.\s*count\s*\(\s*\)/g;
const TickRe = /\bGetTickCount(?:64)?\s*\(\s*\)/g;
const DurationRe = /(?:std::)?chrono::duration\s*<[^;]*?>\s*\(([^;]*?)\)\s*\.\s*count\s*\(\s*\)/g;
const NowRe = /(?:std::)?chrono::(?:high_resolution|steady|system)_clock::now\s*\(\s*\)/g;
const EnumRe = /\benum\s+(?:class\s+|struct\s+)?(?:\w+\s*)?(?::\s*[\w\s]+)?\{([^{}]*)\}/g;
const DefineRe = /^[ \t]*#[ \t]*define[ \t]+(\w+)[ \t]+([^\n]+)$/gm;

/**
 * A C++ file the simulator reads: the text with comments blanked out (offsets and lines stay the same), and helpers to
 * find calls, function bodies, declarations and initializers – and the values of C++ expressions (CppSource.Values.cs):
 * constants, float variables, arrays and initializer lists, evaluated with the shader expression engine (C++
 * arithmetic on floats looks the same). A clock (glfwGetTime, std::chrono) is the time.
 */
export class CppSource {
  readonly text: string;
  /** The text with comments replaced by spaces. */
  readonly code: string;

  constructor(readonly fileName: string, text: string) {
    this.text = text.replaceAll("\r\n", "\n");
    this.code = CppSource.blankComments(this.text);
  }

  /** Replaces // and /* *\/ comments with spaces, keeping newlines and string literals. */
  static blankComments(s: string): string {
    const sb = s.split("");
    let i = 0;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '"' || c === "'") {
        // A raw string R"(...)" is skipped whole.
        if (c === '"' && i > 0 && s[i - 1] === "R") {
          const close = s.indexOf(')"', i);
          i = close < 0 ? s.length : close + 2;
          continue;
        }
        i++;
        while (i < s.length && s[i] !== c && s[i] !== "\n") {
          if (s[i] === "\\") i++;
          i++;
        }
        i++;
        continue;
      }
      if (c === "/" && i + 1 < s.length && s[i + 1] === "/") {
        while (i < s.length && s[i] !== "\n") sb[i++] = " ";
        continue;
      }
      if (c === "/" && i + 1 < s.length && s[i + 1] === "*") {
        while (i < s.length && !(s[i] === "*" && i + 1 < s.length && s[i + 1] === "/")) {
          if (s[i] !== "\n") sb[i] = " ";
          i++;
        }
        if (i < s.length) sb[i++] = " ";
        if (i < s.length) sb[i++] = " ";
        continue;
      }
      i++;
    }
    return sb.join("");
  }

  lineAt(offset: number): number {
    let line = 1;
    const code = this.code;
    for (let i = 0; i < offset && i < code.length; i++) if (code.charCodeAt(i) === 10) line++;
    return line;
  }

  /** The index of the bracket that closes the one at `open` (strings are skipped), or -1. */
  static matchBracket(s: string, open: number): number {
    const o = s[open];
    const close = o === "(" ? ")" : o === "{" ? "}" : o === "[" ? "]" : ">";
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (c === '"' || c === "'") {
        i++;
        while (i < s.length && s[i] !== c) {
          if (s[i] === "\\") i++;
          i++;
        }
        continue;
      }
      if (c === o) depth++;
      else if (c === close && --depth === 0) return i;
    }
    return -1;
  }

  /** Splits "a, f(b, c), {d, e}" at the top-level commas. */
  static splitArgs(inside: string): string[] {
    const list: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < inside.length; i++) {
      const c = inside[i];
      if (c === '"' || c === "'") {
        i++;
        while (i < inside.length && inside[i] !== c) {
          if (inside[i] === "\\") i++;
          i++;
        }
        continue;
      }
      if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") depth--;
      else if (c === "," && depth === 0) {
        list.push(trimNet(inside.slice(start, i)));
        start = i + 1;
      }
    }
    const last = trimNet(inside.slice(start));
    if (last.length > 0 || list.length > 0) list.push(last);
    return list;
  }

  /** Every call of a function, or of a method when the name starts with '.' (".Present"). */
  calls(name: string, from = 0, to = Number.MAX_SAFE_INTEGER): CppCall[] {
    const list: CppCall[] = [];
    const code = this.code;
    for (const m of matchesAll(callRe(name), code)) {
      if (m.index < from || m.index >= to) continue;
      const open = m.index + m[0].length - 1;
      const close = CppSource.matchBracket(code, open);
      if (close < 0) continue;
      let target: string | null = null;
      if (name.startsWith(".")) {
        let j = m.index - 1;
        while (j >= 0 && (isLetterOrDigit(code[j]) || "_][.".includes(code[j]!) || (code[j] === ">" && j > 0 && code[j - 1] === "-") || (code[j] === "-" && j + 1 < code.length && code[j + 1] === ">"))) j--;
        target = trimNet(code.slice(j + 1, m.index));
      }
      list.push(new CppCall(name.replace(/^\.+/, ""), CppSource.splitArgs(code.slice(open + 1, close)), m.index, close + 1, this.lineAt(m.index), target));
    }
    return list;
  }

  hasCall(name: string): boolean {
    const re = callRe(name);
    re.lastIndex = 0;
    return re.test(this.code);
  }

  private functionsField: Map<string, Range> | null = null;

  /** The bodies of the function definitions in the file: name → (start, end) offsets of the text between the braces. */
  get functions(): ReadonlyMap<string, Range> {
    return (this.functionsField ??= this.findFunctions());
  }

  private findFunctions(): Map<string, Range> {
    const result = new Map<string, Range>();
    const code = this.code;
    let i = 0;
    while (i < code.length) {
      const m = matchFrom(FunctionHead, code, i);
      if (m === null) break;
      const name = m.groups!["name"]!;
      const open = m.index + m[0].length - 1;
      const close = CppSource.matchBracket(code, open);
      if (close < 0) break;
      if (["if", "while", "for", "switch", "catch", "return", "sizeof"].includes(name)) {
        i = open + 1;
        continue;
      }
      // C++ overloads (CheckCollision(GameObject&, GameObject&) and CheckCollision(BallObject&, GameObject&)): the second
      // is "CheckCollision#2", and so on; a call picks one by its arguments (chooseOverload).
      const range = { start: open + 1, end: close };
      if (!result.has(name)) result.set(name, range);
      else {
        let k = 2;
        while (result.has(`${name}#${k}`)) k++;
        result.set(`${name}#${k}`, range);
      }
      // Member functions are inside a class: keep looking inside the class body, but skip function bodies.
      i = close + 1;
    }
    return result;
  }

  /** The body text of a function definition, or null. */
  functionBody(name: string): string | null {
    const r = this.functions.get(name);
    return r === undefined ? null : this.code.slice(r.start, r.end);
  }

  /** A function's body with the function-like macros expanded, each line with its own __LINE__. */
  expandedBody(name: string): string | null {
    const r = this.functions.get(name);
    if (r === undefined) return null;
    const body = this.code.slice(r.start, r.end);
    if (this.functionMacros.size === 0 && !body.includes("__LINE__") && !body.includes("__FILE__")) return body;
    const first = this.lineAt(r.start);
    const lines = body.split("\n");
    const file = this.fileName.slice(this.fileName.lastIndexOf("/") + 1);
    for (let i = 0; i < lines.length; i++) lines[i] = this.expandMacros(lines[i]!, first + i, file);
    return lines.join("\n");
  }

  private functionMacrosField: Map<string, { params: string[]; body: string }> | null = null;

  private get functionMacros(): Map<string, { params: string[]; body: string }> {
    if (this.functionMacrosField === null) {
      const map = new Map<string, { params: string[]; body: string }>();
      for (const m of matchesAll(FunctionMacroRe, this.code)) {
        if (map.has(m[1]!)) continue;
        map.set(m[1]!, { params: m[2]!.split(",").map((p) => trimNet(p)).filter((p) => p.length > 0), body: m[3]! });
      }
      this.functionMacrosField = map;
    }
    return this.functionMacrosField;
  }

  /**
   * Text with the program's function-like macros expanded (glCheckError() → glCheckError_(__FILE__, __LINE__)),
   * __FILE__ as the file's name and __LINE__ as the given line.
   */
  expandMacros(text: string, line: number, file: string): string {
    for (let pass = 0; pass < 4 && this.functionMacros.size > 0; pass++) {
      let changed = false;
      for (const [macro, { params, body }] of this.functionMacros) {
        const call = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(macro) + String.raw`\s*\(`).exec(text);
        if (call === null) continue;
        const open = call.index + call[0].length - 1;
        const close = CppSource.matchBracket(text, open);
        if (close < 0) continue;
        const args = CppSource.splitArgs(text.slice(open + 1, close)).map((x) => trimNet(x)).filter((x) => x !== "");
        let expanded = body;
        for (let i = 0; i < params.length; i++) {
          const replacement = i < args.length ? args[i]! : "";
          expanded = expanded.replace(new RegExp(String.raw`\b` + escapeRegex(params[i]!) + String.raw`\b`, "g"), () => replacement);
        }
        text = text.slice(0, call.index) + expanded + text.slice(close + 1);
        changed = true;
      }
      if (!changed) break;
    }
    if (text.includes("__")) text = text.replaceAll("__LINE__", String(line)).replaceAll("__FILE__", '"' + file + '"');
    return text;
  }

  /** The function whose body contains an offset, or null. */
  functionAt(offset: number): string | null {
    for (const [k, v] of this.functions) if (offset >= v.start && offset < v.end) return k;
    return null;
  }

  /**
   * The text a string argument stands for: its literal (L"sprite.hlsl" → sprite.hlsl), or – when it is a parameter of
   * the function it is in (D3DCompileFromFile(shaderFile, …) in loadShaderFromFile) – the literal the callers pass,
   * followed through up to four calls.
   */
  stringValue(arg: string, offset: number, depth = 0): string | null {
    const literal = CppSource.stringArg(arg);
    if (literal !== null) return literal;
    const name = /^(\w+)(?:\.c_str\(\))?$/.exec(trimNet(arg));
    const fn = this.functionAt(offset);
    const parameters = fn === null ? null : this.parametersOf(fn);
    if (name === null || depth > 4 || fn === null || parameters === null) return this.evaluate(arg)?.text ?? null;
    const index = parameters.findIndex((p) => p.name === name[1]);
    if (index < 0) return this.evaluate(arg)?.text ?? null;
    for (const call of [...this.calls(fn), ...this.calls("." + fn)]) {
      const passed = call.arg(index);
      if (passed.length > 0) {
        const value = this.stringValue(passed, call.offset, depth + 1);
        if (value !== null) return value;
      }
    }
    const fallback = parameters[index]!.default_;
    return fallback !== null ? CppSource.stringArg(fallback) : null;
  }

  /** A function's definitions: its name, then its overloads (name#2, name#3 …). */
  overloadsOf(name: string): string[] {
    if (!this.functions.has(name)) return [];
    const list = [name];
    for (let k = 2; this.functions.has(`${name}#${k}`); k++) list.push(`${name}#${k}`);
    return list;
  }

  /**
   * The overload a call with these arguments runs: the number of arguments must fit, and a struct parameter takes an
   * argument that has the struct's members (a BallObject has GameObject's and more: the BallObject&amp; overload is the
   * closer one). The name itself when there is only one.
   */
  chooseOverload(name: string, args: readonly A.Expr[], value: (e: A.Expr) => ShaderValue | null): string {
    const all = this.overloadsOf(name);
    if (all.length < 2) return name;
    const values = args.map(value);
    let best = name;
    let bestScore = -2147483648;
    for (const candidate of all) {
      const parameters = this.parametersOf(candidate) ?? [];
      const required = parameters.filter((p) => p.default_ === null).length;
      if (values.length < required || values.length > parameters.length) continue;
      let score = 0;
      for (let i = 0; i < values.length && score > -1073741824; i++) {
        const fields = StructLayout.fields(this, parameters[i]!.type);
        if (fields === null) continue;
        const given = values[i]?.fields ?? null;
        if (given === null || !fields.every((f) => given.has(f.name))) score = -1073741824;
        else score += fields.length;
      }
      if (score > bestScore) [best, bestScore] = [candidate, score];
    }
    return best;
  }

  private readonly parameterCache = new Map<string, Parameter[] | null>();

  /**
   * The parameters of a function's definition (the one with a body), also with default values that contain calls
   * (glm::vec2 size = glm::vec2(10.0f, 10.0f)); null when the definition is not found.
   */
  parametersOf(func: string): Parameter[] | null {
    const known = this.parameterCache.get(func);
    if (known !== undefined) return known;
    let result: Parameter[] | null = null;
    const range = this.functions.get(func);
    const code = this.code;
    if (range !== undefined) {
      // The header right before the body: name ( … ) [const] {
      let brace = range.start - 1;
      while (brace >= 0 && code[brace] !== "{") brace--;
      let close = brace - 1;
      while (close >= 0 && isWhiteSpace(code[close])) close--;
      if (close >= 5 && code.slice(close - 4, close + 1) === "const") close -= 5;
      while (close >= 0 && isWhiteSpace(code[close])) close--;
      const open = close >= 0 && code[close] === ")" ? matchOpenBracket(code, close) : -1;
      if (open >= 0) {
        result = CppSource.splitArgs(code.slice(open + 1, close)).map((p) => trimNet(p)).filter((p) => p !== "" && p !== "void").map((p) => {
          const eq = topLevelEquals(p);
          const decl = eq >= 0 ? trimNet(p.slice(0, eq)) : p;
          const nameMatch = /(\w+)\s*(?:\[\s*\])?$/.exec(decl);
          const name = nameMatch?.[1] ?? "";
          const type = trimNet(decl.slice(0, nameMatch?.index ?? 0).replace(/\b(?:const|struct|unsigned)\b|[&*]|\b\w+::/g, ""));
          return new Parameter(name, decl.includes("&") && !decl.includes("&&"), eq >= 0 ? trimNet(p.slice(eq + 1)) : null, type);
        });
      }
    }
    this.parameterCache.set(func, result);
    return result;
  }

  private readonly callsApiCache = new Map<string, boolean>();

  /**
   * Whether a function of the program makes graphics API calls (gl*, glfw*, vk*, a Shader class method), itself or
   * through the program's other functions it calls (Render → DrawLevel → DrawObject → DrawSprite).
   */
  callsApi(func: string): boolean {
    const known = this.callsApiCache.get(func);
    if (known !== undefined) return known;
    // An overloaded name: any of its definitions.
    if (!func.includes("#") && this.functions.has(func + "#2")) {
      this.callsApiCache.set(func, false);
      const r = this.overloadsOf(func).slice(1).some((f) => this.callsApi(f)) || this.callsApiOf(func);
      this.callsApiCache.set(func, r);
      return r;
    }
    return this.callsApiOf(func);
  }

  private callsApiOf(func: string): boolean {
    const known = this.callsApiCache.get(func + "@");
    if (known !== undefined) return known;
    this.callsApiCache.set(func + "@", false); // a cycle (recursion) counts as no call until proven otherwise
    let result = false;
    const body = this.functionBody(func);
    if (body !== null) {
      result = ApiCallRe.test(body);
      if (!result)
        for (const m of matchesAll(CalledRe, body)) {
          const callee = m[1]!;
          if (callee !== func && this.functions.has(callee) && this.callsApi(callee)) {
            result = true;
            break;
          }
        }
    }
    this.callsApiCache.set(func + "@", result);
    return result;
  }

  /**
   * A piece of code (a for loop) that is the program's own C++ only: no API calls, no calls of the program's API-calling
   * functions, no images loaded, no shader or model objects made, no macros – the C++ runner can run it as a whole.
   */
  isPureLoop(code: string): boolean {
    if (ApiCallRe.test(code) || code.includes("stbi_") || code.includes("memcpy") || /\b(?:Shader|Model)\s+\w+\s*\(/.test(code) || /\b(?:return|goto)\b/.test(code)) return false;
    for (const m of matchesAll(CalledRe, code)) {
      const callee = m[1]!;
      if (this.functionMacros.has(callee) || (this.functions.has(callee) && this.callsApi(callee))) return false;
    }
    return true;
  }

  /**
   * Does this code (a render loop's body, OnUpdate) hand the frame's deltaTime to a function of the program that keeps
   * state with it (UpdateAnimation(animator, deltaTime): an animation that plays on frame by frame)? Input handlers
   * (processInput: a camera that moves only while a key is held) do not count.
   */
  passesDeltaTime(code: string): boolean {
    for (const m of matchesAll(/(?<![\w.>])(\w+)\s*\(([^;]*?)\bdeltaTime\b/g, code)) {
      const callee = m[1]!;
      if (this.functions.has(callee) && !/input|key|mouse|scroll|camera/i.test(callee)) return true;
    }
    return false;
  }

  /** Does a function call another function (directly)? */
  callsFunction(caller: string, callee: string): boolean {
    const body = this.functionBody(caller);
    if (body === null) return false;
    const re = callRe(callee);
    re.lastIndex = 0;
    return re.test(body);
  }

  private readonly initializers = new Map<string, string | null>();
  private readonly declaredTypes = new Map<string, string | null>();
  private readonly fieldAssignmentsCache = new Map<string, FieldAssignment[]>();

  /**
   * The initializer of a variable's declaration: "{ … }" for name[] = { … }, name = { … } and name{ … }, or the
   * expression of name = expr; (the last declaration in the file wins). Null when not found.
   */
  initializer(name: string): string | null {
    // The source does not change: each name is looked up once (the C++ runner asks for the same names often).
    const cached = this.initializers.get(name);
    if (cached !== undefined) return cached;
    const found = this.findInitializer(name);
    this.initializers.set(name, found);
    return found;
  }

  private findInitializer(name: string): string | null {
    const re = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(name) + String.raw`\s*(?:\[[^\]]*\]\s*)*(?<eq>=\s*)?(?<brace>\{)?(?<paren>\()?`, "g");
    let found: string | null = null, foundBraces: string | null = null;
    const code = this.code;
    for (const m of matchesAll(re, code)) {
      // Must be a declaration: preceded by a type (an identifier, '>', '*' or '&' and whitespace).
      let j = m.index - 1;
      while (j >= 0 && (code[j] === " " || code[j] === "\t" || code[j] === "\n")) j--;
      // (or a comma: the second declarator of const uint32_t W = 1024, H = 1024;)
      if (j < 0 || !(isLetterOrDigit(code[j]) || "_>*&,".includes(code[j]!))) continue;
      // "return name;", "else name = …" are not declarations.
      let k = j;
      while (k >= 0 && (isLetterOrDigit(code[k]) || code[k] === "_")) k--;
      const word = code.slice(k + 1, j + 1);
      if (["return", "else", "case", "delete", "new", "throw"].includes(word)) continue;
      const g = m.groups!;
      if (g["paren"] !== undefined && g["eq"] === undefined && g["brace"] === undefined) {
        // Type name(args); – a constructor call: glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
        const open = m.index + m[0].length - 1;
        const close = CppSource.matchBracket(code, open);
        const typeEnd = j + 1;
        let typeStart = typeEnd;
        while (typeStart > 0 && (isLetterOrDigit(code[typeStart - 1]) || code[typeStart - 1] === "_" || code[typeStart - 1] === ":")) typeStart--;
        if (close > 0 && close + 1 < code.length && code.slice(close + 1).trimStart().startsWith(";")) found = code.slice(typeStart, typeEnd) + code.slice(open, close + 1);
        continue;
      }
      if (g["brace"] !== undefined) {
        const open = m.index + m[0].length - 1;
        const close = CppSource.matchBracket(code, open);
        if (close > 0) foundBraces = code.slice(open, close + 1);
      } else if (g["eq"] !== undefined) {
        const from = m.index + m[0].length;
        let end = this.statementEnd(from);
        // const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;: this declarator's value ends at a comma.
        let depth = 0;
        for (let q = from; q < end; q++) {
          const ch = code[q];
          if (ch === "(" || ch === "{" || ch === "[" || ch === "<") depth++;
          else if (ch === ")" || ch === "}" || ch === "]" || ch === ">") depth--;
          else if (ch === "," && depth === 0) {
            end = q;
            break;
          }
        }
        found = trimNet(code.slice(from, end));
      }
    }
    // Data (vertices, indices, a clear value) is written with braces; a local of the same name
    // (QueueFamilyIndices indices = findQueueFamilies(…)) should not hide it.
    return foundBraces ?? found;
  }

  /** The offset of the ';' that ends the statement starting at `from` (nested brackets skipped). */
  statementEnd(from: number): number {
    const code = this.code;
    let depth = 0;
    for (let i = from; i < code.length; i++) {
      const c = code[i];
      if (c === '"' || c === "'") {
        i++;
        while (i < code.length && code[i] !== c) {
          if (code[i] === "\\") i++;
          i++;
        }
        continue;
      }
      if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") {
        if (--depth < 0) return i;
      } else if (c === ";" && depth === 0) return i;
    }
    return code.length;
  }

  /** The declared type of a variable (the word before it: "std::vector&lt;Vertex&gt;" gives "std::vector&lt;Vertex&gt;"). */
  declaredType(name: string): string | null {
    const cached = this.declaredTypes.get(name);
    if (cached !== undefined) return cached;
    const found = this.findDeclaredType(name);
    this.declaredTypes.set(name, found);
    return found;
  }

  private findDeclaredType(name: string): string | null {
    // "Type name" / "Type* name" / "std::vector<T> name" followed by = ; { ( [ , ): the first declaration in the file.
    // Found from the name backwards (a regex trying a type at every identifier is slow on a long program).
    const code = this.code;
    for (const m of matchesAll(new RegExp(escapeRegex(name) + String.raw`\s*(?:\[[^\]]*\]\s*)*[=;{(\[,)]`, "g"), code)) {
      let j = m.index - 1;
      // At least one whitespace right before the name, after an optional * or &.
      if (j < 0 || !isWhiteSpace(code[j])) continue;
      while (j >= 0 && isWhiteSpace(code[j])) j--;
      if (j >= 0 && (code[j] === "*" || code[j] === "&")) {
        j--;
        while (j >= 0 && isWhiteSpace(code[j])) j--;
      }
      if (j < 0) continue;
      const typeEnd = j + 1;
      if (code[j] === ">") {
        // A template's arguments: back to the matching '<' (no ; = ( ) { } inside).
        let depth = 0;
        for (; j >= 0; j--) {
          const ch = code[j]!;
          if (";=(){}".includes(ch)) {
            j = -1;
            break;
          }
          if (ch === ">") depth++;
          else if (ch === "<" && --depth === 0) break;
        }
        if (j < 0) continue;
        j--;
        while (j >= 0 && isWhiteSpace(code[j])) j--;
      }
      const identEnd = j + 1;
      while (j >= 0 && (isLetterOrDigit(code[j]) || code[j] === "_" || code[j] === ":")) j--;
      let start = j + 1;
      while (start < identEnd && !(isLetter(code[start]) || code[start] === "_")) start++;
      if (start >= identEnd) continue;
      const type = code.slice(start, typeEnd);
      if (["return", "else", "case", "new", "delete"].includes(type)) continue;
      return type.replace(/\s+/g, "");
    }
    return null;
  }

  /** Assignments "target.field = value;" (also through -> and with a swizzle-like .x after the field). */
  fieldAssignments(field: string): FieldAssignment[] {
    let list = this.fieldAssignmentsCache.get(field);
    if (list === undefined) {
      list = this.findFieldAssignments(field);
      this.fieldAssignmentsCache.set(field, list);
    }
    return list;
  }

  private findFieldAssignments(field: string): FieldAssignment[] {
    const re = new RegExp(String.raw`(?<target>[A-Za-z_][\w\[\]]*(?:(?:\.|->)[A-Za-z_]\w*)*)\s*(?:\.|->)\s*` + escapeRegex(field) + String.raw`\s*=(?!=)\s*`, "g");
    return matchesAll(re, this.code).map((m) => {
      const end = this.statementEnd(m.index + m[0].length);
      return { target: m.groups!["target"]!, field, value: trimNet(this.code.slice(m.index + m[0].length, end)), offset: m.index };
    });
  }

  /** The value last assigned to ".field" before an offset (optionally on a given target, e.g. "samplers[1]"). */
  fieldValueBefore(field: string, offset: number, target: string | null = null): string | null {
    const list = this.fieldAssignments(field).filter((a) => a.offset < offset && (target === null || a.target === target));
    return list.length > 0 ? list[list.length - 1]!.value : null;
  }

  /** The value assigned to any ".field" (the last one in the file), e.g. "rasterizer.cullMode = VK_CULL_MODE_NONE". */
  lastFieldValue(field: string): string | null {
    const list = this.fieldAssignments(field);
    return list.length > 0 ? list[list.length - 1]!.value : null;
  }

  /** The string literal of an argument ("LearnOpenGL", L"Title"), or null. */
  static stringArg(arg: string): string | null {
    const m = /^(?:L|u8)?"((?:[^"\\]|\\.)*)"$/.exec(arg);
    return m ? regexUnescape(m[1]!) : null;
  }

  /** Does the code use an identifier (as a whole word)? */
  uses(identifier: string): boolean {
    return new RegExp(String.raw`(?<![\w])` + escapeRegex(identifier) + String.raw`(?![\w])`).test(this.code);
  }

  // ---------- values (CppSource.Values.cs) ----------

  private readonly resolving = new Set<string>();
  private defines: Map<string, string> | null = null;

  /** Set when an evaluated value depended on the time (the preview then animates). */
  usedTime = false;

  /** Other names to know (e.g. a struct variable filled in elsewhere). */
  extra: ((name: string) => ShaderValue | null) | null = null;

  /**
   * C++ as the program runs it: a clock's now() is the time (glfwGetTime(), seconds), a duration's count() the
   * difference of two such times; GetTickCount the time in milliseconds.
   */
  static prepare(expr: string): string {
    if (expr.includes("chrono")) {
      expr = expr.replace(DurationRe, "($1)");
      expr = expr.replace(NowRe, "glfwGetTime()");
    }
    return expr.replace(TickRe, "(glfwGetTime() * 1000.0)");
  }

  /**
   * For a value read without running the program (an initializer): any duration is the time since the program started
   * (std::chrono::duration&lt;float&gt;(now - startTime).count() → glfwGetTime()).
   */
  private static prepareStatic(expr: string): string {
    expr = expr.replace(ChronoRe, "glfwGetTime()");
    return expr.replace(TickRe, "(glfwGetTime() * 1000.0)");
  }

  /** Evaluates an expression at a time; null when it cannot be (unknown names, unsupported syntax). */
  evaluate(expr: string, time = 1.0): ShaderValue | null {
    if (trimNet(expr).length === 0) return null;
    return this.evaluateOrNull(expr, time);
  }

  /** The numbers of an expression or initializer list, flattened ({ {0.5f, 1}, {2} } → 0.5, 1, 2). */
  numbers(expr: string, time = 1.0): number[] | null {
    const v = this.evaluate(expr, time);
    if (v === null) return null;
    const list: number[] = [];
    flatten(v, list);
    return list;
  }

  private enumeratorsField: Map<string, number> | null = null;

  /** The program's enum constants (enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN }): 0, 1, 2 … or as given. */
  private enumerators(): Map<string, number> {
    if (this.enumeratorsField !== null) return this.enumeratorsField;
    const result = new Map<string, number>();
    for (const m of matchesAll(EnumRe, this.code)) {
      let next = 0;
      for (const item of CppSource.splitArgs(m[1]!)) {
        const e = /^(\w+)\s*(?:=\s*(.+))?$/s.exec(trimNet(item));
        if (e === null) continue;
        if (e[2] !== undefined) {
          const text = trimNet(e[2]);
          if (/^\s*[+-]?\d+\s*$/.test(text)) next = Number(text);
          else if (/^0x/i.test(text) && /^[0-9a-fA-F]+$/.test(text.slice(2))) next = Number(BigInt.asIntN(64, BigInt("0x" + text.slice(2))));
          else if (result.has(text)) next = result.get(text)!;
        }
        result.set(e[1]!, next++);
      }
    }
    return (this.enumeratorsField = result);
  }

  /** The value of a name in this file: a #define, a constant or variable with an initializer, or an API constant. */
  private resolve(name: string, time: number): ShaderValue | null {
    const extra = this.extra?.(name) ?? null;
    if (extra !== null) return extra;
    const k = knownConstant(name);
    if (k !== null) return ShaderValue.scalar(k);
    const enumerator = this.enumerators().get(name);
    if (enumerator !== undefined) return ShaderValue.integer(enumerator);
    if (this.resolving.has(name)) return null;
    this.resolving.add(name);
    try {
      if (this.defines === null) {
        const d = new Map<string, string>();
        for (const m of matchesAll(DefineRe, this.code)) if (!d.has(m[1]!)) d.set(m[1]!, trimNet(m[2]!));
        this.defines = d;
      }
      const defined = this.defines.get(name);
      if (defined !== undefined) return this.evaluateOrNull(defined, time);
      const init = this.initializer(name);
      if (init !== null) {
        // A number has its variable's type: float fov = 45 divides as a float, int rows = 7 as an integer.
        const value = this.evaluateOrNull(init, time);
        if (value !== null && value.v !== null && value.v.length === 1 && !value.isMatrix) {
          const declared = this.declaredType(name);
          const type = trimNet((declared ?? "").replaceAll("const", "").replaceAll("static", "").replaceAll("constexpr", "").replaceAll("unsigned", ""));
          const isInt = type === "" ? declared?.includes("unsigned") === true : ShaderValue.isIntType(type);
          if (isInt !== value.int) return isInt ? ShaderValue.integer(Math.trunc(value.x)) : ShaderValue.scalar(value.x);
        }
        return value;
      }
      // An API constant (VK_SAMPLE_COUNT_1_BIT as a member's initializer): its name.
      return /^(?:D3D12|DXGI|D3D|VK)_[A-Z0-9_]+$/.test(name) ? ShaderValue.str(name) : null;
    } finally {
      this.resolving.delete(name);
    }
  }

  private evaluateOrNull(expr: string, time: number): ShaderValue | null {
    const prepared = CppSource.prepareStatic(expr);
    if (prepared.includes("glfwGetTime")) this.usedTime = true;
    try {
      const runner = ShaderRunner.forExpressions((n) => this.resolve(n, time), time);
      return runner.evaluate(ShaderParser.parseExpression(prepared));
    } catch (e) {
      if (e instanceof ShaderSyntaxException || e instanceof ShaderRuntimeException) return null;
      throw e;
    }
  }

  /** An integer argument (a draw count …), or null. */
  int(expr: string, time = 1.0): number | null {
    const v = this.evaluate(expr, time);
    return v !== null && v.v !== null && v.v.length > 0 ? toInt(roundEven(v.v[0]!)) : null;
  }
}

function flatten(v: ShaderValue, into: number[]): void {
  if (v.v !== null) for (const x of v.v) into.push(x);
  else if (v.packed !== null) for (const x of v.packed) into.push(x);
  else {
    const items = v.items;
    if (items !== null) for (const i of items) flatten(i, into);
    else if (v.fields !== null) for (const f of v.fields.values()) flatten(f, into);
  }
}

function topLevelEquals(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
    else if (c === ")" || c === "]" || c === "}" || c === ">") depth--;
    else if (c === "=" && depth === 0 && (i + 1 >= s.length || s[i + 1] !== "=")) return i;
  }
  return -1;
}

/** The '(' that matches the ')' at `close`, or -1. */
function matchOpenBracket(s: string, close: number): number {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (s[i] === ")") depth++;
    else if (s[i] === "(" && --depth === 0) return i;
  }
  return -1;
}

const KnownConstants = new Map<string, number>([
  ["TRUE", 1], ["GL_TRUE", 1], ["VK_TRUE", 1], ["GLFW_TRUE", 1],
  ["FALSE", 0], ["GL_FALSE", 0], ["VK_FALSE", 0], ["GLFW_FALSE", 0], ["NULL", 0], ["nullptr", 0],
  // glibc's rand() range (the simulator's rand() is glibc's).
  ["RAND_MAX", 2147483647],
  // VK_EXT_debug_utils' severity and type bits (vulkan-tutorial's debugCallback compares the severity).
  ["VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT", 0x1],
  ["VK_DEBUG_UTILS_MESSAGE_SEVERITY_INFO_BIT_EXT", 0x10],
  ["VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT", 0x100],
  ["VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT", 0x1000],
  ["VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT", 0x1],
  ["VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT", 0x2],
  ["VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT", 0x4],
  // OpenGL's error codes and the debug output's enums (learnopengl's glCheckError_ and glDebugOutput switch on them).
  ["GL_NO_ERROR", 0],
  ["GL_INVALID_ENUM", 0x0500],
  ["GL_INVALID_VALUE", 0x0501],
  ["GL_INVALID_OPERATION", 0x0502],
  ["GL_STACK_OVERFLOW", 0x0503],
  ["GL_STACK_UNDERFLOW", 0x0504],
  ["GL_OUT_OF_MEMORY", 0x0505],
  ["GL_INVALID_FRAMEBUFFER_OPERATION", 0x0506],
  ["GL_CONTEXT_FLAG_DEBUG_BIT", 0x2],
  ["GL_DEBUG_SOURCE_API", 0x8246],
  ["GL_DEBUG_SOURCE_WINDOW_SYSTEM", 0x8247],
  ["GL_DEBUG_SOURCE_SHADER_COMPILER", 0x8248],
  ["GL_DEBUG_SOURCE_THIRD_PARTY", 0x8249],
  ["GL_DEBUG_SOURCE_APPLICATION", 0x824a],
  ["GL_DEBUG_SOURCE_OTHER", 0x824b],
  ["GL_DEBUG_TYPE_ERROR", 0x824c],
  ["GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR", 0x824d],
  ["GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR", 0x824e],
  ["GL_DEBUG_TYPE_PORTABILITY", 0x824f],
  ["GL_DEBUG_TYPE_PERFORMANCE", 0x8250],
  ["GL_DEBUG_TYPE_OTHER", 0x8251],
  ["GL_DEBUG_TYPE_MARKER", 0x8268],
  ["GL_DEBUG_TYPE_PUSH_GROUP", 0x8269],
  ["GL_DEBUG_TYPE_POP_GROUP", 0x826a],
  ["GL_DEBUG_SEVERITY_HIGH", 0x9146],
  ["GL_DEBUG_SEVERITY_MEDIUM", 0x9147],
  ["GL_DEBUG_SEVERITY_LOW", 0x9148],
  ["GL_DEBUG_SEVERITY_NOTIFICATION", 0x826b],
  // GLFW's key codes and actions (input: no key is down unless the simulator presses one).
  ["GLFW_RELEASE", 0],
  ["GLFW_PRESS", 1],
  ["GLFW_REPEAT", 2],
  ["GLFW_KEY_SPACE", 32],
  ["GLFW_KEY_ESCAPE", 256],
  ["GLFW_KEY_ENTER", 257],
  ["GLFW_KEY_RIGHT", 262],
  ["GLFW_KEY_LEFT", 263],
  ["GLFW_KEY_DOWN", 264],
  ["GLFW_KEY_UP", 265],
  ["GLFW_KEY_LEFT_SHIFT", 340],
  ["VK_SPACE", 0x20],
  ["VK_ESCAPE", 0x1b],
  ["VK_RETURN", 0x0d],
  ["VK_LEFT", 0x25],
  ["VK_UP", 0x26],
  ["VK_RIGHT", 0x27],
  ["VK_DOWN", 0x28],
]);

/** A few API constants whose numeric value matters (TRUE/FALSE, GL_TRUE …). */
function knownConstant(name: string): number | null {
  const k = KnownConstants.get(name);
  if (k !== undefined) return k;
  // GLFW_KEY_A … GLFW_KEY_Z, GLFW_KEY_0 … GLFW_KEY_9: the character's code.
  if (name.length === 10 && name.startsWith("GLFW_KEY_") && /[A-Z0-9]/.test(name[9]!)) return name.charCodeAt(9);
  return null;
}
