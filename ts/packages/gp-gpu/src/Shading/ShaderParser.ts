// ShaderParser.cs, ShaderParser.Statements.cs and ShaderParser.Expressions.cs.
import { isDigit, isLetter, isUpper, parseDouble, parseInt32, toInt } from "../internal/dotnet.js";
import * as A from "./ShaderAst.js";
import { ShaderSyntaxException } from "./ShaderErrors.js";
import { ShaderLexer } from "./ShaderLexer.js";
import { ShaderProgram } from "./ShaderProgram.js";
import { ShaderToken, ShaderTokenKind } from "./ShaderToken.js";
import { componentCount, matrixSize } from "./ShaderTypes.js";
import { ShaderValue } from "./ShaderValue.js";

const Qualifiers = new Set([
  "in", "out", "inout", "uniform", "const", "static", "flat", "smooth", "noperspective", "centroid", "highp", "mediump", "lowp",
  "linear", "nointerpolation", "readonly", "writeonly", "buffer", "shared", "groupshared", "precise", "invariant", "row_major", "column_major",
  "unsigned", "signed", "constexpr", "volatile", "inline", "patch", "coherent", "restrict",
]);

const Primitives = new Set(["points", "lines", "lines_adjacency", "triangles", "triangles_adjacency", "line_strip", "triangle_strip"]);

// Expressions, by precedence: ?:, ||, &&, == !=, < > <= >=, + -, * / %, unary, postfix (calls, members, indexing).
const Levels: string[][] = [
  ["||"],
  ["&&"],
  ["|"],
  ["^"],
  ["&"],
  ["==", "!="],
  ["<", ">", "<=", ">="],
  // << and >> (two tokens each: ">>" also closes templates), handled in binary.
  ["<<", ">>"],
  ["+", "-"],
  ["*", "/", "%"],
];

const FloatMax = 3.4028234663852886e38;

/** A whole number of a token's text, as (int)double.Parse(text) gives it. */
const intOf = (text: string): number => toInt(parseDouble(text));

/**
 * Parses the subset of GLSL and HLSL that the course uses (globals, structs, uniform blocks, cbuffers and functions
 * with declarations, assignments, if, for and return) – and single C++ expressions such as
 * <c>sin(timeValue) / 2.0f + 0.5f</c>.
 */
export class ShaderParser {
  /** The function name a string literal is parsed as: "abc" → __literal(abc) (its text kept as a name). */
  static readonly StringLiteral = "__literal";

  /** The function name std::get&lt;N&gt;(t) is parsed as: __get(N, t). */
  static readonly TupleGet = "__get";

  private pos = 0;

  /** C++ mode: a statement that does not parse is skipped (up to its ';' or block) instead of failing. */
  private lenient = false;

  private constructor(private readonly tokens: ShaderToken[]) {}

  /** Parses C++ statements (a function body without its braces), skipping what the subset does not cover. */
  static parseStatementsLenient(source: string): A.Stmt[] {
    const p = new ShaderParser(ShaderLexer.tokenize(source));
    p.lenient = true;
    const list: A.Stmt[] = [];
    while (p.peek.kind !== ShaderTokenKind.End) list.push(...p.statementOrSkip());
    return list;
  }

  /** Parses a whole shader. */
  static parseProgram(source: string): ShaderProgram {
    const p = new ShaderParser(ShaderLexer.tokenize(source));
    const program = p.program();
    program.source = source;
    return program;
  }

  /** Parses one expression (e.g. the right-hand side of a C++ assignment). */
  static parseExpression(source: string): A.Expr {
    const p = new ShaderParser(ShaderLexer.tokenize(source));
    const e = p.expression();
    if (p.peek.kind !== ShaderTokenKind.End) throw new ShaderSyntaxException(`unexpected '${p.peek.text}'`, p.peek.line);
    return e;
  }

  private get peek(): ShaderToken {
    return this.tokens[this.pos]!;
  }

