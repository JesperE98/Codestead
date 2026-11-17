// Port of Commands/Fs/FsCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/fs.ts – navigating and handling files: cd, pwd, ls, mkdir, touch, rm, cp, mv, find, chmod, chown.
//
// Wave 2 ports this group: the root file (the C# FsCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file FsCmd.<Name>.cs becomes FsCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Cd, Pwd, Ls, Mkdir, Rmdir, Touch, Rm, Cp, Mv, Find, Chmod, Chown
 */
export function all(): CommandDef[] {
  return [];
}
