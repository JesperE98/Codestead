// Port of Commands/Net/NetCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/net.ts – network commands: ip, ping, ss, dig, host, nslookup, getent, traceroute, curl, wget and the practice server myserver. The network itself is in Network/ (NetworkLib).
//
// Wave 2 ports this group: the root file (the C# NetCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file NetCmd.<Name>.cs becomes NetCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Ip, Ping, Ss, Dig, Host, Nslookup, Getent, Traceroute, Curl, Wget, Myserver
 */
export function all(): CommandDef[] {
  return [];
}
