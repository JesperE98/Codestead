// Port of Arith/ArithLib.cs (src/shell/arith.ts) – integer arithmetic as in bash: $(( 1 + 2 )), (( i++ )),
// (( x > 3 )) etc. Bash uses 64-bit integers, and so did the C# port (long): here they are bigints wrapped
// to 64 bits with BigInt.asIntN, so overflow, division and shifts behave exactly as in C#.

import { isWhiteSpace } from "../Js.js";
import { ArithError } from "./ArithError.js";
import type { ArithVars } from "./ArithVars.js";

type ATok = { k: "num"; v: bigint } | { k: "id"; v: string } | { k: "op"; v: string };

const ops = [
  "**=", "<<=", ">>=", "&&", "||", "**", "++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "<=", ">=", "<<", ">>",
  "=", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", "?", ":", ",", "~", "&", "|", "^",
];

// .NET \d matches the digits of every script (they fail long.TryParse and become long.MaxValue).
const numRe = /^(0[xX][0-9a-fA-F]+|\p{Nd}+)/u;
// .NET \w is Unicode (letters and digits of every script).
const idRe = /^[A-Za-z_][\p{L}\p{Mn}\p{Nd}\p{Pc}]*/u;
const intRe = /^-?\p{Nd}+$/u;
const nameRe = /^[A-Za-z_][\p{L}\p{Mn}\p{Nd}\p{Pc}]*$/u;

const longMax = (1n << 63n) - 1n;
const i64 = (v: bigint): bigint => BigInt.asIntN(64, v);

/** long.TryParse: null when it is not an ASCII number or does not fit in 64 bits. */
function parseLong(text: string): bigint | null {
  if (!/^-?[0-9]+$/.test(text)) return null;
  const v = BigInt(text);
  return v === i64(v) ? v : null;
}

/** long.Parse(hex, NumberStyles.HexNumber): 64-bit two's complement; more than 64 bits throws (OverflowException in C#). */
function parseHex(digits: string): bigint {
  const v = BigInt("0x" + digits);
  if (v > 0xffffffffffffffffn) throw new Error("Value was either too large or too small for an Int64.");
  return i64(v);
}

