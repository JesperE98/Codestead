// Port of Commands/Run/RunCmd.cs – STUB from wave 1.
// C#: Commands that run other commands: xargs, nohup and watch.
//
// Wave 2 ports this group: the root file (the C# RunCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file RunCmd.<Name>.cs becomes RunCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Xargs, Nohup, Watch
 */
export function all(): CommandDef[] {
  return [];
}
