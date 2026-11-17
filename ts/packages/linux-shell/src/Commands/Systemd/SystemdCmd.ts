// Port of Commands/Systemd/SystemdCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/systemd.ts – commands for services and logs: systemctl, journalctl, hostnamectl, systemd-analyze and reboot. The model (services, journal, boots) is in Services/ (ServicesLib).
//
// Wave 2 ports this group: the root file (the C# SystemdCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file SystemdCmd.<Name>.cs becomes SystemdCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Systemctl, Journalctl, Hostnamectl, Analyze, RebootCmd
 */
export function all(): CommandDef[] {
  return [];
}
