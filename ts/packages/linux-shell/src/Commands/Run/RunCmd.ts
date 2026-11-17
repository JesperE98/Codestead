// Port of Commands/Run/RunCmd.cs – commands that run other commands: xargs, nohup and watch. This is the group's
// root file: running a command from $PATH and the list of the group's commands.

import type { CommandDef } from "../../Types/CommandDef.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { IO } from "../../Types/IO.js";
import * as IndexCmd from "../IndexCmd.js";
import { nohup } from "./RunCmd.Nohup.js";
import { watch } from "./RunCmd.Watch.js";
import { xargs } from "./RunCmd.Xargs.js";

export * from "./RunCmd.Nohup.js";
export * from "./RunCmd.Watch.js";
export * from "./RunCmd.Xargs.js";

/**
 * Runs a command the way a program started by another program runs: from $PATH (aliases and shell
 * functions do not exist there). Returns 127 if it is not found, like execvp.
 */
export function exec(ctx: CmdCtx, who: string, argv: string[], io: IO): number {
  const sh = ctx.sh;
  const name = argv[0]!;
  const def = IndexCmd.commands().get(name);
  if (!name.includes("/") && def !== undefined && def.builtin === true && sh.resolveCommand(name).kind === "notfound") {
    io.err(`${who}: ${name}: No such file or directory\n`);
    return 127;
  }
  if (sh.resolveCommand(name).kind === "notfound") {
    io.err(`${who}: ${name}: No such file or directory\n`);
    if (!name.includes("/")) sh.notFoundHint(name, io);
    return 127;
  }
  return sh.invoke(argv, io, true);
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [xargs, nohup, watch];
}
