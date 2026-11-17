// Port of Commands/Awk/AwkCmd.cs (src/shell/commands/awk.ts) – a small awk interpreter: tokenizer, recursive parser
// and a tree interpreter. Supports a useful subset of the language: pattern/action,
// BEGIN/END, fields, variables, arrays, if/while/for, print/printf and the most common
// builtin functions. Anything missing gives a syntax error from the parser.
//
// Values are number | string | StrNum (the C# boxed them as object: double, string or StrNum).

import { Js } from "../../Js.js";
import { AwkFatal } from "./AwkFatal.js";
import { fromCodePoint, jsString, jsToExponential, jsToFixed, jsToPrecisionValue, toRadix } from "./AwkCmd.JsNumbers.js";

export * from "./AwkCmd.JsNumbers.js";
export * from "./AwkCmd.Parser.js";
export * from "./AwkCmd.Tokenizer.js";

// ---------- Values ----------

const numericRe = /^\s*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?\s*$/;
const leadingNumRe = /^\s*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?/;

/** Text from outside (fields, -v): counts as a number if it looks like one. */
export class StrNum {
  readonly n: number;
  readonly numeric: boolean;
  readonly s: string;

  constructor(s: string, numeric: boolean | null = null) {
    this.s = s;
    this.n = strToNum(s);
    this.numeric = numeric ?? numericRe.test(s);
  }
}

/** A value in the awk interpreter. */
export type AwkValue = number | string | StrNum;

function strToNum(s: string): number {
  const m = leadingNumRe.exec(s);
  return m ? Js.number(m[0]) : 0;
}

/** The value of a variable that was never set: "" and 0 at the same time. */
export const Uninit = new StrNum("", true);

export function num(v: AwkValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return strToNum(v);
  return v.n;
}

export function isNumeric(v: AwkValue): boolean {
  return typeof v === "number" || (v instanceof StrNum && v.numeric);
}

export function truthy(v: AwkValue): boolean {
  if (typeof v === "string") return v !== "";
  if (v instanceof StrNum) return v.numeric ? v.n !== 0 : v.s !== "";
  return num(v) !== 0;
}

const trailingZerosRe = /\.?0+$/;

/** %g as in C: at most prec significant digits, without trailing zeros. */
export function formatG(n: number, prec = 6, alt = false): string {
  if (!Number.isFinite(n)) return n > 0 ? "inf" : n < 0 ? "-inf" : "nan";
  if (n === 0) return "0";
  const p = prec === 0 ? 1 : clampDigits(prec, 1, 100);
  const exp = Math.floor(Math.log10(Math.abs(jsToPrecisionValue(n, p))));
  const strip = (s: string): string => (alt ? s : s.includes(".") ? s.replace(trailingZerosRe, "") : s);
  if (exp < -4 || exp >= p) {
    const parts = jsToExponential(n, p - 1).split("e");
    const mant = parts[0]!;
    const e = parts[1]!;
    const sign = e.startsWith("-") ? "-" : "+";
    return `${strip(mant)}e${sign}${e.replace(/^[+-]+/, "").padStart(2, "0")}`;
  }
  return strip(jsToFixed(n, Math.max(0, p - 1 - exp)));
}

function clampDigits(d: number, min: number, max: number): number {
  return Number.isNaN(d) ? min : Math.max(min, Math.min(max, Math.trunc(d)));
}

function numToStr(n: number): string {
  if (isInteger(n) && Math.abs(n) < 1e16) return jsString(n);
  return formatG(n, 6);
}

function isInteger(n: number): boolean {
  return Number.isFinite(n) && Math.floor(n) === n;
}

export function str(v: AwkValue): string {
  if (typeof v === "number") return numToStr(v);
  if (typeof v === "string") return v;
  return v.s;
}

const sprintfRe = /%([-+ #0]*)([0-9]+|\*)?(?:\.([0-9]+|\*))?([csdiouxXeEfFgG%])/g;

/** sprintf/printf: %s %d %i %f %e %g %c %x %o %u %% with flags, width and precision. */
export function awkSprintf(fmt: string, args: readonly AwkValue[]): string {
  let ai = 0;
  const take = (): AwkValue => {
    if (ai >= args.length) throw new AwkFatal("not enough arguments to satisfy format string");
    return args[ai++]!;
  };
  return fmt.replace(sprintfRe, (_m, flags: string, w: string | undefined, pr: string | undefined, conv: string) => {
    if (conv === "%") return "%";
    const width = w === "*" ? num(take()) : w !== undefined && w !== "" ? Js.number(w) : 0;
    const prec: number | null = pr === "*" ? num(take()) : pr !== undefined ? Js.number(pr) : null;
    const left = flags.includes("-") || width < 0;
    const v = take();
    let body: string;
    let sign = "";
    let numeric = true;
    const n = num(v);
    const signOf = (neg: boolean): string => (neg ? "-" : flags.includes("+") ? "+" : flags.includes(" ") ? " " : "");
    switch (conv) {
      case "s":
        body = str(v);
        if (prec !== null) body = body.slice(0, clampDigits(prec, 0, 2147483647));
        numeric = false;
        break;
      case "c":
        if (typeof v === "number") body = fromCodePoint(Math.trunc(num(v)));
        else {
          const s = str(v);
          const cp = s.codePointAt(0);
          body = s.length === 0 ? "" : cp !== undefined && cp > 0xffff ? s.slice(0, 2) : s.slice(0, 1);
        }
        numeric = false;
        break;
      case "d":
      case "i": {
        const t = Math.trunc(n);
        body = jsString(Math.abs(t));
        if (prec !== null) body = body.padStart(clampDigits(prec, 0, 10000), "0");
        sign = signOf(t < 0);
        break;
      }
      case "o":
      case "u":
      case "x":
      case "X": {
        const t = Math.trunc(Math.abs(n));
        body = toRadix(t, conv === "o" ? 8 : conv === "u" ? 10 : 16);
        if (conv === "X") body = body.toUpperCase();
        break;
      }
      case "f":
      case "F":
        body = jsToFixed(Math.abs(n), prec !== null ? clampDigits(prec, 0, 100) : 6);
        sign = n < 0 || Object.is(n, -0) ? "-" : flags.includes("+") ? "+" : flags.includes(" ") ? " " : "";
        break;
      case "e":
      case "E": {
        const parts = jsToExponential(Math.abs(n), prec !== null ? clampDigits(prec, 0, 100) : 6).split("e");
        body = parts.length > 1 ? `${parts[0]}e${parts[1]![0]}${parts[1]!.slice(1).padStart(2, "0")}` : parts[0]!;
        if (conv === "E") body = body.toUpperCase();
        sign = signOf(n < 0);
        break;
      }
      default:
        body = formatG(Math.abs(n), prec ?? 6, flags.includes("#"));
        if (conv === "G") body = body.toUpperCase();
        sign = signOf(n < 0);
        break;
    }
    const w2 = Math.abs(width);
    const len = sign.length + body.length;
    if (len >= w2) return sign + body;
    const padN = Math.min(w2 - len, 1_000_000);
    if (left) return sign + body + " ".repeat(padN);
    if (numeric && flags.includes("0") && prec === null) return sign + "0".repeat(padN) + body;
    return " ".repeat(padN) + sign + body;
  });
}
