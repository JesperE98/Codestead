// Port of Commands/Pkg/PkgCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/pkg.ts Simulated package managers: apt (Debian/Ubuntu), pacman (Arch) and dnf (Fedora/RHEL). The output imitates the real programs, but simplified.
//
// Wave 2 ports this group: the root file (the C# PkgCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file PkgCmd.<Name>.cs becomes PkgCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * MakeApt("apt"), MakeApt("apt-get"), Pacman, Dnf("dnf"), Dnf("dnf5")
 */
export function all(): CommandDef[] {
  return [];
}
