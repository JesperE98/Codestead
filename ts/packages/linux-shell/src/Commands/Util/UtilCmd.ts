// Port of Commands/Util/UtilCmd.cs (src/shell/commands/util.ts) – helpers shared by the commands: option parsing,
// reading input files, dates, file modes, colours, sizes and man page formatting.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import type { Input } from "./Input.js";
import type { OptSpec } from "./OptSpec.js";
import type { Opts } from "./Opts.js";

/** Edit distance: insertions, deletions and substitutions (git's "most similar command"). */
export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

/** Like levenshtein, but two swapped neighbours count as one edit ("sl" → "ls"). */
export function typoDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
    }
  return dp[a.length]![b.length]!;
}

/** ANSI colours (UtilCmd.Color in C#). */
export const Color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[1;31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[1;34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  execGreen: "\x1b[1;32m",
} as const;

/** Simple getopt: handles -la, -n 5, -n5, --all, --lines=5 and --. */
export function parseOpts(args: readonly string[], spec: OptSpec): Opts {
  const o: Opts = { flags: new Set(), values: new Map(), operands: [], error: null };
  const takesValue = (c: string): boolean => spec.values?.includes(c) ?? false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") {
      o.operands.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith("--") && a.length > 2) {
      const eq = a.indexOf("=");
      const key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const mapped = spec.long && Object.hasOwn(spec.long, key) ? spec.long[key]! : undefined;
      if (mapped === undefined) {
        o.error = `unrecognized option '${a}'`;
        return o;
      }
      if (takesValue(mapped)) {
        const v = eq >= 0 ? a.slice(eq + 1) : ++i < args.length ? args[i]! : null;
        if (v === null) {
          o.error = `option '${a}' requires an argument`;
          return o;
        }
        o.values.set(mapped, v);
      } else {
        o.flags.add(mapped);
      }
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const c = a[j]!;
        if (takesValue(c)) {
          const rest = a.slice(j + 1);
          const v = rest !== "" ? rest : ++i < args.length ? args[i]! : null;
          if (v === null) {
            o.error = `option requires an argument -- '${c}'`;
            return o;
          }
          o.values.set(c, v);
          break;
        }
        if (spec.flags?.includes(c) === true) o.flags.add(c);
        else {
          o.error = `invalid option -- '${c}'`;
          return o;
        }
      }
      continue;
    }
    o.operands.push(a);
  }
  return o;
}

export function badOption(ctx: CmdCtx, error: string, code = 1): number {
  ctx.err(`${ctx.name}: ${error}\nTry '${ctx.name} --help' for more information.\n`);
  return code;
}

