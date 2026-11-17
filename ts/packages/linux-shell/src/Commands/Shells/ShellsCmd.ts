// Port of Commands/Shells/ShellsCmd.cs (src/shell/commands/shells.ts) – other shells: zsh and fish (started on top of
// bash and left with exit), chsh to change the login shell, zsh's setopt/unsetopt and the hidden builtins the fish
// translation uses (set, count, math, status, contains). This is the group's root file: the shared helpers and the
// list of the group's commands. The commands themselves are ShellsCmd.<Name>.ts.

import { Js } from "../../Js.js";
import * as ShellmodeLib from "../../Shellmode/ShellmodeLib.js";
import { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import { chsh } from "./ShellsCmd.Chsh.js";
import { fish } from "./ShellsCmd.Fish.js";
import { fishContains } from "./ShellsCmd.FishContains.js";
import { fishCount } from "./ShellsCmd.FishCount.js";
import { fishIndex } from "./ShellsCmd.FishIndex.js";
import { fishMathCmd } from "./ShellsCmd.FishMath.js";
import { fishSet } from "./ShellsCmd.FishSet.js";
import { fishStatus } from "./ShellsCmd.FishStatus.js";
import { optCommand } from "./ShellsCmd.Setopt.js";
import { zsh } from "./ShellsCmd.Zsh.js";

export * from "./ShellsCmd.Chsh.js";
export * from "./ShellsCmd.Fish.js";
export * from "./ShellsCmd.FishContains.js";
export * from "./ShellsCmd.FishCount.js";
export * from "./ShellsCmd.FishIndex.js";
export * from "./ShellsCmd.FishMath.js";
export * from "./ShellsCmd.FishSet.js";
export * from "./ShellsCmd.FishStatus.js";
export * from "./ShellsCmd.Setopt.js";
export * from "./ShellsCmd.Zsh.js";

// ---------- zsh and fish ----------

export function shellCommand(mode: string, summary: string, summaryEn: string, man: string, manEn: string): CommandDef {
  return {
    name: mode,
    summary,
    summaryEn,
    man,
    manEn,
    run: (ctx) => {
      const sh = ctx.sh;
      const first = ctx.args.length > 0 ? ctx.args[0]! : null;
      const rest = ctx.args.slice(1);
      if (first === "--version" || first === "-v" || (mode === "fish" && first === "-V")) {
        const family = sh.distro.family;
        const triplet = family === "debian" ? "x86_64-ubuntu-linux-gnu" : family === "arch" ? "x86_64-pc-linux-gnu" : "x86_64-redhat-linux-gnu";
        ctx.out(mode === "zsh" ? `zsh ${ShellmodeLib.ZshVersion} (${triplet})\n` : `fish, version ${ShellmodeLib.fishVersion(sh)}\n`);
        return 0;
      }
      if (first === "-c") return sh.runScript(rest.length > 0 ? rest[0]! : "", mode, rest.slice(1), ctx, false, mode);
      if (first !== null && first !== "" && !first.startsWith("-")) {
        try {
          const content = sh.vfs.readFile(sh.resolve(first), sh.currentUser());
          return sh.runScript(content, first, rest, ctx, false, mode);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          const msg = e.message;
          ctx.err(mode === "zsh" ? `zsh: ${msg.toLowerCase()}: ${first}\n` : `fish: Error reading script file '${first}':\n${msg}\n`);
          return 127;
        }
      }
      // Code from a pipe: echo 'echo hej' | zsh
      if (ctx.stdin !== null) return sh.runScript(ctx.stdin, mode, [], ctx, false, mode);
      if (!sh.interactive) return 0;
      return sh.startShell(mode, ctx);
    },
  };
}

// ---------- fish: builtins (called through the translation) ----------

export function fishBuiltin(name: string, run: (ctx: CmdCtx) => number): CommandDef {
  return {
    name: `__fish_${name}`,
    builtin: true,
    summary: `fish: ${name}`,
    run: (ctx) => run(new CmdCtx(ctx, ctx.sh, name, ctx.args)),
  };
}

export class MathError extends Error {}

// \S as in .NET: anything but [\f\n\r\t\v\x85\p{Z}] (JavaScript's \S also matches \x85 and not \ufeff).
const mathTokRe = /[0-9]+(?:\.[0-9]+)?|\.[0-9]+|[-+*/%^()x]|pi|e|[^\t\n\v\f\r \x85\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g;
const numStartRe = /^[0-9.]/;

/** fish's math: + - * x / % ^ and parentheses, with decimals. */
export function fishMath(expr: string): number {
  const toks = expr.match(mathTokRe) ?? [];
  let i = 0;
  const peek = (): string | null => (i < toks.length ? toks[i]! : null);
  // toks[i++]: always moves on, undefined (null) past the end.
  const next = (): string | null => {
    const t = i < toks.length ? toks[i]! : null;
    i++;
    return t;
  };
  const primary = (): number => {
    const t = next();
    if (t === null) throw new MathError("Too few arguments");
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new MathError("Missing closing parenthesis");
      return v;
    }
    if (t === "-") return -power();
    if (t === "+") return power();
    if (t === "pi") return Math.PI;
    if (t === "e") return Math.E;
    if (numStartRe.test(t)) return Js.number(t);
    throw new MathError("Unexpected token");
  };
  const power = (): number => {
    const b = primary();
    if (peek() === "^") {
      i++;
      return b ** power();
    }
    return b;
  };
  const product = (): number => {
    let v = power();
    for (let op = peek(); op === "*" || op === "x" || op === "/" || op === "%"; op = peek()) {
      i++;
      const r = power();
      if ((op === "/" || op === "%") && r === 0) throw new MathError("Division by zero");
      v = op === "/" ? v / r : op === "%" ? v % r : v * r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    for (let op = peek(); op === "+" || op === "-"; op = peek()) {
      i++;
      v = op === "+" ? v + product() : v - product();
    }
    return v;
  };
  const result = sum();
  if (i < toks.length) throw new MathError("Unexpected token");
  return result;
}

/** In zsh and fish, `bash` starts a new bash shell. */
export function startBash(ctx: CmdCtx): number | null {
  const sh = ctx.sh;
  if (sh.shellMode === "bash" || !sh.interactive || ctx.stdin !== null) return null;
  return sh.startShell("bash", ctx);
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [zsh, fish, chsh, optCommand("setopt"), optCommand("unsetopt"), fishSet, fishCount, fishIndex, fishContains, fishStatus, fishMathCmd];
}
