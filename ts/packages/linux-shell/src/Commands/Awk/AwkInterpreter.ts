// Port of Commands/Awk/AwkInterpreter.cs and AwkInterpreter.Exec.cs – the awk interpreter: runs the parsed program
// over the input records. A TypeScript class cannot be split over several files, so the two C# partial files are
// the two sections of this file.

import { Js, netTrim } from "../../Js.js";
import * as RegexCmd from "../RegexCmd.js";
import * as AwkCmd from "./AwkCmd.js";
import type { AwkValue } from "./AwkCmd.js";
import { AwkFatal } from "./AwkFatal.js";
import type { AwkInput } from "./AwkInput.js";
import type { AwkIO } from "./AwkIO.js";
import type { Expr } from "./Expr.js";
import type { Rule } from "./Rule.js";
import type { Stmt } from "./Stmt.js";

// The interpreter's own jumps (not errors, so no stack trace is captured for each one).
class NextSignal {}
class BreakSignal {}
class ContinueSignal {}
class AwkExitSignal {
  constructor(readonly code: number) {}
}

const MaxSteps = 200_000;

const assignOperandRe = /^[A-Za-z_][A-Za-z0-9_]*=/;
const assignFullRe = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const intKeyRe = /^-?[0-9]+$/;
const spaceSplitRe = /[ \t\n]+/;

const num = (v: AwkValue): number => AwkCmd.num(v);
const str = (v: AwkValue): string => AwkCmd.str(v);
const truthy = (v: AwkValue): boolean => AwkCmd.truthy(v);

export class AwkInterpreter {
  private readonly vars = new Map<string, AwkValue>();
  private readonly arrays = new Map<string, Map<string, AwkValue>>();
  private record = "";
  private fields: string[] = [];
  private nf = 0;
  private readonly regexCache = new Map<string, RegExp>();
  private steps = 0;
  private readonly rules: Rule[];
  private readonly io: AwkIO;

  constructor(rules: Rule[], io: AwkIO) {
    this.rules = rules;
    this.io = io;
    const vars = this.vars;
    vars.set("FS", " ");
    vars.set("OFS", " ");
    vars.set("ORS", "\n");
    vars.set("RS", "\n");
    vars.set("NR", 0);
    vars.set("FNR", 0);
    vars.set("FILENAME", "");
    vars.set("SUBSEP", "\x1c");
    vars.set("RSTART", 0);
    vars.set("RLENGTH", -1);
    vars.set("CONVFMT", "%.6g");
    vars.set("OFMT", "%.6g");
  }

  private v(name: string): AwkValue {
    return this.vars.get(name)!;
  }

  /** -v name=value and name=value among the file arguments. */
  assign(name: string, value: string): void {
    this.vars.set(name, new AwkCmd.StrNum(AwkCmd.unescapeAwk(value)));
  }

  run(operands: string[], stdin: string): number {
    let code = 0;
    const begin = this.rules.filter((r) => r.pattern === "BEGIN");
    const end = this.rules.filter((r) => r.pattern === "END");
    const main = this.rules.filter((r) => r.pattern !== "BEGIN" && r.pattern !== "END");
    let exited = false;
    try {
      for (const r of begin) this.execBody(r.action!);
    } catch (e) {
      if (!(e instanceof AwkExitSignal)) throw e;
      code = e.code;
      exited = true;
    }
    if (!exited && (main.length > 0 || end.length > 0)) {
      try {
        const files = operands.filter((o) => !assignOperandRe.test(o));
        const sources = files.length > 0 ? operands : [...operands, "-"];
        for (const op of sources) {
          const m = assignFullRe.exec(op);
          if (m) {
            this.assign(m[1]!, m[2]!);
            continue;
          }
          const input: AwkInput | null = op === "-" ? { name: "", content: stdin } : this.io.readInput(op);
          if (input === null) {
            code = 2;
            continue;
          }
          this.vars.set("FILENAME", input.name);
          this.vars.set("FNR", 0);
          for (const rec of this.records(input.content)) {
            this.vars.set("NR", num(this.v("NR")) + 1);
            this.vars.set("FNR", num(this.v("FNR")) + 1);
            this.setRecord(rec);
            try {
              for (const r of main) {
                if (r.pattern !== null && !truthy(this.ev(r.pattern as Expr))) continue;
                if (r.action !== null) this.execBody(r.action);
                else this.io.out(this.record + str(this.v("ORS")));
              }
            } catch (e) {
              if (!(e instanceof NextSignal)) throw e;
            }
          }
        }
      } catch (e) {
        if (!(e instanceof AwkExitSignal)) throw e;
        code = e.code;
      }
    }
    try {
      for (const r of end) this.execBody(r.action!);
    } catch (e) {
      if (!(e instanceof AwkExitSignal)) throw e;
      code = e.code;
    }
    return code;
  }

