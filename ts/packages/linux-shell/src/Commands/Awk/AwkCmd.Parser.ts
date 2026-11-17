// Port of Commands/Awk/AwkCmd.Parser.cs – awk: the recursive descent parser that builds the syntax tree.

import type { MsgArgs } from "../../ShellI18n.js";
import { tokenize, type Tok, unsupportedBuiltins } from "./AwkCmd.Tokenizer.js";
import { AwkSyntaxError } from "./AwkSyntaxError.js";
import { AwkUnsupported } from "./AwkUnsupported.js";
import type { Expr } from "./Expr.js";
import type { Rule } from "./Rule.js";
import type { Stmt } from "./Stmt.js";

const assignOps = new Set(["=", "+=", "-=", "*=", "/=", "%=", "^="]);

export function isLvalue(e: Expr): boolean {
  return e.kind === "Var" || e.kind === "Field" || e.kind === "Idx";
}

class AwkParser {
  private readonly toks: Tok[];
  private p = 0;
  /** Inside the arguments to print: ">" means redirection, not comparison. */
  private noGt = false;

  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  private get tok(): Tok {
    return this.toks[this.p]!;
  }

  private is(v: string, t = "op"): boolean {
    return this.tok.t === t && this.tok.v === v;
  }

  private next(): Tok {
    return this.toks[this.p++]!;
  }

  private fail(tok: Tok | null = null): AwkSyntaxError {
    const t = tok ?? this.tok;
    if (t.t === "eof" || t.t === "nl") return new AwkSyntaxError("unexpected newline or end of string", t.pos);
    return new AwkSyntaxError("syntax error", t.pos);
  }

  private unsupportedWhat(what: AwkUnsupported, tok: Tok | null = null): AwkSyntaxError {
    return new AwkSyntaxError("syntax error", (tok ?? this.tok).pos, what);
  }

  private unsupported(key: string, args: MsgArgs = {}): AwkSyntaxError {
    return this.unsupportedWhat(AwkUnsupported.feature(key, args));
  }

  private expect(v: string): Tok {
    if (!this.is(v)) throw this.fail();
    return this.next();
  }

  private skipNl(): void {
    while (this.tok.t === "nl") this.p++;
  }

  private skipTerms(): void {
    while (this.tok.t === "nl" || this.is(";")) this.p++;
  }

  program(): Rule[] {
    const rules: Rule[] = [];
    this.skipTerms();
    while (this.tok.t !== "eof") {
      rules.push(this.parseRule());
      this.skipTerms();
    }
    return rules;
  }

  private parseRule(): Rule {
    if (this.is("BEGIN", "kw") || this.is("END", "kw")) {
      const pat = this.next().v as "BEGIN" | "END";
      if (!this.is("{")) throw this.fail();
      return { pattern: pat, action: this.parseBlock() };
    }
    if (this.is("function", "kw") || this.is("func", "kw")) throw this.unsupported("awk.featureFunction");
    let pattern: Expr | null = null;
    if (!this.is("{")) {
      pattern = this.parseExpr();
      if (this.is(",")) throw this.unsupported("awk.featureRangePattern");
    }
    if (this.is("{")) return { pattern, action: this.parseBlock() };
    if (this.tok.t !== "nl" && !this.is(";") && this.tok.t !== "eof") throw this.fail();
    return { pattern, action: null };
  }

  private parseBlock(): Stmt[] {
    this.expect("{");
    const body: Stmt[] = [];
    for (;;) {
      this.skipTerms();
      if (this.is("}")) break;
      if (this.tok.t === "eof") throw this.fail();
      body.push(this.parseStmt());
    }
    this.next();
    return body;
  }

  /** After a simple statement: ; or newline, or } / end which is not consumed. */
  private endSimple(): void {
    if (this.is(";") || this.tok.t === "nl") {
      this.next();
      return;
    }
    if (this.is("}") || this.tok.t === "eof") return;
    throw this.fail();
  }

  private body(): Stmt {
    this.skipNl();
    if (this.is(";")) {
      this.next();
      return { kind: "Block", body: [] };
    }
    return this.parseStmt();
  }

