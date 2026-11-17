// Port of Commands/Textproc/TextprocCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/textproc.ts – text processing: tr, sed and awk.
//
// Wave 2 ports this group: the root file (the C# TextprocCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file TextprocCmd.<Name>.cs becomes TextprocCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Tr, Sed, Awk
 */
export function all(): CommandDef[] {
  return [];
}