  private records(content: string): string[] {
    const rs = str(this.v("RS"));
    if (content === "") return [];
    if (rs === "\n" || rs === "") {
      const lines = content.split("\n");
      if (lines.at(-1) === "") lines.pop();
      return lines;
    }
    const recs = content.split(rs[0]!);
    if (recs.at(-1) === "" || recs.at(-1) === "\n") recs.pop();
    return recs;
  }

  private splitFs(s: string, fs: string): string[] {
    if (fs === " ") {
      const t = netTrim(s);
      return t === "" ? [] : RegexCmd.jsSplit(t, spaceSplitRe);
    }
    if (s === "") return [];
    if (fs.length === 1 && fs !== "\\") return s.split(fs);
    return RegexCmd.jsSplit(s, this.getRegex(fs, ""));
  }

  private setRecord(rec: string): void {
    this.record = rec;
    const parts = this.splitFs(rec, str(this.v("FS")));
    this.fields = ["", ...parts];
    this.nf = parts.length;
  }

  private rebuild(): void {
    this.record = this.fields.slice(1, 1 + this.nf).join(str(this.v("OFS")));
  }

  private getField(i: number): AwkValue {
    if (i < 0) throw new AwkFatal(`attempt to access field ${AwkCmd.jsString(i)}`);
    if (i === 0) return new AwkCmd.StrNum(this.record);
    return i <= this.nf ? new AwkCmd.StrNum(this.fields[i]!) : AwkCmd.Uninit;
  }

  private setField(i: number, v: string): void {
    if (i < 0) throw new AwkFatal(`attempt to access field ${AwkCmd.jsString(i)}`);
    if (i === 0) {
      this.setRecord(v);
      return;
    }
    if (Number.isNaN(i)) {
      this.rebuild();
      return;
    }
    const idx = Math.min(i, 2147483647 - 1);
    while (this.fields.length <= idx) this.fields.push("");
    this.fields[idx] = v;
    if (idx > this.nf) this.nf = idx;
    this.rebuild();
  }

  private getVar(name: string): AwkValue {
    if (name === "NF") return this.nf;
    if (this.arrays.has(name)) throw new AwkFatal(`attempt to use array \`${name}' in a scalar context`);
    return this.vars.get(name) ?? AwkCmd.Uninit;
  }

  private setVar(name: string, v: AwkValue): void {
    if (this.arrays.has(name)) throw new AwkFatal(`attempt to use array \`${name}' in a scalar context`);
    if (name === "NF") {
      let n = Math.max(0, Math.trunc(num(v)));
      if (Number.isNaN(n)) n = 0;
      const ni = Math.min(n, 2147483647 - 1);
      while (this.fields.length <= ni) this.fields.push("");
      this.nf = ni;
      this.rebuild();
      return;
    }
    this.vars.set(name, v);
  }

  private getArray(name: string): Map<string, AwkValue> {
    if (this.vars.has(name) || name === "NF") throw new AwkFatal(`attempt to use scalar \`${name}' as an array`);
    let a = this.arrays.get(name);
    if (a === undefined) {
      a = new Map<string, AwkValue>();
      this.arrays.set(name, a);
    }
    return a;
  }

  private key(subs: Expr[]): string {
    return subs.map((s) => str(this.ev(s))).join(str(this.v("SUBSEP")));
  }

