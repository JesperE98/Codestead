// Port of Commands/System/SystemCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/system.ts – shell and system commands: sudo, su, man, help, which, type, export, alias, history, uname and more.
//
// Wave 2 ports this group: the root file (the C# SystemCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file SystemCmd.<Name>.cs becomes SystemCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Whoami, Id, Groups, Hostname, Uname, Date, EnvCmd("env"), EnvCmd("printenv"), Export, Unset, Alias, Unalias, History, TypeCmd, Which, Man, Help, Clear, ExitCmd, Logout, Sudo, Su, Bash, Bash.With(name: "sh"), Source, Dot, TrueCmd, FalseCmd, Sleep, Seq, BasenameCmd, DirnameCmd
 */
export function all(): CommandDef[] {
  return [];
}
