// The syntax tree of the shader subset the simulator runs (and of C++ value expressions). The C# records are classes
// here with a `kind` tag (the runner switches on it); import the module as `* as ShaderAst` to write ShaderAst.Number.
import type { ShaderValue } from "./ShaderValue.js";

export abstract class Expr {
  abstract readonly kind: ExprKind;
  constructor(readonly line: number) {}
}

export type ExprKind = "Number" | "Name" | "Member" | "IndexOf" | "Call" | "Lambda" | "Unary" | "Binary" | "Conditional" | "InitList";

/** A literal; `integer` for one written without a fraction, exponent or float suffix (2, 16u, 0x55). */
export class Number extends Expr {
  readonly kind = "Number" as const;
  /** The literal as a value of a running shader (made the first time it is evaluated). */
  cached: ShaderValue | null = null;

  constructor(readonly value: number, line: number, readonly integer: boolean = false) {
    super(line);
  }
}

export class Name extends Expr {
  readonly kind = "Name" as const;

  constructor(readonly id: string, line: number) {
    super(line);
  }
}

/** a.b – a struct member or a swizzle (.xyz, .rgb). */
export class Member extends Expr {
  readonly kind = "Member" as const;

  constructor(readonly target: Expr, readonly field: string, line: number) {
    super(line);
  }
}

export class IndexOf extends Expr {
  readonly kind = "IndexOf" as const;

  constructor(readonly target: Expr, readonly at: Expr, line: number) {
    super(line);
  }
}

/** f(args) – a function, a constructor (vec4, float3) or an array constructor (vec2[]). */
export class Call extends Expr {
  readonly kind = "Call" as const;

  constructor(readonly function_: string, readonly args: readonly Expr[], line: number, readonly arrayConstructor: boolean = false) {
    super(line);
  }
}

/** C++: a lambda, [](const PowerUp&amp; p) { return p.Destroyed; } – its parameters' names and its body. */
export class Lambda extends Expr {
  readonly kind = "Lambda" as const;

  constructor(readonly params: readonly string[], readonly body: readonly Stmt[], line: number) {
    super(line);
  }
}

export class Unary extends Expr {
  readonly kind = "Unary" as const;

  constructor(readonly op: string, readonly operand: Expr, line: number) {
    super(line);
  }
}

export class Binary extends Expr {
  readonly kind = "Binary" as const;

  constructor(readonly op: string, readonly left: Expr, readonly right: Expr, line: number) {
    super(line);
  }
}

export class Conditional extends Expr {
  readonly kind = "Conditional" as const;

  constructor(readonly condition: Expr, readonly then: Expr, readonly else_: Expr, line: number) {
    super(line);
  }
}

/** { a, b, c } – an initializer list (C++ and HLSL). */
export class InitList extends Expr {
  readonly kind = "InitList" as const;

  constructor(readonly items: readonly Expr[], line: number) {
    super(line);
  }
}

export abstract class Stmt {
  abstract readonly kind: StmtKind;
  constructor(readonly line: number) {}
}

export type StmtKind = "Declare" | "Assign" | "Return" | "If" | "For" | "Discard" | "Break" | "Continue" | "ForEach" | "ExprStmt";

/** The init-only properties of a Declare. */
export interface DeclareInit {
  static?: boolean;
  reference?: boolean;
  pointer?: boolean;
  fill?: Expr | null;
}

/** T name[N] = value; (value may be null.) */
export class Declare extends Stmt {
  readonly kind = "Declare" as const;
  /** C++: a static local – initialised once, it keeps its value between calls. */
  readonly static: boolean;
  /** C++: a reference (Particle&amp; p = particles[i]) – another name for the value, not a copy. */
  readonly reference: boolean;
  /**
   * C++: a pointer (Entity* last = &amp;root) – it points at the object (no copy), and assigning another address to it
   * points it elsewhere instead of changing the object.
   */
  readonly pointer: boolean;
  /** C++: std::vector&lt;T&gt; name(n, value) – the value every element starts with. */
  readonly fill: Expr | null;