  private get(target: Expr): AwkValue {
    switch (target.kind) {
      case "Var":
        return this.getVar(target.name);
      case "Field":
        return this.getField(Math.trunc(num(this.ev(target.e))));
      case "Idx": {
        const a = this.getArray(target.name);
        const k = this.key(target.subs);
        if (!a.has(k)) a.set(k, AwkCmd.Uninit);
        return a.get(k)!;
      }
    }
    throw new AwkFatal("invalid assignment target");
  }

  private set(target: Expr, v: AwkValue): void {
    if (target.kind === "Var") this.setVar(target.name, v);
    else if (target.kind === "Field") this.setField(Math.trunc(num(this.ev(target.e))), str(v));
    else if (target.kind === "Idx") this.getArray(target.name).set(this.key(target.subs), v);
  }

  private getRegex(src: string, flags: string): RegExp {
    const key = flags + "/" + src;
    let re = this.regexCache.get(key);
    if (re === undefined) {
      try {
        re = RegexCmd.newRegExp(RegexCmd.toJsRegex(src, true), flags);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        throw new AwkFatal(`invalid regexp: /${src}/`);
      }
      this.regexCache.set(key, re);
    }
    return re;
  }

  private regexOf(e: Expr, flags = ""): RegExp {
    return this.getRegex(e.kind === "Re" ? e.src : str(this.ev(e)), flags);
  }

  // ---------- statements and expressions (AwkInterpreter.Exec.cs) ----------

  private tick(): void {
    if (++this.steps > MaxSteps) throw new AwkFatal("__steps__");
  }

  private execBody(body: Stmt[]): void {
    for (const s of body) this.exec(s);
  }

  private exec(s: Stmt): void {
    this.tick();
    switch (s.kind) {
      case "Print": {
        if (s.k === "print") {
          const ofs = str(this.v("OFS"));
          const ors = str(this.v("ORS"));
          const text =
            s.args.length > 0
              ? s.args
                  .map((a) => {
                    const v = this.ev(a);
                    return typeof v === "number" && !(Number.isFinite(v) && Math.floor(v) === v && Math.abs(v) < 1e16)
                      ? AwkCmd.awkSprintf(str(this.v("OFMT")), [v])
                      : str(v);
                  })
                  .join(ofs)
              : this.record;
          this.io.out(text + ors);
          return;
        }
        const vals = s.args.map((a) => this.ev(a));
        this.io.out(AwkCmd.awkSprintf(str(vals[0]!), vals.slice(1)));
        return;
      }
      case "ExprStmt":
        this.ev(s.e);
        return;
      case "Block":
        this.execBody(s.body);
        return;
      case "If":
        if (truthy(this.ev(s.c))) this.exec(s.then);
        else if (s.else !== null) this.exec(s.else);
        return;
      case "While":
        while (truthy(this.ev(s.c))) if (!this.loopBody(s.body)) break;
        return;
      case "Do":
        do {
          if (!this.loopBody(s.body)) break;
        } while (truthy(this.ev(s.c)));
        return;
      case "For":
        if (s.init !== null) this.exec(s.init);
        while (s.c === null || truthy(this.ev(s.c))) {
          if (!this.loopBody(s.body)) break;
          if (s.step !== null) this.exec(s.step);
        }
        return;
      case "ForIn": {
        const keys = [...this.getArray(s.arr).keys()];
        for (const k of keys) {
          const isNum = intKeyRe.test(k);
          this.setVar(s.v, new AwkCmd.StrNum(k, isNum));
          if (!this.loopBody(s.body)) break;
        }
        return;
      }
      case "Jump":
        if (s.k === "next") throw new NextSignal();
        if (s.k === "break") throw new BreakSignal();
        throw new ContinueSignal();
      case "Exit":
        throw new AwkExitSignal(s.e !== null ? toExitCode(Math.trunc(num(this.ev(s.e)))) : 0);
      case "Delete":
        if (s.subs !== null) this.getArray(s.arr).delete(this.key(s.subs));
        else this.getArray(s.arr).clear();
        return;
    }
  }

