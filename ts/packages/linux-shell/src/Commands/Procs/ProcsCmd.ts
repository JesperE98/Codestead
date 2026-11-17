// Port of Commands/Procs/ProcsCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/procs.ts – commands for processes and jobs: ps, top, kill, killall, pkill, pgrep, jobs, fg, bg, wait, uptime and free.
//
// Wave 2 ports this group: the root file (the C# ProcsCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ProcsCmd.<Name>.cs becomes ProcsCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Ps, Top, Kill, ByName("killall"), ByName("pkill"), ByName("pgrep"), Jobs, Fg, Bg, Wait, Uptime, Free
 */
export function all(): CommandDef[] {
  return [];
}
