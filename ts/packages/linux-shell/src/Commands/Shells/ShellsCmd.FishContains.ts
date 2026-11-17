// Port of Commands/Shells/ShellsCmd.FishContains.cs – fish's builtin contains (called through the fish
// translation).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

export const fishContains: CommandDef = ShellsCmd.fishBuiltin("contains", (ctx) => {
  const args = [...ctx.args];
  const printIndex = args.length > 0 && (args[0] === "-i" || args[0] === "--index");
  if (printIndex) args.shift();
  if (args.length === 0) {
    ctx.err("contains: Key not specified\n");
    return 2;
  }
  const needle = args[0]!;
  const hay = args.slice(1);
  const i = hay.indexOf(needle);
  if (i >= 0 && printIndex) ctx.out(`${i + 1}\n`);
  return i >= 0 ? 0 : 1;
});
