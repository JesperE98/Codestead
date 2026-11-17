// Port of Commands/Shells/ShellsCmd.FishStatus.cs – fish's builtin status (called through the fish translation).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

export const fishStatus: CommandDef = ShellsCmd.fishBuiltin("status", (ctx) => {
  const sh = ctx.sh;
  switch (ctx.args.length > 0 ? ctx.args[0] : null) {
    case null:
      ctx.out("This is not a login shell\nJob control: Only on interactive jobs\n");
      return 0;
    case "is-interactive":
      return sh.interactive ? 0 : 1;
    case "is-login":
      return 1;
    case "current-command":
      ctx.out("status\n");
      return 0;
    case "fish-path":
      ctx.out("/usr/bin/fish\n");
      return 0;
    default:
      ctx.err(`status: ${ctx.args[0]}: invalid subcommand\n`);
      return 2;
  }
});
