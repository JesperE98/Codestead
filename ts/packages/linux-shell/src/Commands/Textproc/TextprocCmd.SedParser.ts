// Port of Commands/Textproc/TextprocCmd.SedParser.cs – sed: the parsed script (addresses, commands) and the parser.

import { isWhiteSpace, Js } from "../../Js.js";
import * as RegexCmd from "../RegexCmd.js";
import { codePoints } from "./TextprocCmd.js";

export class SedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SedError";
  }
}

export class SedUnsupported extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SedUnsupported";
  }
}

/** A compiled regex together with its JavaScript source (re.source). */
export interface SedRe {
  source: string;
  re: RegExp;
}

/** kind: "line" (n), "step" (first, step), "last" or "re" (re). */
export interface SedAddr {
  kind: string;
  n?: number;
  first?: number;
  step?: number;
  re?: SedRe | null;
}

/** A part of the replacement: literal text, a group (\1, &) or a case operation (\U \L \E \u \l). */
export interface ReplPart {
  text?: string | null;
  group?: number | null;
  caseOp?: string | null;
}

export interface SedCommand {
  a1: SedAddr | null;
  a2: SedAddr | null;
  neg: boolean;
  name: string;
  // s:
  re: SedRe | null;
  repl: ReplPart[] | null;
  global: boolean;
  nth: number;
  print: boolean;
  // y:
  map: Map<string, string> | null;
  // a, i, c:
  text: string | null;
  // q, Q:
  exitCode: number;
  /** Whether a range is in progress. */
  active: boolean;
}

export interface SedState {
  lastRe: SedRe | null;
}

const SedUnsupportedCmds = "nNDPhHgGxbtTlrRwWeFzv:{}";

export function isDigit(c: string | null): boolean {
  return c !== null && c.length === 1 && c >= "0" && c <= "9";
}

const yEscRe = /\\([^\n\r\u2028\u2029])/g;