  /** Runs a loop body. Returns false on break. */
  private loopBody(body: Stmt): boolean {
    this.tick();
    try {
      this.exec(body);
    } catch (e) {
      if (e instanceof BreakSignal) return false;
      if (!(e instanceof ContinueSignal)) throw e;
    }
    return true;
  }

  private ev(e: Expr): AwkValue {
    switch (e.kind) {
      case "Num":
        return e.v;
      case "Str":
        return e.v;
      case "Re":
        return this.getRegex(e.src, "").test(this.record) ? 1 : 0;
      case "Var":
        return this.getVar(e.name);
      case "Field":
      case "Idx":
        return this.get(e);
      case "Group":
        throw new AwkFatal("invalid use of a parenthesized list");
      case "Assign": {
        const rhs = this.ev(e.e);
        let val: AwkValue = rhs;
        if (e.op !== "=") val = arith(e.op.slice(0, -1), num(this.get(e.target)), num(rhs));
        this.set(e.target, val);
        return val;
      }
      case "Cond":
        return truthy(this.ev(e.c)) ? this.ev(e.a) : this.ev(e.b);
      case "Logic":
        if (e.k === "and") return truthy(this.ev(e.a)) && truthy(this.ev(e.b)) ? 1 : 0;
        return truthy(this.ev(e.a)) || truthy(this.ev(e.b)) ? 1 : 0;
      case "Unary":
        if (e.k === "not") return truthy(this.ev(e.e)) ? 0 : 1;
        if (e.k === "neg") return -num(this.ev(e.e));
        return num(this.ev(e.e));
      case "Bin":
        return arith(e.op, num(this.ev(e.a)), num(this.ev(e.b)));
      case "Cmp": {
        const a = this.ev(e.a);
        const b = this.ev(e.b);
        let d: number;
        if (AwkCmd.isNumeric(a) && AwkCmd.isNumeric(b)) d = num(a) - num(b);
        else d = Js.ordinal(str(a), str(b));
        let res: boolean;
        switch (e.op) {
          case "<": res = d < 0; break;
          case "<=": res = d <= 0; break;
          case ">": res = d > 0; break;
          case ">=": res = d >= 0; break;
          case "==": res = d === 0; break;
          default: res = d !== 0; break;
        }
        return res ? 1 : 0;
      }
      case "Match": {
        const ok = this.regexOf(e.re).test(str(this.ev(e.a)));
        return ok !== e.neg ? 1 : 0;
      }
      case "Concat":
        return str(this.ev(e.a)) + str(this.ev(e.b));
      case "Incr": {
        const old = num(this.get(e.target));
        const v = e.op === "++" ? old + 1 : old - 1;
        this.set(e.target, v);
        return e.prefix ? v : old;
      }
      case "In": {
        const a = this.getArray(e.arr);
        return a.has(this.key(e.subs)) ? 1 : 0;
      }
      case "Call":
        return this.call(e.name, e.args);
    }
  }