function lex(src: string): ATok[] {
  const toks: ATok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (isWhiteSpace(c)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    const num = numRe.exec(rest);
    if (num) {
      const text = num[1]!;
      // Too large decimals become long.MaxValue.
      const v = text.toLowerCase().startsWith("0x") ? parseHex(text.slice(2)) : (parseLong(text) ?? longMax);
      toks.push({ k: "num", v });
      i += text.length;
      continue;
    }
    const id = idRe.exec(rest);
    if (id) {
      toks.push({ k: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = ops.find((o) => rest.startsWith(o));
    if (op !== undefined) {
      toks.push({ k: "op", v: op });
      i += op.length;
      continue;
    }
    throw new ArithError(`syntax error: invalid arithmetic operator (error token is "${rest}")`);
  }
  return toks;
}

const binary = new Map<string, { prec: number; left: boolean }>([
  [",", { prec: 1, left: true }],
  ["||", { prec: 4, left: true }],
  ["&&", { prec: 5, left: true }],
  ["|", { prec: 6, left: true }],
  ["^", { prec: 7, left: true }],
  ["&", { prec: 8, left: true }],
  ["==", { prec: 9, left: true }],
  ["!=", { prec: 9, left: true }],
  ["<", { prec: 10, left: true }],
  [">", { prec: 10, left: true }],
  ["<=", { prec: 10, left: true }],
  [">=", { prec: 10, left: true }],
  ["<<", { prec: 11, left: true }],
  [">>", { prec: 11, left: true }],
  ["+", { prec: 12, left: true }],
  ["-", { prec: 12, left: true }],
  ["*", { prec: 13, left: true }],
  ["/", { prec: 13, left: true }],
  ["%", { prec: 13, left: true }],
  ["**", { prec: 14, left: false }],
]);

const assign = new Set(["=", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>="]);

const b = (v: boolean): bigint => (v ? 1n : 0n);

function pow(a: bigint, e: bigint): bigint {
  if (e < 0n) throw new ArithError('exponent less than 0 (error token is "' + e + '")');
  let result = 1n;
  for (let k = 0n; k < e; k++) result = i64(result * a);
  return result;
}

/** C# shifts on long use only the low 6 bits of the count. */
const shiftCount = (n: bigint): bigint => BigInt.asUintN(6, n);

function applyBinary(op: string, a: bigint, c: bigint): bigint {
  switch (op) {
    case "+":
      return i64(a + c);
    case "-":
      return i64(a - c);
    case "*":
      return i64(a * c);
    case "/":
    case "%":
      if (c === 0n) throw new ArithError('division by 0 (error token is "0")');
      // bigint division truncates toward zero, like C#. long.MinValue / -1 wraps (C# would throw OverflowException).
      return op === "/" ? i64(a / c) : a % c;
    case "**":
      return pow(a, c);
    case "<<":
      return i64(a << shiftCount(c));
    case ">>":
      return a >> shiftCount(c);
    case "<":
      return b(a < c);
    case ">":
      return b(a > c);
    case "<=":
      return b(a <= c);
    case ">=":
      return b(a >= c);
    case "==":
      return b(a === c);
    case "!=":
      return b(a !== c);
    case "&":
      return a & c;
    case "|":
      return a | c;
    case "^":
      return a ^ c;
    case "&&":
      return b(a !== 0n && c !== 0n);
    case "||":
      return b(a !== 0n || c !== 0n);
    case ",":
      return c;
  }
  throw new ArithError(`unknown operator ${op}`);
}

/** Evaluates an arithmetic expression. The result is a 64-bit integer (a bigint in -2^63 .. 2^63-1). */
export function evalArith(src: string, vars: ArithVars): bigint {
  const toks = lex(src);
  let i = 0;
  const peek = (): ATok | null => (i < toks.length ? toks[i]! : null);
  const isOp = (v: string): boolean => {
    const t = toks[i];
    return t !== undefined && t.k === "op" && t.v === v;
  };

  const varValue = (name: string): bigint => {
    const raw = (vars.get(name) ?? "").trim();
    if (raw === "") return 0n;
    if (intRe.test(raw)) return parseLong(raw) ?? 0n;
    if (nameRe.test(raw)) return varValue(raw);
    return evalArith(raw, vars);
  };

  const parseExpr = (minPrec: number): bigint => {
    // Assignment: name = expression
    const t = peek();
    const next = toks[i + 1];
    if (t?.k === "id" && next?.k === "op" && assign.has(next.v)) {
      i += 2;
      const right = parseExpr(2);
      const value = next.v === "=" ? right : applyBinary(next.v.slice(0, -1), varValue(t.v), right);
      vars.set(t.v, value.toString());
      return value;
    }
    let left = parseUnary();
    for (;;) {
      const op = peek();
      if (op?.k !== "op") break;
      if (op.v === "?" && minPrec <= 3) {
        i++;
        const a = parseExpr(1);
        if (!isOp(":")) throw new ArithError("`:' expected for conditional expression");
        i++;
        const c = parseExpr(3);
        left = left !== 0n ? a : c;
        continue;
      }
      const info = binary.get(op.v);
      if (!info || info.prec < minPrec) break;
      i++;
      const rhs = parseExpr(info.left ? info.prec + 1 : info.prec);
      left = applyBinary(op.v, left, rhs);
    }
    return left;
  };

  const parseUnary = (): bigint => {
    const t = peek();
    if (t === null) throw new ArithError("syntax error: operand expected");
    if (t.k === "op") {
      if (t.v === "(") {
        i++;
        const v = parseExpr(1);
        if (!isOp(")")) throw new ArithError("missing `)'");
        i++;
        return v;
      }
      if (t.v === "++" || t.v === "--") {
        i++;
        const id = peek();
        if (id?.k !== "id") throw new ArithError("syntax error: operand expected");
        i++;
        const v = i64(varValue(id.v) + (t.v === "++" ? 1n : -1n));
        vars.set(id.v, v.toString());
        return v;
      }
      i++;
      const u = parseUnary();
      switch (t.v) {
        case "-":
          return i64(-u);
        case "+":
          return u;
        case "!":
          return b(u === 0n);
        case "~":
          return ~u;
        default:
          throw new ArithError(`syntax error: operand expected (error token is "${t.v}")`);
      }
    }
    i++;
    if (t.k === "num") return t.v;
    const name = t.v;
    // Variable, possibly followed by ++/--
    const value = varValue(name);
    if (isOp("++") || isOp("--")) {
      vars.set(name, i64(value + (isOp("++") ? 1n : -1n)).toString());
      i++;
    }
    return value;
  };

  if (toks.length === 0) return 0n;
  const result = parseExpr(1);
  if (i < toks.length) {
    const t = toks[i]!;
    throw new ArithError(`syntax error in expression (error token is "${t.v}")`);
  }
  return result;
}