export function parseSedScript(script: string, exprNo: number, ere: boolean, state: SedState, cmds: SedCommand[]): void {
  let i = 0;
  const at = (k: number): string | null => (k >= 0 && k < script.length ? script[k]! : null);
  const fail = (msg: string): SedError => new SedError(`-e expression #${exprNo}, char ${Math.max(i, 1)}: ${msg}`);
  const skipSpace = (): void => {
    while (at(i) === " " || at(i) === "\t") i++;
  };
  const endOfCmd = (): void => {
    skipSpace();
    const c = at(i);
    if (c === null || c === ";" || c === "\n") return;
    if (c === "#") {
      while (i < script.length && script[i] !== "\n") i++;
      return;
    }
    if (c === "}") throw new SedUnsupported("{ }");
    throw fail("extra characters after command");
  };
  // Reads up to the (unescaped) delimiter. \delimiter becomes the delimiter itself.
  const readDelimited = (delim: string, what: string): string => {
    let s = "";
    while (i < script.length && script[i] !== delim) {
      if (script[i] === "\n" && delim !== "\n") throw fail(what);
      if (script[i] === "\\" && i + 1 < script.length) {
        const n = script[i + 1]!;
        if (n === delim) s += delim;
        else s += "\\" + n;
        i += 2;
        continue;
      }
      s += script[i++]!;
    }
    if (i >= script.length) throw fail(what);
    i++;
    return s;
  };
  const makeRe = (src: string, flags: string, what: string): SedRe => {
    if (src === "") {
      if (state.lastRe === null) throw fail("no previous regular expression");
      return { source: state.lastRe.source, re: RegexCmd.newRegExp(state.lastRe.source, flags) };
    }
    try {
      const source = RegexCmd.toJsRegex(src, ere);
      const re: SedRe = { source, re: RegexCmd.newRegExp(source, flags) };
      state.lastRe = re;
      return re;
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      throw fail(`Invalid ${what}`);
    }
  };
  const readDigits = (): string => {
    let n = "";
    while (isDigit(at(i))) n += script[i++]!;
    return n;
  };
  const readAddr = (): SedAddr | null => {
    const c = at(i);
    if (isDigit(c)) {
      const n = readDigits();
      if (at(i) === "~") {
        // GNU extension: first~step, e.g. 1~2 = every other line.
        i++;
        const step = readDigits();
        return { kind: "step", first: Js.number(n), step: Js.number(step === "" ? "0" : step) };
      }
      if (Js.number(n) === 0) throw fail("invalid usage of line address 0");
      return { kind: "line", n: Js.number(n) };
    }
    if (c === "$") {
      i++;
      return { kind: "last" };
    }
    if (c === "/" || c === "\\") {
      i++;
      const delim = c === "/" ? "/" : at(i++);
      if (delim === null) throw fail("unexpected end of expression");
      const src = readDelimited(delim, "unterminated address regex");
      let flags = "";
      while (at(i) === "I" || at(i) === "M") {
        if (at(i) === "I") flags = "i";
        i++;
      }
      return { kind: "re", re: makeRe(src, flags, "regular expression") };
    }
    return null;
  };

  while (i < script.length) {
    while (i < script.length && (isWhiteSpace(script[i]!) || script[i] === "\ufeff" || script[i] === ";")) i++;
    if (i >= script.length) break;
    if (script[i] === "#") {
      while (i < script.length && script[i] !== "\n") i++;
      continue;
    }
    const cmd: SedCommand = {
      a1: null,
      a2: null,
      neg: false,
      name: "",
      re: null,
      repl: null,
      global: false,
      nth: 0,
      print: false,
      map: null,
      text: null,
      exitCode: 0,
      active: false,
    };
    cmd.a1 = readAddr();
    if (cmd.a1 !== null && at(i) === ",") {
      i++;
      skipSpace();
      cmd.a2 = readAddr();
      if (cmd.a2 === null) throw fail("unexpected `,'");
    }
    skipSpace();
    if (at(i) === "!") {
      cmd.neg = true;
      i++;
      skipSpace();
      if (at(i) === "!") throw fail("multiple `!'s");
    }
    if (i >= script.length || script[i] === ";" || script[i] === "\n") throw fail("missing command");
    if (cmd.a1 === null && script[i] === ",") throw fail("unexpected `,'");
    const name = script[i++]!;
    cmd.name = name;
    switch (name) {
      case "s": {
        const delim = at(i++);
        if (delim === null || delim === "\n" || delim === "\\") throw fail("unterminated `s' command");
        const pat = readDelimited(delim, "unterminated `s' command");
        const rawRepl = readDelimited(delim, "unterminated `s' command");
        let flags = "";
        cmd.nth = 1;
        let nthSet = false;
        for (;;) {
          const f = at(i);
          if (f === "g") cmd.global = true;
          else if (f === "p") cmd.print = true;
          else if (f === "i" || f === "I") flags = "i";
          else if (isDigit(f)) {
            const n = readDigits();
            if (Js.number(n) === 0) throw fail("number option to `s' command may not be zero");
            if (nthSet) throw fail("multiple number options to `s' command");
            cmd.nth = Js.number(n);
            nthSet = true;
            continue;
          } else if (f === "w" || f === "e" || f === "m" || f === "M") throw new SedUnsupported(`s///${f}`);
          else break;
          i++;
        }
        const c = at(i);
        if (c !== null && !" \t;\n#}".includes(c)) throw fail("unknown option to `s'");
        endOfCmd();
        cmd.re = makeRe(pat, "g" + flags, "regular expression");
        const groups = RegexCmd.groupCount(cmd.re.re);
        const parts: ReplPart[] = [];
        let lit = "";
        const flush = (): void => {
          if (lit.length > 0) parts.push({ text: lit });
          lit = "";
        };
        for (let j = 0; j < rawRepl.length; j++) {
          const ch = rawRepl[j]!;
          if (ch === "&") {
            flush();
            parts.push({ group: 0 });
          } else if (ch === "\\" && j + 1 < rawRepl.length) {
            const n = rawRepl[++j]!;
            if (n >= "0" && n <= "9") {
              const g = n.charCodeAt(0) - 48;
              if (g > groups) throw fail(`invalid reference \\${n} on \`s' command's RHS`);
              flush();
              parts.push({ group: g });
            } else if ("ULEul".includes(n)) {
              flush();
              parts.push({ caseOp: n });
            } else lit += n === "n" ? "\n" : n === "t" ? "\t" : n;
          } else lit += ch;
        }
        flush();
        cmd.repl = parts;
        break;
      }
      case "y": {
        const delim = at(i++);
        if (delim === null || delim === "\n" || delim === "\\") throw fail("unterminated `y' command");
        const unesc = (s: string): string => s.replace(yEscRe, (_m, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
        const from = codePoints(unesc(readDelimited(delim, "unterminated `y' command")));
        const to = codePoints(unesc(readDelimited(delim, "unterminated `y' command")));
        if (from.length !== to.length) throw fail("strings for `y' command are different lengths");
        cmd.map = new Map<string, string>();
        for (let k = 0; k < from.length; k++) cmd.map.set(from[k]!, to[k]!);
        endOfCmd();
        break;
      }
      case "d":
      case "p":
      case "=":
        endOfCmd();
        break;
      case "q":
      case "Q": {
        if (cmd.a2 !== null) throw fail("command only uses one address");
        skipSpace();
        const n = readDigits();
        cmd.exitCode = n !== "" ? Js.number(n) : 0;
        endOfCmd();
        break;
      }
      case "a":
      case "i":
      case "c": {
        // The GNU one-line variant: "a text", "a\text" or "a\" + newline + text.
        skipSpace();
        if (at(i) === "\\") {
          i++;
          if (at(i) === "\n") i++;
        }
        let text = "";
        while (i < script.length && script[i] !== "\n") {
          if (script[i] === "\\" && i + 1 < script.length) {
            const n = script[i + 1]!;
            text += n === "n" ? "\n" : n === "t" ? "\t" : n;
            i += 2;
          } else text += script[i++]!;
        }
        if (text.length === 0) throw fail("expected \\ after `a', `c' or `i'");
        cmd.text = text;
        break;
      }
      default:
        if (SedUnsupportedCmds.includes(name)) throw new SedUnsupported(name);
        i--;
        throw fail(`unknown command: \`${name}'`);
    }
    cmds.push(cmd);
  }
}