  private call(name: string, args: Expr[]): AwkValue {
    const arg = (i: number): AwkValue => this.ev(args[i]!);
    const need = (min: number, max: number | null = null): void => {
      if (args.length < min || args.length > (max ?? min)) throw new AwkFatal(`${name}: called with ${args.length} arguments`);
    };
    switch (name) {
      case "length": {
        need(0, 1);
        if (args.length === 0) return this.record.length;
        const a0 = args[0]!;
        if (a0.kind === "Var") {
          const arr = this.arrays.get(a0.name);
          if (arr !== undefined) return arr.size;
        }
        return str(arg(0)).length;
      }
      case "substr": {
        need(2, 3);
        const s = str(arg(0));
        const m = AwkCmd.jsRound(num(arg(1)));
        const end = args.length === 3 ? m + AwkCmd.jsRound(num(arg(2))) : Number.POSITIVE_INFINITY;
        const from = Number.isNaN(m) ? NaN : Math.max(m, 1);
        const to = Number.isNaN(end) ? NaN : Math.min(end, s.length + 1);
        return to > from ? s.slice(from - 1, to - 1) : "";
      }
      case "index":
        need(2);
        return str(arg(0)).indexOf(str(arg(1))) + 1;
      case "split": {
        need(2, 3);
        const target = args[1]!;
        if (target.kind !== "Var") throw new AwkFatal("split: second argument is not an array");
        const s = str(arg(0));
        const sep = args[2];
        const parts =
          sep !== undefined
            ? sep.kind === "Re"
              ? s === ""
                ? []
                : RegexCmd.jsSplit(s, this.getRegex(sep.src, ""))
              : this.splitFs(s, str(arg(2)))
            : this.splitFs(s, str(this.v("FS")));
        const a = this.getArray(target.name);
        a.clear();
        for (let i = 0; i < parts.length; i++) a.set(Js.num(i + 1), new AwkCmd.StrNum(parts[i]!));
        return parts.length;
      }
      case "sub":
      case "gsub": {
        need(2, 3);
        const target: Expr = args.length > 2 ? args[2]! : { kind: "Field", e: { kind: "Num", v: 0 } };
        if (!AwkCmd.isLvalue(target)) throw new AwkFatal(`${name}: third argument is not a changeable object`);
        const re = this.regexOf(args[0]!, "g");
        const repl = str(arg(1));
        const s = str(this.get(target));
        let count = 0;
        const result = s.replace(re, (m: string) => {
          if (name === "sub" && count > 0) return m;
          count++;
          let o = "";
          for (let i = 0; i < repl.length; i++) {
            if (repl[i] === "\\" && i + 1 < repl.length && (repl[i + 1] === "\\" || repl[i + 1] === "&")) {
              o += repl[i + 1] === "&" ? "&" : "\\";
              i++;
            } else if (repl[i] === "&") o += m;
            else o += repl[i];
          }
          return o;
        });
        if (count > 0) this.set(target, result);
        return count;
      }
      case "match": {
        need(2);
        const m = this.regexOf(args[1]!).exec(str(arg(0)));
        const start = m ? m.index + 1 : 0;
        this.vars.set("RSTART", start);
        this.vars.set("RLENGTH", m ? m[0].length : -1);
        return start;
      }
      case "sprintf": {
        if (args.length === 0) throw new AwkFatal("sprintf: no arguments");
        const vals = args.map((a) => this.ev(a));
        return AwkCmd.awkSprintf(str(vals[0]!), vals.slice(1));
      }
      case "toupper": {
        need(1);
        const s = str(arg(0));
        return this.io.asciiCase === true ? s.replace(/[a-z]/g, (c) => c.toUpperCase()) : AwkCmd.jsUpper(s);
      }
      case "tolower": {
        need(1);
        const s = str(arg(0));
        return this.io.asciiCase === true ? s.replace(/[A-Z]/g, (c) => c.toLowerCase()) : AwkCmd.jsLower(s);
      }
      case "int":
        need(1);
        return Math.trunc(num(arg(0)));
      case "sqrt":
        need(1);
        return Math.sqrt(num(arg(0)));
      case "exp":
        need(1);
        return Math.exp(num(arg(0)));
      case "log":
        need(1);
        return Math.log(num(arg(0)));
      case "sin":
        need(1);
        return Math.sin(num(arg(0)));
      case "cos":
        need(1);
        return Math.cos(num(arg(0)));
      case "atan2":
        need(2);
        return Math.atan2(num(arg(0)), num(arg(1)));
      case "rand":
        return Js.random();
      case "srand":
        return 0;
    }
    throw new AwkFatal(`function \`${name}' not defined`);
  }
}

function toExitCode(d: number): number {
  return Number.isNaN(d) ? 0 : Math.max(-2147483648, Math.min(2147483647, d));
}

function arith(op: string, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new AwkFatal("division by zero attempted");
      return a / b;
    case "%":
      if (b === 0) throw new AwkFatal("division by zero attempted in `%'");
      return a % b;
    default:
      // a ** b (the C# had to correct Math.Pow for NaN exponents and ±1 ** ±Infinity; JavaScript's ** is the original).
      return a ** b;
  }
}