  private parseStmt(): Stmt {
    const t = this.tok;
    if (this.is("{")) return { kind: "Block", body: this.parseBlock() };
    if (t.t === "kw") {
      switch (t.v) {
        case "if": {
          this.next();
          this.expect("(");
          const c = this.parseExpr();
          this.expect(")");
          const then = this.body();
          const save = this.p;
          this.skipTerms();
          if (this.is("else", "kw")) {
            this.next();
            return { kind: "If", c, then, else: this.body() };
          }
          this.p = save;
          return { kind: "If", c, then, else: null };
        }
        case "while": {
          this.next();
          this.expect("(");
          const c = this.parseExpr();
          this.expect(")");
          return { kind: "While", c, body: this.body() };
        }
        case "do": {
          this.next();
          const body = this.body();
          this.skipTerms();
          if (!this.is("while", "kw")) throw this.fail();
          this.next();
          this.expect("(");
          const c = this.parseExpr();
          this.expect(")");
          this.endSimple();
          return { kind: "Do", c, body };
        }
        case "for": {
          this.next();
          this.expect("(");
          const toks = this.toks;
          const p = this.p;
          const t1 = toks[p]!;
          const t2 = p + 1 < toks.length ? toks[p + 1]! : null;
          const t3 = p + 2 < toks.length ? toks[p + 2]! : null;
          const t4 = p + 3 < toks.length ? toks[p + 3]! : null;
          if (t1.t === "name" && t2?.t === "kw" && t2.v === "in" && t3?.t === "name" && t4?.t === "op" && t4.v === ")") {
            this.p += 4;
            return { kind: "ForIn", v: t1.v, arr: t3.v, body: this.body() };
          }
          const init = this.is(";") ? null : this.simple();
          this.expect(";");
          this.skipNl();
          const c = this.is(";") ? null : this.parseExpr();
          this.expect(";");
          this.skipNl();
          const step = this.is(")") ? null : this.simple();
          this.expect(")");
          return { kind: "For", init, c, step, body: this.body() };
        }
        case "next":
        case "break":
        case "continue":
          this.next();
          this.endSimple();
          return { kind: "Jump", k: t.v };
        case "exit": {
          this.next();
          const e = this.is(";") || this.is("}") || this.tok.t === "nl" || this.tok.t === "eof" ? null : this.parseExpr();
          this.endSimple();
          return { kind: "Exit", e };
        }
        case "delete": {
          this.next();
          if (this.tok.t !== "name") throw this.fail();
          const arr = this.next().v;
          let subs: Expr[] | null = null;
          if (this.is("[")) subs = this.subscripts();
          this.endSimple();
          return { kind: "Delete", arr, subs };
        }
        case "getline":
          throw this.unsupportedWhat(AwkUnsupported.keyword("getline"));
        case "return":
          throw this.unsupported("awk.featureReturn");
        case "nextfile":
          throw this.unsupportedWhat(AwkUnsupported.keyword("nextfile"));
      }
    }
    const s = this.simple();
    this.endSimple();
    return s;
  }

  /** print, printf or an expression (without the trailing ;). */
  private simple(): Stmt {
    if (this.is("print", "kw") || this.is("printf", "kw")) {
      const k = this.next().v;
      let args: Expr[] = [];
      const atEnd = (): boolean => this.is(";") || this.is("}") || this.tok.t === "nl" || this.tok.t === "eof";
      if (!atEnd() && !this.is(">") && !this.is(">>") && !this.is("|")) {
        const saved = this.noGt;
        this.noGt = true;
        args = [this.parseExpr()];
        while (this.is(",")) {
          this.next();
          this.skipNl();
          args.push(this.parseExpr());
        }
        this.noGt = saved;
      }
      if (args.length === 1 && args[0]!.kind === "Group") args = args[0]!.list;
      if (this.is(">") || this.is(">>") || this.is("|"))
        throw this.unsupported("awk.featureOutputRedirect", { statement: k, op: this.tok.v });
      if (k === "printf" && args.length === 0) throw this.fail();
      return { kind: "Print", k, args };
    }
    return { kind: "ExprStmt", e: this.parseExpr() };
  }

  private subscripts(): Expr[] {
    this.expect("[");
    const saved = this.noGt;
    this.noGt = false;
    const subs = [this.parseExpr()];
    while (this.is(",")) {
      this.next();
      subs.push(this.parseExpr());
    }
    this.noGt = saved;
    this.expect("]");
    return subs;
  }

  parseExpr(): Expr {
    return this.ternary();
  }

  private ternary(): Expr {
    const c = this.or();
    if (this.is("?")) {
      this.next();
      this.skipNl();
      const a = this.ternary();
      this.skipNl();
      this.expect(":");
      this.skipNl();
      const b = this.ternary();
      return { kind: "Cond", c, a, b };
    }
    if (this.tok.t === "op" && assignOps.has(this.tok.v) && isLvalue(c)) {
      const op = this.next().v;
      this.skipNl();
      return { kind: "Assign", op, target: c, e: this.ternary() };
    }
    return c;
  }

  private or(): Expr {
    let a = this.and();
    while (this.is("||")) {
      this.next();
      this.skipNl();
      a = { kind: "Logic", k: "or", a, b: this.and() };
    }
    return a;
  }

  private and(): Expr {
    let a = this.inExpr();
    while (this.is("&&")) {
      this.next();
      this.skipNl();
      a = { kind: "Logic", k: "and", a, b: this.inExpr() };
    }
    return a;
  }

  private inExpr(): Expr {
    let a = this.matchExpr();
    while (this.is("in", "kw")) {
      this.next();
      if (this.tok.t !== "name") throw this.fail();
      a = { kind: "In", subs: a.kind === "Group" ? a.list : [a], arr: this.next().v };
    }
    return a;
  }

  private matchExpr(): Expr {
    let a = this.cmpExpr();
    while (this.is("~") || this.is("!~")) {
      const neg = this.next().v === "!~";
      a = { kind: "Match", neg, a, re: this.cmpExpr() };
    }
    return a;
  }

