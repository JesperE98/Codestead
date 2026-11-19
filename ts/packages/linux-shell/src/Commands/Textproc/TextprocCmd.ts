// Port of Commands/Textproc/TextprocCmd.cs (src/shell/commands/textproc.ts) – text processing: tr, sed and awk.
// This is the group's root file: the shared helpers and the command list. The commands themselves are
// TextprocCmd.<Name>.ts.

import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { awk } from "./TextprocCmd.Awk.js";
import { sed } from "./TextprocCmd.Sed.js";
import { tr } from "./TextprocCmd.Tr.js";

export * from "./TextprocCmd.Awk.js";
export * from "./TextprocCmd.Sed.js";
export * from "./TextprocCmd.SedParser.js";
export * from "./TextprocCmd.Tr.js";

export function dimNote(ctx: CmdCtx, key: string, args: MsgArgs = {}): void {
  ctx.err(`${UtilCmd.Color.dim}(${ctx.sh.msg("textproc.simulator")}: ${ctx.sh.msg(key, args)})${UtilCmd.Color.reset}\n`);
}

/** [...s] – the code points of a string, each as a string. */
export function codePoints(s: string): string[] {
  return [...s];
}

function codePointAt0(c: string): number {
  return c.codePointAt(0)!;
}

function fromCodePoint(cp: number): string {
  return cp >= 0xd800 && cp <= 0xdfff ? String.fromCharCode(cp) : String.fromCodePoint(cp);
}

// =====================================================================
// tr
// =====================================================================

function buildTrClasses(): Map<string, string> {
  const d = new Map<string, string>([
    ["upper", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["lower", "abcdefghijklmnopqrstuvwxyz"],
    ["digit", "0123456789"],
    ["space", " \t\n\r\f\v"],
    ["blank", " \t"],
    ["punct", "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"],
    ["xdigit", "0123456789ABCDEFabcdef"],
  ]);
  d.set("alpha", d.get("upper")! + d.get("lower")!);
  d.set("alnum", d.get("digit")! + d.get("alpha")!);
  return d;
}

let trClasses: Map<string, string> | null = null;

export class TrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrError";
  }
}

const trEscapes = new Map<string, string>([
  ["n", "\n"],
  ["t", "\t"],
  ["r", "\r"],
  ["f", "\f"],
  ["v", "\v"],
  ["a", "\x07"],
  ["b", "\b"],
  ["\\", "\\"],
]);

/** Expands a tr set: ranges (a-z), classes ([:upper:]) and escapes (\n). */
export function expandTrSet(spec: string): string[] {
  trClasses ??= buildTrClasses();
  const chars = codePoints(spec);
  const o: string[] = [];
  let i = 0;
  const at = (k: number): string => (k < chars.length ? chars[k]! : "");
  const readChar = (): string => {
    const c = chars[i++]!;
    if (c !== "\\" || i >= chars.length) return c;
    const n = chars[i++]!;
    const mapped = trEscapes.get(n);
    if (mapped !== undefined) return mapped;
    if (n.length === 1 && n >= "0" && n <= "7") {
      let oct = n;
      while (oct.length < 3 && /^[0-7]$/.test(at(i))) oct += chars[i++]!;
      return String.fromCharCode(Number.parseInt(oct, 8));
    }
    return n;
  };
  while (i < chars.length) {
    if (chars[i] === "[" && at(i + 1) === ":") {
      const rest = chars.slice(i).join("");
      const end = rest.indexOf(":]");
      if (end > 0) {
        const name = rest.slice(2, end);
        const cls = trClasses.get(name);
        if (cls === undefined) throw new TrError(`invalid character class '${name}'`);
        o.push(...codePoints(cls));
        i += codePoints(rest.slice(0, end + 2)).length;
        continue;
      }
    }
    const c = readChar();
    if (at(i) === "-" && i + 1 < chars.length) {
      i++;
      const d = readChar();
      const from = codePointAt0(c);
      const to = codePointAt0(d);
      if (to < from) throw new TrError(`range-endpoints of '${c}-${d}' are in reverse collating sequence order`);
      for (let cp = from; cp <= to; cp++) o.push(fromCodePoint(cp));
      continue;
    }
    o.push(c);
  }
  return o;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [tr, sed, awk];
}
