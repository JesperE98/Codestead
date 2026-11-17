// Port of Commands/Script/ScriptCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/script.ts – builtins for scripts: test/[ ]/[[ ]], read, printf, local, return, break, continue, shift, let and set.
//
// Wave 2 ports this group: the root file (the C# ScriptCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ScriptCmd.<Name>.cs becomes ScriptCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * TestCommand("test"), TestCommand("["), TestCommand("[["), Read, Printf, Local, ReturnCmd, LoopControl("break"), LoopControl("continue"), Shift, LetCmd, Set
 */
export function all(): CommandDef[] {
  return [];
}
