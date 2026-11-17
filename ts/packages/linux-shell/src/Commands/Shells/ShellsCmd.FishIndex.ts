// Port of Commands/Shells/ShellsCmd.FishIndex.cs – fish's builtin index (called through the fish translation).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

export const fishIndex: CommandDef = ShellsCmd.fishBuiltin("index", (ctx) => {
  const n = ctx.args.length > 0 ? ctx.args[0]! : null;
  const list = ctx.args.slice(1);
  const idx = Js.number(n);
  const pos = idx > 0 ? idx - 1 : list.length + idx;
  // list[pos] is undefined unless pos is a whole index inside the list.
  if (Number.isNaN(pos) || pos !== Math.floor(pos) || pos < 0 || pos >= list.length) return 1;
  ctx.out(list[pos] + "\n");
  return 0;
});
