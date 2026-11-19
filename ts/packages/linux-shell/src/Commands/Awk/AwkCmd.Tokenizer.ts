// Port of Commands/Awk/AwkCmd.Tokenizer.cs – awk: the tokenizer.

import { Js } from "../../Js.js";
import { AwkSyntaxError } from "./AwkSyntaxError.js";

export interface Tok {
  t: string;
  v: string;
  n?: number;
  pos: number;
  /** A '(' directly after a name, without space. */
  tight?: boolean;
}

const keywords = new Set([
  "BEGIN", "END", "if", "else", "while", "for", "in", "do", "break", "continue", "next", "nextfile",
  "exit", "print", "printf", "getline", "function", "func", "delete", "return",
]);

const builtins = new Set([
  "length", "substr", "index", "split", "sub", "gsub", "match", "sprintf", "toupper", "tolower", "int",
  "sqrt", "exp", "log", "sin", "cos", "atan2", "rand", "srand", "system", "close", "fflush",
]);
export const unsupportedBuiltins = new Set(["system", "close", "fflush"]);

const ops = [
  "**=", "+=", "-=", "*=", "/=", "%=", "^=", "==", "<=", ">=", "!=", "++", "--", "&&", "||", ">>", "!~", "**",
  "{", "}", "(", ")", "[", "]", ";", ",", "+", "-", "*", "/", "%", "^", "!", ">", "<", "|", "?", ":", "~", "$", "=",
];

function isOctal(c: string): boolean {
  return c.length === 1 && c >= "0" && c <= "7";
}

/** Turns escape sequences in a string into characters (\n, \t, \\, \" ...). */
export function unescapeAwk(s: string): string {
  let o = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "\\" || i + 1 >= s.length) {
      o += c;
      continue;
    }
    const n = s[++i]!;
    switch (n) {
      case "n": o += "\n"; break;
      case "t": o += "\t"; break;
      case "r": o += "\r"; break;
      case "a": o += "\x07"; break;
      case "b": o += "\b"; break;
      case "f": o += "\f"; break;
      case "v": o += "\v"; break;
      case "\\": o += "\\"; break;
      case '"': o += '"'; break;
      case "/": o += "/"; break;
      default:
        if (n >= "0" && n <= "7") {
          let oct = n;
          while (oct.length < 3 && isOctal(s[i + 1] ?? "")) oct += s[++i]!;
          o += String.fromCharCode(Number.parseInt(oct, 8));
        } else o += n;
        break;
    }
  }
  return o;
}

const numTokRe = /^([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?/;
const nameTokRe = /^[A-Za-z_][A-Za-z0-9_]*/;

const isDigitChar = (c: string): boolean => c.length === 1 && c >= "0" && c <= "9";

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const regexAllowed = (): boolean => {
    const p = toks.length > 0 ? toks.at(-1)! : null;
    if (p === null) return true;
    if (p.t === "num" || p.t === "str" || p.t === "ere" || p.t === "name" || p.t === "builtin") return false;
    return !(p.t === "op" && (p.v === ")" || p.v === "]" || p.v === "$" || p.v === "++" || p.v === "--"));
  };
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "\\" && src[i + 1] === "\n") {
      i += 2;
      continue;
    }
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "\n") {
      toks.push({ t: "nl", v: "\n", pos: i });
      i++;
      continue;
    }
    const start = i;
    if (isDigitChar(c) || (c === "." && isDigitChar(src[i + 1] ?? ""))) {
      const m = numTokRe.exec(src.slice(i))![0];
      toks.push({ t: "num", v: m, n: Js.number(m), pos: start });
      i += m.length;
      continue;
    }
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
      const w = nameTokRe.exec(src.slice(i))![0];
      i += w.length;
      const t = keywords.has(w) ? "kw" : builtins.has(w) ? "builtin" : "name";
      toks.push({ t, v: w, pos: start });
      if (src[i] === "(") {
        toks.push({ t: "op", v: "(", pos: i, tight: true });
        i++;
      }
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let raw = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\n") throw new AwkSyntaxError("unterminated string", start);
        if (src[j] === "\\" && j + 1 < src.length) {
          raw += src[j]! + src[j + 1]!;
          j += 2;
        } else raw += src[j++]!;
      }
      if (j >= src.length) throw new AwkSyntaxError("unterminated string", start);
      toks.push({ t: "str", v: unescapeAwk(raw), pos: start });
      i = j + 1;
      continue;
    }
    if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let raw = "";
      let inBracket = false;
      while (j < src.length && (src[j] !== "/" || inBracket)) {
        if (src[j] === "\n") throw new AwkSyntaxError("unterminated regexp", start);
        if (src[j] === "\\" && j + 1 < src.length) {
          if (src[j + 1] === "/") raw += "/";
          else raw += src[j]! + src[j + 1]!;
          j += 2;
          continue;
        }
        if (src[j] === "[") inBracket = true;
        else if (src[j] === "]") inBracket = false;
        raw += src[j++]!;
      }
      if (j >= src.length) throw new AwkSyntaxError("unterminated regexp", start);
      toks.push({ t: "ere", v: raw, pos: start });
      i = j + 1;
      continue;
    }
    const op = ops.find((o) => src.startsWith(o, i));
    if (op === undefined) throw new AwkSyntaxError(`invalid char '${c}' in expression`, start);
    toks.push({ t: "op", v: op === "**" ? "^" : op === "**=" ? "^=" : op, pos: start });
    i += op.length;
  }
  toks.push({ t: "eof", v: "", pos: src.length });
  return toks;
}
