// Port of Commands/Extras/ExtrasCmd.Tree.cs – the tree command: shows directories as a tree.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const tree: CommandDef = {
  name: "tree",
  summary: "Visar kataloger som ett träd",
  man: `NAMN
       tree - visa innehållet i kataloger som ett träd

SYNOPSIS
       tree [-a] [-d] [-L NIVÅ] [KATALOG]

FLAGGOR
       -a       visa även dolda filer
       -d       visa bara kataloger
       -L NIVÅ  gå högst NIVÅ nivåer ner`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "ad", values: "L" });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const sh = ctx.sh;
    const user = sh.currentUser();
    const levelValue = o.values.get("L");
    const maxLevel = levelValue !== undefined && levelValue !== "" ? Js.number(levelValue) : Number.POSITIVE_INFINITY;
    let dirs = 0;
    let files = 0;
    const walk = (node: FsNode, prefix: string, level: number): void => {
      if (level > maxLevel) return;
      if (!VfsLib.hasPerm(node, user, "r")) return;
      const children = node.children!;
      const names = [...children.keys()]
        .filter((n) => o.flags.has("a") || !n.startsWith("."))
        .filter((n) => !o.flags.has("d") || children.get(n)!.type === "dir")
        .sort(Js.localeCompare);
      for (let i = 0; i < names.length; i++) {
        const n = names[i]!;
        const child = children.get(n)!;
        const last = i === names.length - 1;
        ctx.out(`${prefix}${last ? "└── " : "├── "}${UtilCmd.colorName(n, child, ctx.isTTY)}\n`);
        if (child.type === "dir") {
          dirs++;
          walk(child, prefix + (last ? "    " : "│   "), level + 1);
        } else {
          files++;
        }
      }
    };
    const target = o.operands.length > 0 ? o.operands[0]! : ".";
    try {
      const node = sh.vfs.lookup(sh.resolve(target), user);
      if (node.type !== "dir") {
        ctx.out(`${target}  [error opening dir]\n\n0 directories, 0 files\n`);
        return 2;
      }
      ctx.out(UtilCmd.colorName(target, node, ctx.isTTY) + "\n");
      walk(node, "", 1);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.out(`${target}  [error opening dir: ${e.message}]\n`);
      return 2;
    }
    ctx.out(`\n${dirs} director${dirs === 1 ? "y" : "ies"}${o.flags.has("d") ? "" : `, ${files} file${files === 1 ? "" : "s"}`}\n`);
    return 0;
  },
};