  constructor(
    readonly type: string,
    readonly id: string,
    readonly value: Expr | null,
    line: number,
    readonly isArray: boolean = false,
    readonly arraySize: number = 0,
    readonly sizeExpr: Expr | null = null,
    init: DeclareInit = {},
  ) {
    super(line);
    this.static = init.static ?? false;
    this.reference = init.reference ?? false;
    this.pointer = init.pointer ?? false;
    this.fill = init.fill ?? null;
  }
}

/** target op value; with op "=", "+=", "-=", "*=" or "/=". */
export class Assign extends Stmt {
  readonly kind = "Assign" as const;

  constructor(readonly target: Expr, readonly op: string, readonly value: Expr, line: number) {
    super(line);
  }
}

export class Return extends Stmt {
  readonly kind = "Return" as const;

  constructor(readonly value: Expr | null, line: number) {
    super(line);
  }
}

export class If extends Stmt {
  readonly kind = "If" as const;

  constructor(readonly condition: Expr, readonly then: readonly Stmt[], readonly else_: readonly Stmt[] | null, line: number) {
    super(line);
  }
}

/** for (init; condition; step) body – only loops with a small, known number of steps run. */
export class For extends Stmt {
  readonly kind = "For" as const;

  constructor(readonly init: Stmt | null, readonly condition: Expr | null, readonly step: Stmt | null, readonly body: readonly Stmt[], line: number) {
    super(line);
  }
}

export class Discard extends Stmt {
  readonly kind = "Discard" as const;
}

/** break; – leaves the innermost loop. */
export class Break extends Stmt {
  readonly kind = "Break" as const;
}

/** continue; – the innermost loop's next iteration. */
export class Continue extends Stmt {
  readonly kind = "Continue" as const;
}

/** C++: for (const T&amp; name : container) body. */
export class ForEach extends Stmt {
  readonly kind = "ForEach" as const;

  constructor(readonly id: string, readonly container: Expr, readonly body: readonly Stmt[], line: number) {
    super(line);
  }
}

/** An expression used as a statement (a call, i++). */
export class ExprStmt extends Stmt {
  readonly kind = "ExprStmt" as const;

  constructor(readonly value: Expr, line: number) {
    super(line);
  }
}

/** A function parameter: type, name, qualifiers (in/out), HLSL semantic (POSITION, SV_TARGET …). */
export class Param {
  constructor(readonly type: string, readonly id: string, readonly semantic: string | null, readonly out: boolean) {}
}

export class Function {
  constructor(
    readonly returnType: string,
    readonly id: string,
    readonly params: readonly Param[],
    readonly semantic: string | null,
    readonly body: readonly Stmt[],
    readonly line: number,
  ) {}
}

/** A struct member (HLSL members can have a semantic). */
export class Field {
  constructor(
    readonly type: string,
    readonly id: string,
    readonly semantic: string | null,
    readonly arraySize: number,
    /** C++: the member's default initialiser (unsigned int Width = SCREEN_WIDTH;), or null. */
    readonly default_: Expr | null = null,
  ) {}
}

export class Struct {
  constructor(readonly id: string, readonly fields: readonly Field[]) {}
}

/**
 * A global: "in"/"out"/"uniform"/"const"/plain, with GLSL layout(location = n) / layout(push_constant) /
 * layout(binding = n), or an HLSL cbuffer/Texture2D/SamplerState with register(..). A uniform or cbuffer block has
 * `block` fields; `id` is then the instance name (or empty: the fields are globals). `binding`: GLSL
 * layout(binding = n), or the number of an HLSL register (t0 → 0, s1 → 1, b0 → 0).
 */
export class Global {
  constructor(
    readonly storage: string,
    readonly type: string,
    readonly id: string,
    readonly location: number | null,
    readonly pushConstant: boolean,
    readonly block: readonly Field[] | null,
    readonly value: Expr | null,
    readonly arraySize: number,
    readonly line: number,
    readonly binding: number | null = null,
  ) {}
}