/** The message of an FsError; any other exception is rethrown. */
export function fsMessage(e: unknown): string {
  if (e instanceof FsError) return e.message;
  throw e;
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function joinLines(lines: Iterable<string>): string {
  let s = "";
  for (const l of lines) s += l + "\n";
  return s;
}

/**
 * Reads the files in operands (or stdin if none are given / "-").
 * Errors are printed directly; failed becomes true if anything went wrong.
 */
export function readInputs(
  ctx: CmdCtx,
  operands: readonly string[],
  errFormat: ((label: string, message: string) => string) | null = null,
): { inputs: Input[]; failed: boolean } {
  const format = errFormat ?? ((l: string, m: string) => `${ctx.name}: ${l}: ${m}`);
  const inputs: Input[] = [];
  let failed = false;
  const list = operands.length > 0 ? operands : ["-"];
  for (const op of list) {
    if (op === "-") {
      inputs.push({ label: "(standard input)", content: ctx.stdin ?? "" });
      continue;
    }
    try {
      inputs.push({ label: op, content: ctx.sh.vfs.readFile(ctx.sh.resolve(op), ctx.sh.currentUser()) });
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(format(op, e.message) + "\n");
      failed = true;
    }
  }
  return { inputs, failed };
}

export const Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const Days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function lsDate(ms: number): string {
  const d = Js.localDate(ms);
  return `${Months[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${Js.pad2(d.getHours())}:${Js.pad2(d.getMinutes())}`;
}

export function longDate(date: Date | null = null): string {
  const d = date ?? Js.localNow();
  const t = `${Js.pad2(d.getHours())}:${Js.pad2(d.getMinutes())}:${Js.pad2(d.getSeconds())}`;
  const tz = timeZoneAbbreviation(d);
  return `${Days[d.getDay()]} ${Months[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${t} ${tz} ${d.getFullYear()}`;
}

/**
 * A short time zone name such as "UTC" or "GMT+1" (best effort, like toLocaleTimeString's timeZoneName). C# used
 * the system's zone names when they are short (≤ 5 letters, which they rarely are) and otherwise GMT±H[:MM];
 * here it is always the offset form.
 */
export function timeZoneAbbreviation(d: Date): string {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = "";
  }
  if (zone === "UTC" || zone === "Etc/UTC" || zone === "Etc/Universal") return "UTC";
  const offset = -d.getTimezoneOffset();
  if (offset === 0) return "UTC";
  const sign = offset < 0 ? "-" : "+";
  const hours = Math.trunc(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return `GMT${sign}${hours}` + (minutes !== 0 ? `:${Js.pad2(minutes)}` : "");
}

export function modeString(n: FsNode): string {
  const m = n.mode;
  const tri = (shift: number, special: number, ch: string): string => {
    const bits = (m >> shift) & 7;
    const r = (bits & 4) !== 0 ? "r" : "-";
    const w = (bits & 2) !== 0 ? "w" : "-";
    let x = (bits & 1) !== 0 ? "x" : "-";
    if ((m & special) !== 0) x = (bits & 1) !== 0 ? ch : ch.toUpperCase();
    return `${r}${w}${x}`;
  };
  return (n.type === "dir" ? "d" : n.type === "link" ? "l" : "-") + tri(6, Js.oct(4000), "s") + tri(3, Js.oct(2000), "s") + tri(0, Js.oct(1000), "t");
}

/** broken: for a symbolic link: it points to nothing (shown in red, like ls does). */
export function colorName(name: string, node: FsNode, tty: boolean, broken = false): string {
  if (!tty) return name;
  if (node.type === "link") return broken ? `\x1b[40;31;1m${name}${Color.reset}` : `\x1b[1;36m${name}${Color.reset}`;
  if (node.type === "dir") {
    if ((node.mode & Js.oct(1002)) === Js.oct(1002)) return `\x1b[30;42m${name}${Color.reset}`;
    return `${Color.blue}${name}${Color.reset}`;
  }
  if ((node.mode & Js.oct(4000)) !== 0) return `\x1b[37;41m${name}${Color.reset}`;
  if ((node.mode & Js.oct(111)) !== 0) return `${Color.execGreen}${name}${Color.reset}`;
  return name;
}

export function humanSize(n: number): string {
  if (n < 1024) return Js.num(n);
  const units = ["K", "M", "G"];
  let v = n;
  let u = -1;
  do {
    v /= 1024;
    u++;
  } while (v >= 1024 && u < units.length - 1);
  return (v < 10 ? Js.toFixed(Math.ceil(v * 10) / 10, 1) : Js.num(Math.ceil(v))) + units[u];
}

const ansiRe = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s: string): string {
  return s.replace(ansiRe, "");
}

const namnRe = /^\s*NAMN(?![\p{L}\p{Mn}\p{Nd}\p{Pc}])/u;

/** Formats a simplified man page. */
export function formatMan(name: string, body: string): string {
  const title = `${name.toUpperCase()}(1)`;
  // Swedish man pages start with NAMN, English ones with NAME.
  const mid = namnRe.test(body) ? "Simulerad manual" : "Simulated manual";
  const pad = Math.max(1, Math.trunc((72 - title.length * 2 - mid.length) / 2));
  const spaces = " ".repeat(pad);
  return `${title}${spaces}${mid}${spaces}${title}\n\n${body.trim()}\n\n`;
}
