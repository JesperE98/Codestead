// Port of Commands/Shells/ShellsCmd.FishCount.cs – fish's builtin count (called through the fish translation).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

export const fishCount: CommandDef = ShellsCmd.fishBuiltin("count", (ctx) => {
  ctx.out(`${ctx.args.length}\n`);
  return ctx.args.length > 0 ? 0 : 1;
});
