// Port of Commands/Shells/ShellsCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/shells.ts – other shells: zsh and fish (started on top of bash and left with exit), chsh to change the login shell, zsh's setopt/unsetopt and the hidden builtins the fish translation uses (set, count, math, status, contains).
//
// Wave 2 ports this group: the root file (the C# ShellsCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ShellsCmd.<Name>.cs becomes ShellsCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Zsh, Fish, Chsh, OptCommand("setopt"), OptCommand("unsetopt"), FishSet, FishCount, FishIndex, FishContains, FishStatus, FishMathCmd
 */
export function all(): CommandDef[] {
  return [];
}