  private peekAt(offset: number): ShaderToken {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private next(): ShaderToken {
    return this.tokens[this.pos < this.tokens.length - 1 ? this.pos++ : this.pos]!;
  }

  private accept(text: string): boolean {
    if (!this.peek.is(text)) return false;
    this.pos++;
    return true;
  }

  private expect(text: string): ShaderToken {
    if (!this.peek.is(text)) {
      throw new ShaderSyntaxException(this.peek.kind === ShaderTokenKind.End ? `expected '${text}' at end of input` : `expected '${text}' before '${this.peek.text}'`, this.peek.line);
    }
    return this.next();
  }

  private identifier(): string {
    if (this.peek.kind !== ShaderTokenKind.Identifier) {
      throw new ShaderSyntaxException(this.peek.kind === ShaderTokenKind.End ? "expected an identifier at end of input" : `expected an identifier before '${this.peek.text}'`, this.peek.line);
    }
    return this.next().text;
  }

  private hlslInputPrimitive: string | null = null;
  private hlslOutputPrimitive: string | null = null;

  /** HLSL attributes read since the last function: they belong to the next one. */
  private pendingAttributes = new Map<string, string[]>();

  /** The names the code uses (ShaderProgram.names). */
  private readonly names = new Set<string>();

  /** Integer constants declared so far (const int NR_LIGHTS = 32;), for array sizes. */
  private readonly constInts = new Map<string, number>();

  private program(): ShaderProgram {
    const program = new ShaderProgram();
    while (this.peek.kind !== ShaderTokenKind.End) {
      if (this.accept(";")) continue;
      if (this.peek.is("[")) {
        // HLSL attribute: [numthreads(8, 8, 1)], [RootSignature(...)]
        // [instance(5)]: a geometry shader that runs 5 times per primitive (SV_GSInstanceID 0 … 4).
        if (this.peekAt(1).is("instance") && this.peekAt(2).is("(") && this.peekAt(3).kind === ShaderTokenKind.Number && this.peekAt(4).is(")"))
          program.invocations = Math.max(1, intOf(this.peekAt(3).text));
        // The attribute and its arguments, for the function that follows ([domain("quad")], [numthreads(16, 16, 1)]).
        if (this.peekAt(1).kind === ShaderTokenKind.Identifier && this.peekAt(2).is("(")) {
          const attribute = this.peekAt(1).text;
          const values: string[] = [];
          let k = 3;
          while (!this.peekAt(k).is(")") && this.peekAt(k).kind !== ShaderTokenKind.End) {
            if (!this.peekAt(k).is(",")) values.push(this.peekAt(k).text);
            k++;
          }
          this.pendingAttributes.set(attribute, values);
        }
        this.skipBalanced("[", "]");
        continue;
      }
      if (this.peek.is("precision")) {
        while (!this.accept(";")) this.next();
        continue;
      }
      if (this.peek.is("struct")) {
        program.structs.push(this.structDecl());
        continue;
      }
      if (this.peek.is("cbuffer") || this.peek.is("tbuffer")) {
        const line = this.next().line;
        const name = this.identifier();
        const register = this.skipRegister();
        const fields = this.fields();
        this.accept(";");
        program.globals.push(new A.Global("uniform", name, "", null, false, fields, null, 0, line, register));
        continue;
      }
      this.global(program);
    }
    program.inputPrimitive ??= this.hlslInputPrimitive;
    program.outputPrimitive ??= this.hlslOutputPrimitive;
    for (const n of this.names) program.names.add(n);
    return program;
  }

  private skipBalanced(open: string, close: string): void {
    let depth = 0;
    do {
      const t = this.next();
      if (t.is(open)) depth++;
      else if (t.is(close)) depth--;
      else if (t.kind === ShaderTokenKind.End) return;
    } while (depth > 0);
  }

  /** ": register(b0)" or ": register(b0, space1)" after an HLSL resource: the register's number, or null. */
  private skipRegister(): number | null {
    if (!(this.peek.is(":") && this.peekAt(1).is("register"))) return null;
    this.next();
    this.next();
    let num: number | null = null;
    if (this.peek.is("(") && this.peekAt(1).kind === ShaderTokenKind.Identifier) {
      const m = /^[a-zA-Z](\d+)$/.exec(this.peekAt(1).text);
      if (m) num = parseInt32(m[1]!);
    }
    this.skipBalanced("(", ")");
    return num;
  }

  private structDecl(): A.Struct {
    this.expect("struct");
    const name = this.identifier();
    const fields = this.fields();
    this.accept(";");
    return new A.Struct(name, fields);
  }

  /** { type name [N] [: SEMANTIC]; … } */
  private fields(): A.Field[] {
    this.expect("{");
    const fields: A.Field[] = [];
    while (!this.accept("}")) {
      if (this.peek.kind === ShaderTokenKind.End) throw new ShaderSyntaxException("expected '}' at end of input", this.peek.line);
      while (this.peek.kind === ShaderTokenKind.Identifier && Qualifiers.has(this.peek.text)) this.next();
      if (this.peek.is("layout")) {
        this.next();
        this.skipBalanced("(", ")");
      }
      const type = this.typeName();
      do {
        const id = this.identifier();
        const size = this.arraySuffix();
        let semantic: string | null = null;
        if (this.accept(":")) semantic = this.identifier();
        fields.push(new A.Field(type, id, semantic, size));
      } while (this.accept(","));
      this.expect(";");
    }
    return fields;
  }

  /** The template arguments of the last type name read (std::array&lt;VkClearValue, 2&gt; → "VkClearValue", "2"). */
  private templateArgs: ShaderToken[][] = [];

  /** A type name, with template arguments (Texture2D&lt;float4&gt;, matrix&lt;float, 4, 4&gt;). */
  private typeName(): string {
    let type = this.identifier();
    this.templateArgs = [];
    if (this.peek.is("<")) {
      let depth = 0;
      let current: ShaderToken[] = [];
      do {
        const t = this.next();
        if (t.is("<")) depth++;
        else if (t.is(">")) depth--;
        if ((depth === 1 && t.is(",")) || (depth === 0 && t.is(">"))) {
          this.templateArgs.push(current);
          current = [];
        } else if (!(depth === 1 && t.is("<"))) current.push(t);
      } while (depth > 0 && this.peek.kind !== ShaderTokenKind.End);
    }
    // A nested C++ type: std::map<float, glm::vec3>::reverse_iterator.
    while (this.peek.is("::") && this.peekAt(1).kind === ShaderTokenKind.Identifier) {
      this.next();
      type += "::" + this.next().text;
    }
    return type;
  }

  /** [N] after a name: N (0 = not an array, -1 = size from the initializer). */
  private arraySuffix(): number {
    if (!this.accept("[")) return 0;
    if (this.accept("]")) return -1;
    const n = this.next();
    this.expect("]");
    // C++: float vertices[6][4] – an array of rows (the inner sizes come from the initializer's lists).
    while (this.lenient && this.peek.is("[") && this.peekAt(2).is("]")) {
      this.next();
      this.next();
      this.next();
    }
    // A size named by a constant: const int NR_LIGHTS = 32; uniform Light lights[NR_LIGHTS];
    if (n.kind !== ShaderTokenKind.Number) {
      const named = this.constInts.get(n.text);
      if (named !== undefined) return named;
    }
    return n.kind === ShaderTokenKind.Number ? intOf(n.text) : -1;
  }

  private global(program: ShaderProgram): void {
    const line = this.peek.line;
    let location: number | null = null, binding: number | null = null;
    let pushConstant = false;
    let primitive: string | null = null;
    let maxVertices: number | null = null, invocations: number | null = null;
    let tessTriangles = false;
    if (this.accept("layout")) {
      this.expect("(");
      while (!this.accept(")")) {
        const key = this.next();
        if (key.kind === ShaderTokenKind.End) throw new ShaderSyntaxException("expected ')' at end of input", key.line);
        if (key.is("push_constant")) pushConstant = true;
        if (key.kind === ShaderTokenKind.Identifier && Primitives.has(key.text)) primitive = key.text;
        if (key.is("max_vertices") && this.peek.is("=") && this.peekAt(1).kind === ShaderTokenKind.Number) maxVertices = intOf(this.peekAt(1).text);
        if (key.is("invocations") && this.peek.is("=") && this.peekAt(1).kind === ShaderTokenKind.Number) invocations = intOf(this.peekAt(1).text);
        // Tessellation: layout (vertices = 4) out; layout (quads, fractional_odd_spacing, ccw) in;
        if (key.is("vertices") && this.peek.is("=") && this.peekAt(1).kind === ShaderTokenKind.Number) program.tessVertices = intOf(this.peekAt(1).text);
        if (key.is("quads") || key.is("isolines")) program.tessDomain = key.text;
        if (key.is("triangles")) tessTriangles = true;
        if (key.is("equal_spacing") || key.is("fractional_odd_spacing") || key.is("fractional_even_spacing")) program.tessSpacing = key.text;
        if (key.is("cw")) program.tessCw = true;
        if (key.is("point_mode")) program.tessPointMode = true;
        // Compute: layout (local_size_x = 16, local_size_y = 16) in;
        if ((key.text === "local_size_x" || key.text === "local_size_y" || key.text === "local_size_z") && this.peek.is("=") && this.peekAt(1).kind === ShaderTokenKind.Number)
          program.localSize[key.text.charCodeAt(key.text.length - 1) - 120] = Math.max(1, intOf(this.peekAt(1).text));
        if ((key.is("location") || key.is("binding")) && this.accept("=")) {
          const v = this.next();
          if (v.kind === ShaderTokenKind.Number) {
            const n = intOf(v.text);
            if (key.is("location")) location = n;
            else binding = n;
          }
        }
      }
    }
    let storage = "";
    while (this.peek.kind === ShaderTokenKind.Identifier && Qualifiers.has(this.peek.text)) {
      const q = this.next().text;
      if (q === "in" || q === "out" || q === "uniform" || q === "buffer") storage = q;
      else if (q === "const" && storage === "") storage = "const";
    }
    // "layout(local_size_x = 8) in;", and a geometry shader's "layout (points) in;" / "layout (triangle_strip, max_vertices = 3) out;"
    if (this.accept(";")) {
      if (storage === "in" && primitive !== null) program.inputPrimitive = primitive;
      // A tessellation evaluation shader's triangle domain: triangles with a spacing or a winding.
      if (storage === "in" && tessTriangles && (program.tessSpacing !== null || program.tessCw || program.tessPointMode)) program.tessDomain = "triangles";
      if (storage === "in" && invocations !== null && invocations > 0) program.invocations = invocations;
      if (storage === "out" && primitive !== null) program.outputPrimitive = primitive;
      if (storage === "out" && maxVertices !== null) program.maxVertices = maxVertices;
      return;
    }
    const type = this.typeName();
    // A block: uniform Name { … } instance;
    if (this.peek.is("{")) {
      const fields = this.fields();
      let instance = "";
      if (this.peek.kind === ShaderTokenKind.Identifier) instance = this.identifier();
      this.arraySuffix();
      this.expect(";");
      program.globals.push(new A.Global(storage === "" ? "uniform" : storage, type, instance, location, pushConstant, fields, null, 0, line, binding));
      return;
    }
    let id = this.identifier();
    if (this.peek.is("(")) {
      program.functions.push(this.functionRest(type, id, line));
      if (this.pendingAttributes.size > 0) {
        program.attributes.set(id, this.pendingAttributes);
        this.pendingAttributes = new Map();
      }
      return;
    }
    while (true) {
      const size = this.arraySuffix();
      let register: number | null = null;
      if (this.peek.is(":") && this.peekAt(1).is("register")) register = this.skipRegister();
      else if (this.accept(":")) this.identifier(); // (the semantic)
      const value = this.accept("=") ? this.initializer() : null;
      // HLSL resources (Texture2D, SamplerState …) and plain HLSL globals are uniforms.
      const st = storage === "" && (type.startsWith("Texture") || type.startsWith("Sampler") || type.startsWith("RWTexture")) ? "uniform" : storage;
      program.globals.push(new A.Global(st, type, id, location, pushConstant, null, value, size, line, register ?? binding));
      // (HLSL: static const int N = 32; – the storage is "static" there)
      if ((st === "const" || st === "static") && (type === "int" || type === "uint") && value instanceof A.Number) this.constInts.set(id, toInt(value.value));
      if (!this.accept(",")) break;
      id = this.identifier();
    }
    this.expect(";");
  }

  private functionRest(returnType: string, id: string, line: number): A.Function {
    this.expect("(");
    const ps: A.Param[] = [];
    if (!this.accept(")")) {
      if (this.peek.is("void") && this.peekAt(1).is(")")) {
        this.next();
        this.next();
      } else {
        do {
          let isOut = false;
          while (this.peek.kind === ShaderTokenKind.Identifier && Qualifiers.has(this.peek.text)) {
            const q = this.next().text;
            if (q === "out" || q === "inout") isOut = true;
          }
          // An HLSL geometry shader's input: "triangle VSOutput input[3]".
          if (this.peek.kind === ShaderTokenKind.Identifier && ["point", "line", "triangle", "lineadj", "triangleadj"].includes(this.peek.text)
            && this.peekAt(1).kind === ShaderTokenKind.Identifier && this.peekAt(2).kind === ShaderTokenKind.Identifier) {
            const x = this.next().text;
            this.hlslInputPrimitive = x === "point" ? "points" : x === "line" ? "lines" : x === "triangle" ? "triangles" : x;
          }
          let type = this.typeName();
          // A hull or domain shader's patch: InputPatch<VSOutput, 4> – the element type kept with it.
          if ((type === "InputPatch" || type === "OutputPatch") && this.templateArgs.length >= 1 && this.templateArgs[0]!.length >= 1)
            type = `${type}<${this.templateArgs[0]![this.templateArgs[0]!.length - 1]!.text}>`;
          if (type === "PointStream" || type === "LineStream" || type === "TriangleStream")
            this.hlslOutputPrimitive = type === "PointStream" ? "points" : type === "LineStream" ? "line_strip" : "triangle_strip";
          const name = this.identifier();
          this.arraySuffix();
          const semantic = this.accept(":") ? this.identifier() : null;
          ps.push(new A.Param(type, name, semantic, isOut));
        } while (this.accept(","));
        this.expect(")");
      }
    }
    const retSemantic = this.accept(":") ? this.identifier() : null;
    if (this.accept(";")) return new A.Function(returnType, id, ps, retSemantic, [], line);
    const body = this.block();
    return new A.Function(returnType, id, ps, retSemantic, body, line);
  }

  // ---------- statements: blocks, declarations, assignments, if, for, return (ShaderParser.Statements.cs) ----------

  private block(): A.Stmt[] {
    this.expect("{");
    const list: A.Stmt[] = [];
    while (!this.accept("}")) {
      if (this.peek.kind === ShaderTokenKind.End) throw new ShaderSyntaxException("expected '}' at end of input", this.peek.line);
      list.push(...(this.lenient ? this.statementOrSkip() : this.statement()));
    }
    return list;
  }

  /** A statement, or – in C++ mode, when it does not parse – nothing, after skipping to its end. */
  private statementOrSkip(): A.Stmt[] {
    const start = this.pos;
    try {
      return this.statement();
    } catch (e) {
      if (!(e instanceof ShaderSyntaxException)) throw e;
      this.pos = start;
      let depth = 0;
      while (this.peek.kind !== ShaderTokenKind.End) {
        const t = this.next();
        if (t.is("(") || t.is("{") || t.is("[")) depth++;
        else if (t.is(")") || t.is("]")) depth--;
        else if (t.is("}")) {
          if (--depth <= 0) break;
        } else if (t.is(";") && depth <= 0) break;
        if (depth < 0) {
          this.pos--;
          break;
        }
      }
      return [];
    }
  }

  /**
   * switch (e) { case A: … break; case B: case C: … default: … } as an if / else if chain: each group of labels with
   * its statements up to its break (a group without one falls through into the next groups' statements).
   */
  private switchStatement(line: number): A.Stmt {
    this.expect("(");
    const subject = this.expression();
    this.expect(")");
    this.expect("{");
    const groups: { labels: (A.Expr | null)[]; body: A.Stmt[] }[] = [];
    const last = () => groups[groups.length - 1]!;
    while (!this.accept("}")) {
      if (this.peek.kind === ShaderTokenKind.End) throw new ShaderSyntaxException("expected '}' to end the switch", line);
      if (this.accept("case")) {
        const label = this.expression();
        this.expect(":");
        if (groups.length === 0 || last().body.length > 0) groups.push({ labels: [], body: [] });
        last().labels.push(label);
        continue;
      }
      if (this.accept("default")) {
        this.expect(":");
        if (groups.length === 0 || last().body.length > 0) groups.push({ labels: [], body: [] });
        last().labels.push(null);
        continue;
      }
      if (groups.length === 0) groups.push({ labels: [], body: [] });
      last().body.push(...(this.lenient ? this.statementOrSkip() : this.statement()));
    }
    // Each group's statements up to its break, falling through into the next groups when it has none.
    const effective = (g: number): A.Stmt[] => {
      const result: A.Stmt[] = [];
      for (let i = g; i < groups.length; i++) {
        for (const s of groups[i]!.body) {
          if (s instanceof A.Break) return result;
          result.push(s);
        }
      }
      return result;
    };
    let otherwise: A.Stmt[] | null = null;
    const defaultGroup = groups.findIndex((g) => g.labels.includes(null));
    if (defaultGroup >= 0) otherwise = effective(defaultGroup);
    let chain: A.Stmt | null = null;
    for (let g = groups.length - 1; g >= 0; g--) {
      const labels = groups[g]!.labels.filter((l): l is A.Expr => l !== null);
      if (labels.length === 0) continue;
      const cond = labels.map((l): A.Expr => new A.Binary("==", subject, l, line)).reduce((a, b) => new A.Binary("||", a, b, line));
      chain = new A.If(cond, effective(g), chain === null ? otherwise : [chain], line);
    }
    return chain ?? new A.If(new A.Number(1, line), otherwise ?? [], null, line);
  }

  private bodyOrStatement(): A.Stmt[] {
    return this.peek.is("{") ? this.block() : this.statement();
  }

  private statement(): A.Stmt[] {
    const line = this.peek.line;
    if (this.accept(";")) return [];
    if (this.peek.is("{")) return this.block();
    if (this.peek.is("[")) {
      // [unroll], [branch]
      this.skipBalanced("[", "]");
      return this.statement();
    }
    if (this.accept("return")) {
      const value = this.peek.is(";") ? null : this.expression();
      this.expect(";");
      return [new A.Return(value, line)];
    }
    // C++: try { … } catch (…) { … } – the try block (a simulated program does not throw).
    if (this.lenient && this.accept("try")) {
      const tried = this.block();
      while (this.accept("catch")) {
        this.skipBalanced("(", ")");
        if (this.peek.is("{")) this.skipBalanced("{", "}");
      }
      return tried;
    }
    if (this.accept("break")) {
      this.expect(";");
      return [new A.Break(line)];
    }
    if (this.accept("continue")) {
      this.expect(";");
      return [new A.Continue(line)];
    }
    if (this.accept("switch")) return [this.switchStatement(line)];
    if (this.accept("discard") || this.accept("clip_discard")) {
      this.expect(";");
      return [new A.Discard(line)];
    }
    if (this.accept("if")) {
      this.expect("(");
      const cond = this.expression();
      this.expect(")");
      const then = this.bodyOrStatement();
      const otherwise = this.accept("else") ? this.bodyOrStatement() : null;
      return [new A.If(cond, then, otherwise, line)];
    }
    if (this.lenient && this.peek.is("for")) {
      const rangeFor = this.rangeFor();
      if (rangeFor !== null) return [rangeFor];
    }
    // while (cond) body: a for loop without init and step (learnopengl's steep parallax mapping loops this way).
    if (this.accept("while")) {
      this.expect("(");
      const whileCond = this.expression();
      this.expect(")");
      return [new A.For(null, whileCond, null, this.bodyOrStatement(), line)];
    }
    // do body while (cond); : the body once, then as a while loop.
    if (this.accept("do")) {
      const body = this.bodyOrStatement();
      this.expect("while");
      this.expect("(");
      const doCond = this.expression();
      this.expect(")");
      this.expect(";");
      return [new A.If(new A.Number(1, line), body, null, line), new A.For(null, doCond, null, body, line)];
    }
    if (this.accept("for")) {
      this.expect("(");
      let init: A.Stmt | null = null;
      if (!this.accept(";")) {
        init = this.simpleStatement()[0] ?? null;
        this.expect(";");
      }
      const cond = this.peek.is(";") ? null : this.expression();
      this.expect(";");
      const step = this.peek.is(")") ? null : (this.simpleStatement()[0] ?? null);
      this.expect(")");
      return [new A.For(init, cond, step, this.bodyOrStatement(), line)];
    }
    const list = this.simpleStatement();
    this.expect(";");
    return list;
  }

  /** C++ range-based for: for (const Vertex&amp; vertex : vertices) …; null (and nothing read) when it is not one. */
  private rangeFor(): A.Stmt | null {
    const start = this.pos, line = this.peek.line;
    this.next();
    if (!this.accept("(")) {
      this.pos = start;
      return null;
    }
    // Find a ':' at depth 0 before the closing ')'.
    let depth = 0, j = this.pos, colon = -1;
    while (this.peekAt(j - this.pos).kind !== ShaderTokenKind.End) {
      const t = this.peekAt(j - this.pos);
      if (t.is("(")) depth++;
      else if (t.is(")")) {
        if (depth === 0) break;
        depth--;
      } else if (t.is(";")) break;
      else if (t.is(":") && depth === 0) {
        colon = j;
        break;
      }
      j++;
    }
    if (colon < 0) {
      this.pos = start;
      return null;
    }
    // The loop variable: the last identifier before ':'.
    let id: string | null = null;
    while (this.pos < colon) {
      const t = this.next();
      if (t.kind === ShaderTokenKind.Identifier) id = t.text;
    }
    this.expect(":");
    const container = this.expression();
    this.expect(")");
    const body = this.bodyOrStatement();
    return id === null ? null : new A.ForEach(id, container, body, line);
  }

  private looksLikeDeclaration(): boolean {
    let i = 0;
    while (this.peekAt(i).kind === ShaderTokenKind.Identifier && Qualifiers.has(this.peekAt(i).text)) i++;
    if (this.peekAt(i).kind !== ShaderTokenKind.Identifier) return false;
    // C++: "unsigned rez = 20;" – unsigned (signed) alone is the type.
    if (i > 0 && this.bareSignedType(i - 1)) return true;
    // type<...> name
    if (this.peekAt(i + 1).is("<")) {
      let depth = 0, j = i + 1;
      do {
        if (this.peekAt(j).is("<")) depth++;
        else if (this.peekAt(j).is(">")) depth--;
        j++;
      } while (depth > 0 && this.peekAt(j).kind !== ShaderTokenKind.End);
      while (this.peekAt(j).is("::") && this.peekAt(j + 1).kind === ShaderTokenKind.Identifier) j += 2;
      return this.peekAt(j).kind === ShaderTokenKind.Identifier || (this.lenient && this.pointerDeclarator(j));
    }
    let k = i + 1;
    while (this.peekAt(k).is("::") && this.peekAt(k + 1).kind === ShaderTokenKind.Identifier) k += 2;
    return this.peekAt(k).kind === ShaderTokenKind.Identifier || (this.lenient && this.pointerDeclarator(k));
  }

  /** C++: unsigned / signed at `i` followed by a name and = ; , [ or ) (unsigned rez = 20;). */
  private bareSignedType(i: number): boolean {
    if (!this.lenient || !(this.peekAt(i).is("unsigned") || this.peekAt(i).is("signed")) || this.peekAt(i + 1).kind !== ShaderTokenKind.Identifier) return false;
    const after = this.peekAt(i + 2);
    return after.is("=") || after.is(";") || after.is(",") || after.is("[") || after.is(")") || after.kind === ShaderTokenKind.End;
  }

  /** C++: "* name =", "** name;", "&amp; name =" after a type – a pointer or reference declaration. */
  private pointerDeclarator(j: number): boolean {
    let stars = 0;
    while (this.peekAt(j).is("*") || this.peekAt(j).is("&") || this.peekAt(j).is("**")) {
      j++;
      stars++;
    }
    if (stars === 0 || this.peekAt(j).kind !== ShaderTokenKind.Identifier) return false;
    const after = this.peekAt(j + 1);
    return after.is("=") || after.is(";") || after.is(",") || after.is("[");
  }

  /** A declaration, an assignment or an expression – without the ';'. */
  private simpleStatement(): A.Stmt[] {
    const line = this.peek.line;
    if (this.looksLikeDeclaration()) {
      let isStatic = false;
      let signedType: string | null = null;
      while (this.peek.kind === ShaderTokenKind.Identifier && Qualifiers.has(this.peek.text)) {
        if (this.bareSignedType(0)) signedType = this.peek.text;
        isStatic = this.next().text === "static" || isStatic;
      }
      let type = signedType === "unsigned" ? "uint" : signedType !== null ? "int" : this.typeName();
      if (signedType !== null) this.templateArgs = [];
      // std::array<T, N>: an array of N T.
      let sizeExpr: A.Expr | null = null;
      const targs = this.templateArgs;
      if (this.lenient && type === "array" && targs.length === 2 && targs[0]!.length >= 1) {
        type = targs[0]![targs[0]!.length - 1]!.text;
        const sizeTokens = targs[1]!;
        sizeExpr = sizeTokens.length === 1 && sizeTokens[0]!.kind === ShaderTokenKind.Number
          ? new A.Number(parseDouble(sizeTokens[0]!.text), line)
          : sizeTokens.length === 1 ? new A.Name(sizeTokens[0]!.text, line) : null;
      }
      // std::vector<T> name = { … }: an array of T (its elements filled like a C++ aggregate).
      let vectorOf = false;
      if (this.lenient && type === "vector" && targs.length === 1 && targs[0]!.length >= 1) {
        type = targs[0]![targs[0]!.length - 1]!.text;
        vectorOf = true;
      }
      const list: A.Stmt[] = [];
      let vectorSize: A.Expr | null = null, vectorFill: A.Expr | null = null;
      do {
        let reference = false, pointer = false;
        while (this.lenient && (this.peek.is("*") || this.peek.is("&") || this.peek.is("**"))) {
          const star = this.next();
          reference ||= star.is("&");
          pointer ||= !star.is("&");
        }
        const id = this.identifier();
        const size = this.arraySuffix();
        let value: A.Expr | null = null;
        if (this.accept("=")) value = this.initializer();
        else if (this.peek.is("{")) value = this.initializer(); // C++: Type name{ … }
        else if (vectorOf && this.peek.is("(")) {
          // std::vector<T> name(n): n default Ts; name(n, value): n copies of the value.
          const sizeArgs = this.callArgs();
          vectorSize = sizeArgs[0] ?? null;
          vectorFill = sizeArgs.length >= 2 ? sizeArgs[1]! : null;
        } else if (this.peek.is("(")) value = new A.Call(type, this.callArgs(), line); // C++: Type name(args)
        // An empty std::vector<T>: an array with no elements yet (push_back adds them).
        const declSize = sizeExpr ?? vectorSize ?? (vectorOf && value === null ? new A.Number(0, line) : null);
        vectorSize = null;
        list.push(new A.Declare(type, id, value, line, size !== 0 || declSize !== null || (vectorOf && value instanceof A.InitList), Math.max(0, size), declSize, {
          static: isStatic && this.lenient,
          reference: reference && this.lenient && value !== null && !(value instanceof A.InitList),
          pointer: pointer && this.lenient,
          fill: vectorFill,
        }));
        vectorFill = null;
      } while (this.accept(","));
      return list;
    }
    const target = this.expression();
    for (const op of ["=", "+=", "-=", "*=", "/="]) if (this.accept(op)) return [new A.Assign(target, op, this.initializer(), line)];
    return [new A.ExprStmt(target, line)];
  }

  /** An expression or a { … } initializer list. */
  private initializer(): A.Expr {
    const line = this.peek.line;
    if (!this.accept("{")) return this.expression();
    const items: A.Expr[] = [];
    while (!this.accept("}")) {
      items.push(this.initializer());
      if (!this.accept(",")) {
        this.expect("}");
        break;
      }
    }
    return new A.InitList(items, line);
  }

  // ---------- expressions (ShaderParser.Expressions.cs) ----------

  private expression(): A.Expr {
    const cond = this.binary(0);
    if (!this.accept("?")) return cond;
    const then = this.expression();
    this.expect(":");
    return new A.Conditional(cond, then, this.expression(), cond.line);
  }

  private binary(level: number): A.Expr {
    if (level === Levels.length) return this.unaryExpr();
    let left = this.binary(level + 1);
    const ops = Levels[level]!;
    if (ops[0] === "<<") {
      while (this.peek.kind === ShaderTokenKind.Symbol && (this.peek.text === "<" || this.peek.text === ">")
        && this.peekAt(1).kind === ShaderTokenKind.Symbol && this.peekAt(1).text === this.peek.text) {
        const first = this.next();
        this.next();
        left = new A.Binary(first.text + first.text, left, this.binary(level + 1), first.line);
      }
      return left;
    }
    // a < b, but not the first half of a shift.
    while (this.peek.kind === ShaderTokenKind.Symbol && ops.includes(this.peek.text)
      && !((this.peek.text === "<" || this.peek.text === ">") && this.peekAt(1).kind === ShaderTokenKind.Symbol && this.peekAt(1).text === this.peek.text)) {
      const op = this.next();
      left = new A.Binary(op.text, left, this.binary(level + 1), op.line);
    }
    return left;
  }

  private unaryExpr(): A.Expr {
    const line = this.peek.line;
    if (this.peek.kind === ShaderTokenKind.Symbol && ["-", "+", "!", "~", "++", "--", "&", "*"].includes(this.peek.text)) {
      const op = this.next().text;
      const operand = this.unaryExpr();
      // &x and *p (C++): the value itself is what matters to the simulator.
      // C++: &a[0] points at the whole array (memcpy(data, &a[0], …) copies all of it); other &x / *p are x / p.
      if (op === "&" && operand instanceof A.IndexOf && operand.at instanceof A.Number && operand.at.value === 0) return operand.target;
      return op === "+" || op === "&" || op === "*" ? operand : new A.Unary(op, operand, line);
    }
    // (unsigned char)y, (unsigned int)x: the second word is the type.
    if (this.peek.is("(") && this.peekAt(1).is("unsigned") && this.peekAt(2).kind === ShaderTokenKind.Identifier
      && (this.peekAt(3).is(")") || (this.peekAt(3).is("*") && this.peekAt(4).is(")")))) {
      this.next();
      this.next();
      this.next();
      const pointer = this.accept("*");
      this.expect(")");
      const operand = this.unaryExpr();
      if (pointer) return operand;
      return new A.Call("int", [operand], line);
    }
    // C-style casts: (float)x, (void*)0, (GLfloat)x – and HLSL's (float3x3)m, (float3)v, which convert.
    if (this.peek.is("(") && this.peekAt(1).kind === ShaderTokenKind.Identifier && (this.peekAt(2).is(")") || (this.peekAt(2).is("*") && this.peekAt(3).is(")")))
      && (isCastType(this.peekAt(1).text) || matrixSize(this.peekAt(1).text) > 0 || componentCount(this.peekAt(1).text) > 1)) {
      this.next();
      const type = this.next().text;
      const pointer = this.accept("*");
      this.expect(")");
      const operand = this.unaryExpr();
      // A pointer cast ((char*) mapped + offset, (void*)0): the address itself.
      if (pointer) return operand;
      // (uint64_t) handle: a 64-bit integer that holds an object handle (vkSetDebugUtilsObjectNameEXT's
      // objectHandle) – the value itself, so a handle stays the handle.
      if (["uint64_t", "int64_t", "uintptr_t", "intptr_t", "UINT64", "UINT_PTR"].includes(type)) return operand;
      const scalar = scalarCast(type);
      if (scalar !== null) return new A.Call(scalar, [operand], line);
      return matrixSize(type) > 0 || componentCount(type) > 1 ? new A.Call(type, [operand], line) : operand;
    }
    // C++: a cast to a type of the program ((Direction)best_match, (GameState)1): the value itself. "(name)" then a
    // name or a number cannot be anything else.
    if (this.lenient && this.peek.is("(") && this.peekAt(1).kind === ShaderTokenKind.Identifier && this.peekAt(2).is(")")
      && (this.peekAt(3).kind === ShaderTokenKind.Identifier || this.peekAt(3).kind === ShaderTokenKind.Number || (this.peekAt(3).is("(") && isUpper(this.peekAt(1).text[0])))) {
      this.next();
      this.next();
      this.next();
      return this.unaryExpr();
    }
    return this.postfix(this.primary());
  }

  /** &lt;types&gt;( ahead: a template's arguments (names, ::, commas, * and &amp;), then a call. */
  private templateCallAhead(): boolean {
    let depth = 0;
    for (let i = 0; i < 24; i++) {
      const t = this.peekAt(i);
      if (t.is("<")) depth++;
      else if (t.is(">")) {
        if (--depth === 0) return this.peekAt(i + 1).is("(");
      } else if (!(t.kind === ShaderTokenKind.Identifier || t.is("::") || t.is(",") || t.is("*") || t.is("&") || t.kind === ShaderTokenKind.Number)) return false;
    }
    return false;
  }

  private postfix(e: A.Expr): A.Expr {
    while (true) {
      const line = this.peek.line;
      if (this.accept(".") || this.accept("->")) {
        const field = this.identifier();
        if (this.peek.is("(")) e = new A.Call("." + field, [e, ...this.callArgs()], line);
        else e = new A.Member(e, field, line);
      } else if (this.accept("[")) {
        const at = this.expression();
        this.expect("]");
        e = new A.IndexOf(e, at, line);
      } else if (this.peek.is("++") || this.peek.is("--")) {
        const op = this.next().text;
        e = new A.Unary("post" + op, e, line);
      } else return e;
    }
  }

  private callArgs(): A.Expr[] {
    this.expect("(");
    const args: A.Expr[] = [];
    if (this.accept(")")) return args;
    do args.push(this.initializer());
    while (this.accept(","));
    this.expect(")");
    return args;
  }

  private primary(): A.Expr {
    const t = this.peek;
    switch (t.kind) {
      case ShaderTokenKind.Number:
        this.next();
        return new A.Number(parseDouble(t.text), t.line, [...t.text].every((c) => isDigit(c)));
      case ShaderTokenKind.String: {
        this.next();
        // Adjacent string literals are joined, as in C++.
        let text = t.text;
        while (this.peek.kind === ShaderTokenKind.String) text += this.next().text;
        return new A.Call(ShaderParser.StringLiteral, [new A.Name(text, t.line)], t.line);
      }
      case ShaderTokenKind.Identifier: {
        this.next();
        // static_cast<float>(x) and friends.
        if ((t.text === "static_cast" || t.text === "reinterpret_cast" || t.text === "const_cast") && this.peek.is("<")) {
          let castType: string[] = [];
          this.expect("<");
          while (!this.accept(">")) castType.push(this.next().text);
          this.expect("(");
          const inner = this.expression();
          this.expect(")");
          castType = castType.filter((w) => w !== "const" && w !== "unsigned" && w !== "signed");
          const to = castType.length === 0 ? "int" : castType.length === 1 ? castType[0]! : "";
          const scalar = t.text === "static_cast" ? scalarCast(to) : null;
          return scalar !== null ? new A.Call(scalar, [inner], t.line) : inner;
        }
        if (t.text === "true" || t.text === "false") return new A.Number(t.text === "true" ? 1 : 0, t.line);
        // sizeof(unsigned int), sizeof(unsigned char): a type of two words.
        if (t.text === "sizeof" && this.peek.is("(") && (this.peekAt(1).is("unsigned") || this.peekAt(1).is("signed"))) {
          this.next();
          this.next();
          const word = this.peek.kind === ShaderTokenKind.Identifier && !this.peek.is(")") ? this.next().text : "int";
          this.expect(")");
          return new A.Call("sizeof", [new A.Name(word === "char" ? "uint8_t" : word === "short" ? "uint16_t" : word === "long" ? "uint32_t" : "unsigned", t.line)], t.line);
        }
        // C++: std::numeric_limits<float>::max() and friends – the limits of a number type.
        if (this.lenient && t.text === "numeric_limits" && this.peek.is("<")) {
          this.expect("<");
          const limitType: string[] = [];
          while (!this.accept(">")) limitType.push(this.next().text);
          this.expect("::");
          const which = this.identifier();
          if (this.accept("(")) this.expect(")");
          return numericLimit(limitType.join(" "), which, t.line);
        }
        // C++: new glm::mat4[amount] – an array of zeroed values.
        if (this.lenient && t.text === "new" && this.peek.kind === ShaderTokenKind.Identifier) {
          const type = this.typeName();
          if (this.accept("[")) {
            const count = this.expression();
            this.expect("]");
            return new A.Call("__newarray", [new A.Name(type, t.line), count], t.line);
          }
          return this.peek.is("(") ? new A.Call(type, this.callArgs(), t.line) : new A.Call(type, [], t.line);
        }
        // vec2[](…) – an array constructor; float3x3(…) and friends are plain calls.
        if (this.peek.is("[") && this.peekAt(1).is("]") && this.peekAt(2).is("(")) {
          this.next();
          this.next();
          return new A.Call(t.text, this.callArgs(), t.line, true);
        }
        // C++: a template's arguments before a call – std::pair<char, Character>(c, ch), std::make_pair<…>(…).
        if (this.lenient && this.peek.is("<") && this.templateCallAhead()) {
          let depth = 0;
          const inside: ShaderToken[] = [];
          do {
            if (this.peek.is("<")) depth++;
            else if (this.peek.is(">")) depth--;
            const token = this.next();
            if (depth > 0 && !(depth === 1 && token.is("<"))) inside.push(token);
          } while (depth > 0);
          // std::get<1>(collision): the element of a tuple (or pair) by its index.
          if (t.text === "get" && inside.length === 1 && inside[0]!.kind === ShaderTokenKind.Number && this.peek.is("("))
            return new A.Call(ShaderParser.TupleGet, [new A.Number(parseDouble(inside[0]!.text), t.line), ...this.callArgs()], t.line);
        }
        if (this.peek.is("(")) return new A.Call(t.text, this.callArgs(), t.line);
        // C++ brace construction: glm::vec4{1, 0, 0, 1}, XMFLOAT4{…}
        if (this.peek.is("{") && isLetter(t.text[0]) && looksLikeType(t.text)) {
          const init = this.initializer() as A.InitList;
          return new A.Call(t.text, init.items, t.line);
        }
        this.names.add(t.text);
        return new A.Name(t.text, t.line);
      }
      case ShaderTokenKind.Symbol:
        if (t.is("(")) {
          this.next();
          let e = this.expression();
          // C++: an assignment as a value – while ((errorCode = glGetError()) != GL_NO_ERROR).
          if (this.lenient && this.peek.is("=")) {
            this.next();
            e = new A.Call("__assign", [e, this.expression()], t.line);
          }
          this.expect(")");
          return e;
        }
        if (t.is("{")) return this.initializer();
        if (this.lenient && t.is("[")) return this.lambdaExpr();
        break;
    }
    throw new ShaderSyntaxException(t.kind === ShaderTokenKind.End ? "expected an expression at end of input" : `expected an expression before '${t.text}'`, t.line);
  }

  /** C++: [captures](Type a, Type b) -> R { body } – captures and types are not needed here. */
  private lambdaExpr(): A.Expr {
    const line = this.next().line;
    for (let depth = 1; depth > 0 && this.peek.kind !== ShaderTokenKind.End;) {
      const c = this.next();
      if (c.is("[")) depth++;
      else if (c.is("]")) depth--;
    }
    const parameters: string[] = [];
    if (this.accept("(")) {
      let last: string | null = null;
      for (let depth = 1; this.peek.kind !== ShaderTokenKind.End;) {
        const p = this.next();
        if (p.is("(")) depth++;
        else if (p.is(")") && --depth === 0) break;
        if (depth === 1 && p.is(",")) {
          if (last !== null) parameters.push(last);
          last = null;
        } else if (p.kind === ShaderTokenKind.Identifier) last = p.text;
      }
      if (last !== null && last !== "void") parameters.push(last);
    }
    while (!this.peek.is("{") && this.peek.kind !== ShaderTokenKind.End) this.next(); // mutable, -> R
    return new A.Lambda(parameters, this.block(), line);
  }
}

function isCastType(t: string): boolean {
  return ["float", "double", "int", "uint", "unsigned", "void", "GLfloat", "GLint", "GLuint", "GLsizei", "uint32_t", "int32_t", "size_t", "UINT", "FLOAT", "half", "char",
    "uint64_t", "int64_t", "uintptr_t", "intptr_t", "UINT64", "UINT_PTR", "uint16_t", "uint8_t"].includes(t);
}

/** The conversion a cast to a number type makes: (float)i is float(i), (int)x is int(x), which cuts the fraction off. */
function scalarCast(type: string): string | null {
  return type === "float" || type === "double" || type === "GLfloat" || type === "FLOAT" || type === "half" ? "float"
    : ShaderValue.isIntType(type) ? "int" : null;
}

/** std::numeric_limits&lt;type&gt;::max(), lowest(), min(), epsilon(), infinity() as a number. */
function numericLimit(type: string, which: string, line: number): A.Number {
  const isFloat = type === "float" || type === "GLfloat", isDouble = type === "double" || type === "long double";
  if (isFloat || isDouble) {
    const max = isFloat ? FloatMax : Number.MAX_VALUE;
    const value = which === "max" ? max
      : which === "lowest" ? -max
      : which === "min" ? (isFloat ? 1.17549435e-38 : 2.2250738585072014e-308)
      : which === "epsilon" ? (isFloat ? 1.1920929e-7 : 2.220446049250313e-16)
      : which === "infinity" ? Number.POSITIVE_INFINITY
      : which === "quiet_NaN" || which === "signaling_NaN" ? Number.NaN
      : 0;
    return new A.Number(value, line);
  }
  let lo: number, hi: number;
  switch (type) {
    case "unsigned int": case "unsigned": case "uint32_t": case "GLuint": case "UINT":
      [lo, hi] = [0, 4294967295];
      break;
    case "unsigned short": case "uint16_t":
      [lo, hi] = [0, 65535];
      break;
    case "unsigned char": case "uint8_t":
      [lo, hi] = [0, 255];
      break;
    case "short": case "int16_t":
      [lo, hi] = [-32768, 32767];
      break;
    case "char": case "int8_t":
      [lo, hi] = [-128, 127];
      break;
    case "long long": case "int64_t":
      [lo, hi] = [-9223372036854775808, 9223372036854775807];
      break;
    case "size_t": case "uint64_t": case "unsigned long long":
      [lo, hi] = [0, 18446744073709551615];
      break;
    default:
      [lo, hi] = [-2147483648, 2147483647];
  }
  return new A.Number(which === "max" ? hi : which === "min" || which === "lowest" ? lo : 0, line, true);
}

function looksLikeType(id: string): boolean {
  return id.startsWith("vec") || id.startsWith("XMFLOAT") || id.startsWith("float") || isUpper(id[0]);
}
