// Port of Commands/Script/ScriptCmd.Test.cs – the test, [ and [[ commands.

import { Js } from "../../Js.js";
import * as ParserLib from "../../Parser/ParserLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as TextCmd from "../Text/TextCmd.js";

/** An error in a test expression. */
class TestError extends Error {}

const unary = new Set(["-e", "-f", "-d", "-r", "-w", "-x", "-s", "-z", "-n", "-L", "-h"]);
const binary = new Set(["=", "==", "!=", "<", ">", "-eq", "-ne", "-lt", "-le", "-gt", "-ge", "=~"]);

const integerRe = new RegExp(`^${TextCmd.JsWhitespaceClass}*-?[0-9]+${TextCmd.JsWhitespaceClass}*$`);

/** Evaluates the expression in test / [ ] / [[ ]]. */
function evalTest(args: readonly string[], ctx: CmdCtx, extended: boolean): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  let i = 0;
  const arg = (idx: number): string | null => (idx >= 0 && idx < args.length ? args[idx]! : null);

  const toInt = (s: string): number => {
    if (!integerRe.test(s)) throw new TestError(`${s}: integer expression expected`);
    return Js.number(s);
  };

  const unaryOp = (op: string, a: string): boolean => {
    if (op === "-z") return a === "";
    if (op === "-n") return a !== "";
    const node = sh.vfs.tryLookup(sh.resolve(a), user);
    switch (op) {
      case "-e":
        return node !== null;
      case "-f":
        return node?.type === "file";
      case "-d":
        return node?.type === "dir";
      case "-r":
        return node !== null && VfsLib.hasPerm(node, user, "r");
      case "-w":
        return node !== null && VfsLib.hasPerm(node, user, "w");
      case "-x":
        return node !== null && VfsLib.hasPerm(node, user, "x");
      case "-s":
        return node !== null && VfsLib.nodeSize(node) > 0;
      default:
        return false;
    }
  };

  const binaryOp = (a: string, op: string, b: string): boolean => {
    switch (op) {
      case "=":
      case "==":
        return extended ? ParserLib.globToRegex(b, true).test(a) : a === b;
      case "!=":
        return extended ? !ParserLib.globToRegex(b, true).test(a) : a !== b;
      case "<":
        return a < b;
      case ">":
        return a > b;
      case "=~": {
        let re: RegExp;
        try {
          re = TextCmd.jsRegex(b);
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
          throw new TestError(`${b}: invalid regular expression`);
        }
        return re.test(a);
      }
      case "-eq":
        return toInt(a) === toInt(b);
      case "-ne":
        return toInt(a) !== toInt(b);
      case "-lt":
        return toInt(a) < toInt(b);
      case "-le":
        return toInt(a) <= toInt(b);
      case "-gt":
        return toInt(a) > toInt(b);
      case "-ge":
        return toInt(a) >= toInt(b);
    }
    return false;
  };

  const orOps = extended ? ["-o", "||"] : ["-o"];
  const andOps = extended ? ["-a", "&&"] : ["-a"];

  const primary = (): boolean => {
    const a = arg(i);
    if (a === null) throw new TestError("argument expected");
    if (a === "!") {
      i++;
      return !primary();
    }
    if (a === "(" && args.length - i > 2) {
      i++;
      const v = or();
      if (arg(i) !== ")") throw new TestError("`)' expected");
      i++;
      return v;
    }
    if (binary.has(arg(i + 1) ?? "") && i + 2 < args.length) {
      i += 3;
      return binaryOp(a, args[i - 2]!, args[i - 1]!);
    }
    if (unary.has(a) && i + 1 < args.length) {
      i += 2;
      return unaryOp(a, args[i - 1]!);
    }
    i++;
    return a !== "";
  };
  const and = (): boolean => {
    let v = primary();
    for (let op = arg(i); op !== null && andOps.includes(op); op = arg(i)) {
      i++;
      const r = primary();
      v = v && r;
    }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    for (let op = arg(i); op !== null && orOps.includes(op); op = arg(i)) {
      i++;
      const r = and();
      v = v || r;
    }
    return v;
  };

  if (args.length === 0) return false;
  const result = or();
  if (i < args.length) throw new TestError(`${args[i]}: unexpected operator`);
  return result;
}

export function testCommand(name: string): CommandDef {
  return {
    name,
    builtin: true,
    summary: name === "test" ? "Testar villkor (filer, text och tal)" : name === "[" ? "Samma som test, skrivs [ villkor ]" : "Utökat test i bash: [[ villkor ]]",
    man: `NAMN
       test, [ ], [[ ]] - testa ett villkor

SYNOPSIS
       test UTTRYCK
       [ UTTRYCK ]
       [[ UTTRYCK ]]

BESKRIVNING
       Slutkoden blir 0 (sant) om villkoret stämmer, annars 1 (falskt).
       Används nästan alltid tillsammans med if, while, && och ||.
       Mellanslagen innanför hakparenteserna är obligatoriska!

FILER
       -e FIL    filen finns
       -f FIL    är en vanlig fil
       -d FIL    är en katalog
       -r/-w/-x  går att läsa / skriva / köra
       -s FIL    finns och är inte tom

TEXT
       -z TEXT   texten är tom
       -n TEXT   texten är inte tom
       A = B     lika        A != B   olika

TAL
       -eq  lika med          -ne  inte lika med
       -lt  mindre än         -le  mindre än eller lika med
       -gt  större än         -ge  större än eller lika med

KOMBINERA
       ! UTTRYCK          inte
       A -a B / A -o B    och / eller   (i [[ ]]: && och ||)

EXEMPEL
       if [ -f ~/.bashrc ]; then echo "finns"; fi
       [ "$svar" = "ja" ] && echo "Bra!"
       [[ $fil == *.txt ]] && echo "en textfil"`,
    run: (ctx) => {
      let args = [...ctx.args];
      if (name === "[") {
        if (args.at(-1) !== "]") {
          ctx.err("bash: [: missing `]'\n");
          return 2;
        }
        args = args.slice(0, -1);
      } else if (name === "[[") {
        if (args.at(-1) !== "]]") {
          ctx.err("bash: syntax error: missing `]]'\n");
          return 2;
        }
        args = args.slice(0, -1);
      }
      try {
        return evalTest(args, ctx, name === "[[") ? 0 : 1;
      } catch (e) {
        if (!(e instanceof TestError)) throw e;
        ctx.err(`bash: ${name}: ${e.message}\n`);
        return 2;
      }
    },
  };
}
