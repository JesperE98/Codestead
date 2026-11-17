// Port of Commands/Fileinfo/FileinfoCmd.cs – STUB from wave 1.
// C#: Links and information about files: ln, readlink, realpath, stat, file and umask.
//
// Wave 2 ports this group: the root file (the C# FileinfoCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file FileinfoCmd.<Name>.cs becomes FileinfoCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Ln, Readlink, Realpath, Stat, File, Umask
 */
export function all(): CommandDef[] {
  return [];
}
