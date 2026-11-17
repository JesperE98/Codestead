// Port of Commands/Ssh/SshCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/ssh.ts – ssh, ssh-keygen and ssh-copy-id. The server server.lan (192.168.1.10) is a small shell of its own (Debian) that lives in memory as long as the app is open. Commands sent with "ssh student@server.lan COMMAND" really run there (the student's own user name).
//
// Wave 2 ports this group: the root file (the C# SshCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file SshCmd.<Name>.cs becomes SshCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Ssh, SshKeygen, SshCopyId
 */
export function all(): CommandDef[] {
  return [];
}

/** The file transfer commands (scp, rsync), in the C# order: Scp, Rsync. Defined in SshCmd.Transfer.cs in C#. */
export function transfer(): CommandDef[] {
  return [];
}