  private cmpExpr(): Expr {
    const a = this.concat();
    const v = this.tok.v;
    if (this.tok.t === "op" && (v === "<" || v === "<=" || v === "==" || v === "!=" || v === ">=" || (!this.noGt && v === ">"))) {
      const op = this.next().v;
      return { kind: "Cmp", op, a, b: this.concat() };
    }
    return a;
  }

  /** Can the next token start a new operand? Then it is string concatenation ("a" b). */
  private startsOperand(): boolean {
    const t = this.tok;
    if (t.t === "num" || t.t === "str" || t.t === "name" || t.t === "builtin") return true;
    return t.t === "op" && (t.v === "$" || t.v === "(");
  }

  private concat(): Expr {
    let a = this.additive();
    while (this.startsOperand()) a = { kind: "Concat", a, b: this.additive() };
    return a;
  }

  private additive(): Expr {
    let a = this.mul();
    while (this.is("+") || this.is("-")) {
      const op = this.next().v;
      a = { kind: "Bin", op, a, b: this.mul() };
    }
    return a;
  }

  private mul(): Expr {
    let a = this.unaryExpr();
    while (this.is("*") || this.is("/") || this.is("%")) {
      const op = this.next().v;
      a = { kind: "Bin", op, a, b: this.unaryExpr() };
    }
    return a;
  }

  private unaryExpr(): Expr {
    if (this.is("!")) {
      this.next();
      return { kind: "Unary", k: "not", e: this.unaryExpr() };
    }
    if (this.is("-")) {
      this.next();
      return { kind: "Unary", k: "neg", e: this.unaryExpr() };
    }
    if (this.is("+")) {
      this.next();
      return { kind: "Unary", k: "pos", e: this.unaryExpr() };
    }
    return this.pow();
  }

  private pow(): Expr {
    const a = this.postfix();
    if (this.is("^")) {
      this.next();
      // Right associative: 2^3^2 = 2^9. Also allows 2^-1.
      let b: Expr;
      if (this.is("-")) {
        this.next();
        b = { kind: "Unary", k: "neg", e: this.pow() };
      } else b = this.pow();
      return { kind: "Bin", op: "^", a, b };
    }
    return a;
  }

  private postfix(): Expr {
    if (this.is("++") || this.is("--")) {
      const tok = this.next();
      const target = this.postfix();
      if (!isLvalue(target)) throw this.fail(tok);
      return { kind: "Incr", op: tok.v, prefix: true, target };
    }
    const e = this.primary();
    if (isLvalue(e) && (this.is("++") || this.is("--"))) return { kind: "Incr", op: this.next().v, prefix: false, target: e };
    return e;
  }

  private primary(): Expr {
    const t = this.tok;
    switch (t.t) {
      case "num":
        this.next();
        return { kind: "Num", v: t.n ?? 0 };
      case "str":
        this.next();
        return { kind: "Str", v: t.v };
      case "ere":
        this.next();
        return { kind: "Re", src: t.v };
      case "name": {
        this.next();
        if (this.is("[")) return { kind: "Idx", name: t.v, subs: this.subscripts() };
        if (this.is("(") && this.tok.tight === true)
          throw this.unsupportedWhat(AwkUnsupported.feature("awk.featureFunctionCall", { name: t.v }), t);
        return { kind: "Var", name: t.v };
      }
      case "builtin": {
        this.next();
        if (unsupportedBuiltins.has(t.v)) throw this.unsupportedWhat(AwkUnsupported.feature("awk.featureBuiltin", { name: t.v }), t);
        if (!this.is("(")) {
          if (t.v === "length") return { kind: "Call", name: "length", args: [] };
          throw this.fail();
        }
        this.next();
        const saved = this.noGt;
        this.noGt = false;
        const args: Expr[] = [];
        this.skipNl();
        if (!this.is(")")) {
          args.push(this.parseExpr());
          while (this.is(",")) {
            this.next();
            this.skipNl();
            args.push(this.parseExpr());
          }
        }
        this.noGt = saved;
        this.expect(")");
        return { kind: "Call", name: t.v, args };
      }
      case "kw":
        if (t.v === "getline") throw this.unsupportedWhat(AwkUnsupported.keyword("getline"));
        throw this.fail();
      case "op":
        if (t.v === "$") {
          this.next();
          let e: Expr;
          if (this.is("++") || this.is("--")) e = this.postfix();
          else if (this.is("-")) {
            this.next();
            e = { kind: "Unary", k: "neg", e: this.primary() };
          } else e = this.primary();
          return { kind: "Field", e };
        }
        if (t.v === "(") {
          this.next();
          const saved = this.noGt;
          this.noGt = false;
          const list = [this.parseExpr()];
          while (this.is(",")) {
            this.next();
            this.skipNl();
            list.push(this.parseExpr());
          }
          this.noGt = saved;
          this.expect(")");
          return list.length === 1 ? list[0]! : { kind: "Group", list };
        }
        if (t.v === "-" || t.v === "+" || t.v === "!") return this.unaryExpr();
        if (t.v === "++" || t.v === "--") return this.postfix();
        break;
    }
    throw this.fail();
  }
}

export function parseAwk(src: string): Rule[] {
  return new AwkParser(tokenize(src)).program();
}
