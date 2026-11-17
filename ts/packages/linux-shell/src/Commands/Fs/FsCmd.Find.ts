// Port of Commands/Fs/FsCmd.Find.cs – the find command: searches for files in a directory tree.

import { Js } from "../../Js.js";
import * as ParserLib from "../../Parser/ParserLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";

export const find: CommandDef = {
  name: "find",
  summary: "Söker efter filer i en katalogstruktur",
  man: `NAMN
       find - sök efter filer i en katalogstruktur

SYNOPSIS
       find [SÖKVÄG...] [UTTRYCK]

UTTRYCK
       -name MÖNSTER     filnamnet matchar MÖNSTER (t.ex. "*.txt")
       -iname MÖNSTER    som -name men skiftlägesokänsligt
       -type f|d|l       bara filer (f), kataloger (d) eller symboliska
                         länkar (l)
       -maxdepth N       gå högst N nivåer ner
       -mindepth N       visa inget på nivåer grundare än N

EXEMPEL
       find ~ -name "*.txt"
       find /etc -maxdepth 1 -type d

TIPS
       Sätt mönstret inom citattecken, annars expanderar skalet * innan
       find ens får se det.`,
  run: (ctx) => runFind(ctx),
};

function runFind(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  const args = [...ctx.args];
  const shift = (): string | null => (args.length === 0 ? null : args.shift()!);
  const paths: string[] = [];
  while (args.length > 0 && !args[0]!.startsWith("-")) paths.push(shift()!);
  if (paths.length === 0) paths.push(".");
  const tests: ((name: string, node: FsNode) => boolean)[] = [];
  let maxDepth = Number.POSITIVE_INFINITY;
  let minDepth = 0;
  while (args.length > 0) {
    const a = shift()!;
    const v = shift();
    if (v === null && a !== "-print") {
      ctx.err(`find: missing argument to \`${a}'\n`);
      return 1;
    }
    switch (a) {
      case "-name":
      case "-iname": {
        const re = ParserLib.globToRegex(v!);
        const rx = a === "-iname" ? new RegExp(re.source, re.flags + "i") : re;
        tests.push((name) => rx.test(name));
        break;
      }
      case "-type":
        if (v !== "f" && v !== "d" && v !== "l") {
          ctx.err(`find: Unknown argument to -type: ${v}\n`);
          return 1;
        }
        tests.push((_, node) => (v === "f" ? node.type === "file" : v === "l" ? node.type === "link" : node.type === "dir"));
        break;
      case "-maxdepth":
        maxDepth = Js.number(v);
        break;
      case "-mindepth":
        minDepth = Js.number(v);
        break;
      case "-print":
        if (v !== null) args.unshift(v);
        break;
      default:
        ctx.err(`find: unknown predicate \`${a}'\n`);
        return 1;
    }
  }
  let code = 0;
  const walk = (display: string, node: FsNode, depth: number): void => {
    const name = VfsLib.basename(display);
    if (depth >= minDepth && tests.every((t) => t(name, node))) ctx.out(display + "\n");
    if (node.type !== "dir" || depth >= maxDepth) return;
    if (!VfsLib.hasPerm(node, user, "r") || !VfsLib.hasPerm(node, user, "x")) {
      ctx.err(`find: '${display}': Permission denied\n`);
      code = 1;
      return;
    }
    for (const child of [...node.children!.keys()].sort()) {
      walk(display.endsWith("/") ? display + child : `${display}/${child}`, node.children!.get(child)!, depth + 1);
    }
  };
  for (const p of paths) {
    try {
      walk(p, sh.vfs.lookup(sh.resolve(p), user), 0);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`find: '${p}': ${e.message}\n`);
      code = 1;
    }
  }
  return code;
}
