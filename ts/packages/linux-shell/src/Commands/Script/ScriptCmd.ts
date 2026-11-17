// Port of Commands/Script/ScriptCmd.cs (src/shell/commands/script.ts) – builtins for scripts: test/[ ]/[[ ]], read,
// printf, local, return, break, continue, shift, let and set. This is the group's root file: printf's formatting
// and the list of the group's commands. The commands themselves are ScriptCmd.<Name>.ts.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { letCmd } from "./ScriptCmd.Let.js";
import { loopControl } from "./ScriptCmd.LoopControl.js";
import { local } from "./ScriptCmd.Local.js";
import { printf } from "./ScriptCmd.Printf.js";
import { read } from "./ScriptCmd.Read.js";
import { returnCmd } from "./ScriptCmd.Return.js";
import { set } from "./ScriptCmd.Set.js";
import { shift } from "./ScriptCmd.Shift.js";
import { testCommand } from "./ScriptCmd.Test.js";

export * from "./ScriptCmd.Let.js";
export * from "./ScriptCmd.LoopControl.js";
export * from "./ScriptCmd.Local.js";
export * from "./ScriptCmd.Printf.js";
export * from "./ScriptCmd.Read.js";
export * from "./ScriptCmd.Return.js";
export * from "./ScriptCmd.Set.js";
export * from "./ScriptCmd.Shift.js";
export * from "./ScriptCmd.Test.js";

const escapeRe = /\\(n|t|r|\\|"|a|e|0[0-7]{0,3})/g;
const specRe = /%([-+ 0#]*)([0-9]+)?(?:\.([0-9]+))?([sdifxXoceb%])/g;
const zeroPadConv = /[dfixXo]/;

/** Number(x) || 0 in JavaScript. */
function numOrZero(s: string): number {
  const n = Js.number(s);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Math.trunc(n).toString(radix) in JavaScript – except that, like the C# port, a number too big for a 64-bit
 * integer is written in decimal.
 */
function toRadix(n: number, radix: number): string {
  const t = Math.trunc(n);
  if (!Number.isFinite(t)) return t > 0 ? "Infinity" : "-Infinity";
  if (Math.abs(t) >= 9.2e18) return Js.num(t);
  return t.toString(radix);
}

/**
 * n.toFixed(digits) as the C# port did it: Js.toFixed up to 15 decimals, exact digits beyond that (.NET's "F"
 * format; JavaScript's toFixed stops at 100 decimals, so more are padded with zeros).
 */
function toFixed(n: number, digits: number): string {
  if (digits <= 15) return Js.toFixed(n, digits);
  if (!Number.isFinite(n)) return Js.num(n);
  if (digits <= 100) return n.toFixed(digits);
  return n.toFixed(100) + "0".repeat(digits - 100);
}

/** n.toExponential(digits) in JavaScript, e.g. "1.50e+0" (at most 100 digits, like toExponential). */
function toExponential(n: number, digits: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "Infinity" : "-Infinity";
  return n.toExponential(Math.min(digits, 100));
}

function escapes(s: string): string {
  return s.replace(escapeRe, (_m, c: string) => {
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    if (c === "r") return "\r";
    if (c === "e") return "\x1b";
    if (c === "a") return "";
    if (c.startsWith("0")) {
      const code = Js.parseInt(c, 8);
      return String.fromCharCode(Number.isNaN(code) ? 0 : code);
    }
    return c;
  });
}

/** Formats like printf(1): %s %d %i %f %x %o %c %b %% with flags, width and precision. */
export function formatPrintf(format: string, args: readonly string[]): string {
  const fmt = escapes(format);
  let output = "";
  let argi = 0;
  do {
    let consumed = false;
    output += fmt.replace(specRe, (_m, flags: string, width: string | undefined, prec: string | undefined, conv: string) => {
      if (conv === "%") return "%";
      const arg = argi < args.length ? args[argi]! : "";
      argi++;
      consumed = true;
      let s: string;
      switch (conv) {
        case "d":
        case "i":
          s = Js.num(Math.trunc(numOrZero(arg)));
          if (flags.includes("+") && !s.startsWith("-")) s = "+" + s;
          break;
        case "f":
        case "e": {
          const p = prec !== undefined ? Math.trunc(Js.number(prec)) : 6;
          s = conv === "f" ? toFixed(numOrZero(arg), p) : toExponential(numOrZero(arg), p);
          break;
        }
        case "x":
        case "X":
          s = toRadix(numOrZero(arg), 16);
          if (conv === "X") s = s.toUpperCase();
          break;
        case "o":
          s = toRadix(numOrZero(arg), 8);
          break;
        case "c":
          s = arg[0] ?? "";
          break;
        case "b":
          s = escapes(arg);
          break;
        default:
          s = prec !== undefined ? arg.slice(0, Math.trunc(Js.number(prec))) : arg;
          break;
      }
      const w = Math.trunc(Js.number(width ?? "0"));
      if (s.length < w) {
        if (flags.includes("-")) s = s.padEnd(w);
        else if (flags.includes("0") && zeroPadConv.test(conv)) s = s.startsWith("-") ? "-" + s.slice(1).padStart(w - 1, "0") : s.padStart(w, "0");
        else s = s.padStart(w);
      }
      return s;
    });
    if (!consumed) break;
  } while (argi < args.length);
  return output;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [
    testCommand("test"),
    testCommand("["),
    testCommand("[["),
    read,
    printf,
    local,
    returnCmd,
    loopControl("break"),
    loopControl("continue"),
    shift,
    letCmd,
    set,
  ];
}
