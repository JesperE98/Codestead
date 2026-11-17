// Port of Commands/Archive/ArchiveCmd.Du.cs – the du command: shows how much disk space files and directories use.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { sortedChildren } from "./ArchiveCmd.js";
import { ceilDiv } from "./ArchiveCmd.Sizes.js";

const digitsRe = /^[0-9]+$/;

export const du: CommandDef = {
  name: "du",
  summary: "Visar hur mycket diskutrymme filer och kataloger tar",
  man: `NAMN
       du - visa hur mycket diskutrymme filer och kataloger använder
            (disk usage)

SYNOPSIS
       du [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storleken för varje katalog (och underkatalog) i kilobyte.
       Utan FIL visas aktuell katalog.

       Disken delas in i block om 4 KiB, så även en fil på 10 byte tar
       4.0K på disken. Den verkliga storleken visar du med --apparent-size
       eller med ls -l.

FLAGGOR
       -h, --human-readable   läsbara storlekar (4.0K, 12M, 1.5G)
       -s, --summarize        visa bara en summa per argument
       -a, --all              visa även filer, inte bara kataloger
       -c, --total            lägg till en rad med totalsumman
       -d, --max-depth=N      visa bara N nivåer ner
       -b, --bytes            verklig storlek i byte (--apparent-size)
           --apparent-size    verklig storlek i stället för diskutrymme

EXEMPEL
       du -sh dokument                 hur stor är katalogen?
       du -h -d 1 ~                    storleken på allt i hemkatalogen
       du -h dokument.tar dokument.tar.gz`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "hsacb",
      values: "d",
      long: {
        "human-readable": "h",
        summarize: "s",
        all: "a",
        total: "c",
        bytes: "b",
        "apparent-size": "A",
        "max-depth": "d",
      },
    });
    if (o.error !== null) {
      ctx.err(`du: ${o.error}\nTry 'du --help' for more information.\n`);
      return 1;
    }
    const has = (f: string): boolean => o.flags.has(f);
    if (has("s") && has("a")) {
      ctx.err("du: cannot both summarize and show all entries\nTry 'du --help' for more information.\n");
      return 1;
    }
    let maxDepth = Number.POSITIVE_INFINITY;
    const dv = o.values.get("d");
    if (dv !== undefined) {
      if (!digitsRe.test(dv)) {
        ctx.err(`du: invalid maximum depth '${dv}'\nTry 'du --help' for more information.\n`);
        return 1;
      }
      maxDepth = Js.number(dv);
    }
    if (has("s")) maxDepth = 0;
    const apparent = has("b") || has("A");
    const sh = ctx.sh;
    const user = sh.currentUser();
    const usage = (n: FsNode): number => (apparent ? VfsLib.nodeSize(n) : ceilDiv(VfsLib.nodeSize(n), 4096) * 4096);
    const fmt = (bytes: number): string => (has("h") ? UtilCmd.humanSize(bytes) : has("b") ? Js.num(bytes) : Js.num(ceilDiv(bytes, 1024)));
    let code = 0;
    let total = 0;

    const walk = (label: string, node: FsNode, depth: number): number => {
      let size = usage(node);
      if (node.type === "dir") {
        if (!VfsLib.hasPerm(node, user, "r") || !VfsLib.hasPerm(node, user, "x")) {
          ctx.err(`du: cannot read directory '${label}': Permission denied\n`);
          code = 1;
        } else {
          for (const child of sortedChildren(node))
            size += walk(label.endsWith("/") ? label + child : `${label}/${child}`, node.children!.get(child)!, depth + 1);
        }
      }
      if (depth <= maxDepth && (node.type === "dir" || has("a") || depth === 0)) ctx.out(`${fmt(size)}\t${label}\n`);
      return size;
    };

    for (const op of o.operands.length > 0 ? o.operands : ["."]) {
      try {
        total += walk(op, sh.vfs.lookup(sh.resolve(op), user), 0);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`du: cannot access '${op}': ${e.message}\n`);
        code = 1;
      }
    }
    if (has("c")) ctx.out(`${fmt(total)}\ttotal\n`);
    return code;
  },
};
